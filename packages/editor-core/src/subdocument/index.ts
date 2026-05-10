// Phase 4 W5 ADR-0014: Yjs subdocument 启动 backend.
//
// Two pure walkers over PM JSON; both touch zero Y.Doc / DOM:
//
//   - detectSubdocBoundariesByH1(pmJson) — split a root document body
//     by heading-1 boundaries. Output: ordered subdoc descriptors with
//     start/end block indices into the body's children array. Used by
//     snapshot-worker (auto-split when thresholds exceeded) and by the
//     editor "split here" UI.
//
//   - extractCrossRefs(pmJson) — walk the PM tree and emit one row
//     per outbound reference (citation-ref / dataset-ref / figure with
//     id / claim / evidence). Snapshot-worker syncs these into the
//     `crossref_index` PG table; the editor maintains the same list
//     in the root Y.Doc's `Y.Map("crossRefs")`.
//
// Both are idempotent + deterministic: same input → same output. They
// operate on the PM JSON wire format (ADR-0005), not on a live PM doc
// instance, so they can run in worker contexts (Node) without DOM.

export interface PmDocJson {
  type: 'doc';
  content?: PmNodeJson[];
}

export interface PmNodeJson {
  type: string;
  attrs?: Record<string, unknown> | undefined;
  content?: PmNodeJson[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

// ---------- Subdoc boundary detection ----------

export interface SubdocBoundary {
  /** 0-based ord within the root doc. */
  ord: number;
  /** First heading-1 text content; falls back to "Section <ord>" when
   * the heading is empty or non-text. */
  title: string;
  /** Index into root body.content array where this subdoc starts. The
   * heading itself is INCLUDED in the subdoc range (the h1 is the
   * subdoc's title block). */
  startBlockIndex: number;
  /** Exclusive end index. */
  endBlockIndex: number;
}

/**
 * Walk the root doc body and split by heading level=1. Pre-h1 content
 * (preamble / abstract) becomes ord=0 with title "Preamble" if any
 * blocks precede the first h1; otherwise the first h1 is ord=0.
 *
 * Pure: zero side effects. Returns empty when body has no children.
 */
export function detectSubdocBoundariesByH1(
  pmJson: PmDocJson,
): SubdocBoundary[] {
  const blocks = pmJson.content ?? [];
  if (blocks.length === 0) return [];

  // Find h1 indices.
  const h1Indices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (isH1(blocks[i])) h1Indices.push(i);
  }

  // Edge case: no h1 → whole doc is one subdoc with title "Preamble".
  if (h1Indices.length === 0) {
    return [
      {
        ord: 0,
        title: 'Preamble',
        startBlockIndex: 0,
        endBlockIndex: blocks.length,
      },
    ];
  }

  const out: SubdocBoundary[] = [];
  let ord = 0;

  // Preamble subdoc (content before first h1).
  if (h1Indices[0]! > 0) {
    out.push({
      ord,
      title: 'Preamble',
      startBlockIndex: 0,
      endBlockIndex: h1Indices[0]!,
    });
    ord++;
  }

  // Each h1-bounded section.
  for (let i = 0; i < h1Indices.length; i++) {
    const start = h1Indices[i]!;
    const end = i + 1 < h1Indices.length ? h1Indices[i + 1]! : blocks.length;
    out.push({
      ord,
      title: extractHeadingText(blocks[start]) || `Section ${ord + 1}`,
      startBlockIndex: start,
      endBlockIndex: end,
    });
    ord++;
  }

  return out;
}

function isH1(node: PmNodeJson | undefined): boolean {
  if (!node) return false;
  if (node.type !== 'heading') return false;
  return node.attrs?.['level'] === 1;
}

function extractHeadingText(node: PmNodeJson | undefined): string {
  if (!node) return '';
  const out: string[] = [];
  walkText(node, (t) => out.push(t));
  return out.join('').trim();
}

function walkText(node: PmNodeJson, sink: (t: string) => void): void {
  if (typeof node.text === 'string') sink(node.text);
  if (node.content) {
    for (const c of node.content) walkText(c, sink);
  }
}

// ---------- Cross-reference extraction ----------

export type CrossRefKind = 'figure' | 'citation' | 'claim' | 'evidence';

export interface CrossRef {
  refKind: CrossRefKind;
  /** The id the reference points at: figure-id / citation-id /
   * claim-id / evidence-id. */
  refTargetId: string;
  /** The block id where the reference appears (the containing block
   * of the atom, or the block itself for figure / claim / evidence
   * declarations). */
  sourceBlockId: string;
}

/**
 * Walk the PM tree and emit a CrossRef per:
 *   - citation-ref atom         → kind='citation', target=attrs.citationId
 *   - dataset-ref atom          → kind='citation', target=attrs.datasetId
 *   - figure block (with id)    → kind='figure',   target=attrs.blockId
 *   - claim block               → kind='claim',    target=attrs.claimId
 *   - evidence block            → kind='evidence', target=attrs.evidenceId
 *
 * dataset-ref uses kind='citation' on purpose — datasets and citations
 * share a citation_kind enum in PG (ADR-0001) and the maintenance scan
 * treats them uniformly.
 *
 * Output deduplicates by (refKind, refTargetId, sourceBlockId).
 */
export function extractCrossRefs(pmJson: PmDocJson): CrossRef[] {
  const acc: CrossRef[] = [];
  const seen = new Set<string>();

  const visit = (
    node: PmNodeJson,
    enclosingBlockId: string | null,
  ): void => {
    const blockId =
      typeof node.attrs?.['blockId'] === 'string'
        ? (node.attrs['blockId'] as string)
        : enclosingBlockId;

    switch (node.type) {
      case 'citationRef': {
        const cid = stringAttr(node, 'citationId');
        if (cid && blockId) push(acc, seen, 'citation', cid, blockId);
        break;
      }
      case 'datasetRef': {
        const did = stringAttr(node, 'datasetId');
        if (did && blockId) push(acc, seen, 'citation', did, blockId);
        break;
      }
      case 'figure': {
        if (blockId) push(acc, seen, 'figure', blockId, blockId);
        break;
      }
      case 'claim': {
        const cid = stringAttr(node, 'claimId');
        if (cid && blockId) push(acc, seen, 'claim', cid, blockId);
        break;
      }
      case 'evidence': {
        const eid = stringAttr(node, 'evidenceId');
        if (eid && blockId) push(acc, seen, 'evidence', eid, blockId);
        break;
      }
    }

    if (node.content) {
      for (const c of node.content) visit(c, blockId);
    }
  };

  if (pmJson.content) {
    for (const top of pmJson.content) visit(top, null);
  }
  return acc;
}

function stringAttr(node: PmNodeJson, key: string): string | null {
  const v = node.attrs?.[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function push(
  acc: CrossRef[],
  seen: Set<string>,
  refKind: CrossRefKind,
  refTargetId: string,
  sourceBlockId: string,
): void {
  const key = `${refKind}|${refTargetId}|${sourceBlockId}`;
  if (seen.has(key)) return;
  seen.add(key);
  acc.push({ refKind, refTargetId, sourceBlockId });
}
