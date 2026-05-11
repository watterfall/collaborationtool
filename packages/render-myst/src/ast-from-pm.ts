// Walk a ProseMirror JSON tree and emit MyST AST.
//
// The PM tree shape comes from packages/editor-core's paperSchema. We
// translate atomic nodes (citation-ref, equation, figure) into their
// MyST equivalents; marks (bold, italic, annotation-anchor) become text
// run annotations.
//
// This file does NOT import from @tiptap/* or the editor — its input is
// plain JSON. That keeps the renderer headless / server-side ESM clean.
//
// PmNode / PmMark / PmDocInput live in @collaborationtool/schema (Phase 1.5
// extraction per ADR-0005 §2.4) and are re-exported from this package's
// index for ergonomic consumers.

import type { PmDocInput, PmMark, PmNode } from '@collaborationtool/schema';

import type {
  MystCaption,
  MystCite,
  MystCodeBlock,
  MystFigure,
  MystHeading,
  MystImage,
  MystInline,
  MystInlineMath,
  MystListItem,
  MystMark,
  MystMath,
  MystNode,
  MystParagraph,
  MystRoot,
  MystText,
} from './types';

export type { PmDocInput, PmMark, PmNode };

export function pmToMystAst(pmDoc: PmDocInput): MystRoot {
  if (pmDoc.type !== 'doc') {
    throw new Error(`pmToMystAst: expected root type 'doc', got '${pmDoc.type}'`);
  }
  const content = (pmDoc.content ?? []) as PmNode[];
  return {
    type: 'root',
    children: content.flatMap(blockNode),
  };
}

function blockNode(node: PmNode): MystNode[] {
  switch (node.type) {
    case 'paragraph':
      return [{ type: 'paragraph', children: inlineRun(node.content) } as MystParagraph];
    case 'heading':
      return [
        {
          type: 'heading',
          depth: clampDepth(Number(node.attrs?.['level'] ?? 1)),
          children: inlineRun(node.content),
        } satisfies MystHeading,
      ];
    case 'equation': {
      // Block-level display equation (atom).
      const latex = String(node.attrs?.['latex'] ?? '');
      return [{ type: 'math', value: latex } satisfies MystMath];
    }
    case 'computational-cell':
    case 'computationalCell': {
      const lang = String(node.attrs?.['kernel'] ?? 'python');
      const source = String(node.attrs?.['sourceCode'] ?? '');
      return [{ type: 'code', lang, value: source } satisfies MystCodeBlock];
    }
    case 'blockquote':
      return [
        {
          type: 'blockquote',
          children: (node.content ?? []).flatMap(blockNode),
        },
      ];
    case 'list':
      return [
        {
          type: 'list',
          ordered: false,
          children: (node.content ?? []).map(
            (li): MystListItem => ({
              type: 'listItem',
              children: (li.content ?? []).flatMap(blockNode),
            }),
          ),
        },
      ];
    case 'figure':
      return [figureFromPm(node)];
    case 'figureCaption':
      // Standalone figureCaption shouldn't appear at block level; if it
      // does, fall through to a paragraph wrap.
      return [{ type: 'paragraph', children: inlineRun(node.content) }];
    default:
      // Unknown / footnoteRef / dataset-ref at block level fall through
      // as a paragraph wrapper. Phase 1.5 expands the switch.
      return [{ type: 'paragraph', children: inlineRun(node.content) }];
  }
}

function figureFromPm(node: PmNode): MystFigure {
  const src = String(node.attrs?.['src'] ?? '');
  const captionContent = (node.content ?? []).find(
    (c) => c.type === 'figureCaption' || c.type === 'figure-caption',
  );
  const image: MystImage = { type: 'image', url: src };
  const out: MystFigure = {
    type: 'figure',
    children: [image],
  };
  if (captionContent) {
    const caption: MystCaption = {
      type: 'caption',
      children: inlineRun(captionContent.content),
    };
    out.children.push(caption);
  }
  if (node.attrs?.['blockId']) out.identifier = String(node.attrs['blockId']);
  return out;
}

function inlineRun(content: PmNode[] | undefined): MystInline[] {
  if (!content) return [];
  const out: MystInline[] = [];
  for (const node of content) {
    out.push(...inlineNode(node));
  }
  return out;
}

function inlineNode(node: PmNode): MystInline[] {
  switch (node.type) {
    case 'text': {
      const text: MystText = { type: 'text', value: node.text ?? '' };
      const marks = collectMarks(node.marks);
      if (marks.length > 0) text.marks = marks;
      return [text];
    }
    case 'inlineEquation':
    case 'inline-equation': {
      const latex = String(node.attrs?.['latex'] ?? '');
      return [{ type: 'inlineMath', value: latex } satisfies MystInlineMath];
    }
    case 'citationRef':
    case 'citation-ref': {
      const cite: MystCite = {
        type: 'cite',
        citationId: String(node.attrs?.['citationId'] ?? ''),
      };
      const label = node.attrs?.['label'];
      if (typeof label === 'string' && label.length > 0) cite.label = label;
      return [cite];
    }
    case 'datasetRef':
    case 'dataset-ref': {
      const cite: MystCite = {
        type: 'cite',
        citationId: String(node.attrs?.['citationId'] ?? ''),
      };
      const label = node.attrs?.['label'];
      if (typeof label === 'string' && label.length > 0) {
        cite.label = `dataset:${label}`;
      }
      return [cite];
    }
    case 'footnoteRef':
    case 'footnote-ref': {
      // Phase 1: treat as a cite-style note with footnote: prefix in label
      // so the renderer can choose how to surface it.
      const id = String(node.attrs?.['footnoteId'] ?? '');
      const label = String(node.attrs?.['label'] ?? '*');
      return [{ type: 'cite', citationId: `footnote:${id}`, label }];
    }
    default:
      // Atom inline we don't recognise — emit empty text to avoid breaks.
      return [{ type: 'text', value: '' }];
  }
}

function collectMarks(marks: PmMark[] | undefined): MystMark[] {
  if (!marks) return [];
  const out: MystMark[] = [];
  for (const m of marks) {
    if (m.type === 'bold') out.push({ type: 'bold' });
    else if (m.type === 'italic') out.push({ type: 'italic' });
    else if (m.type === 'annotationAnchor' || m.type === 'annotation-anchor') {
      out.push({
        type: 'annotation-anchor',
        anchorId: String(m.attrs?.['anchorId'] ?? ''),
      });
    }
    // Phase 5 Wave B B2 (ADR-0016 §2.2): claim-review-anchor mark.
    else if (
      m.type === 'claimReviewAnchor' ||
      m.type === 'claim-review-anchor'
    ) {
      const rawBuckets = m.attrs?.['verdictBuckets'];
      const buckets =
        rawBuckets && typeof rawBuckets === 'object'
          ? (rawBuckets as Record<string, unknown>)
          : {};
      out.push({
        type: 'claim-review-anchor',
        claimId: String(m.attrs?.['claimId'] ?? ''),
        verdictBuckets: {
          endorses: Number(buckets['endorses']) || 0,
          challenges: Number(buckets['challenges']) || 0,
          refines: Number(buckets['refines']) || 0,
        },
        latestReviewerOrcidId:
          typeof m.attrs?.['latestReviewerOrcidId'] === 'string'
            ? (m.attrs['latestReviewerOrcidId'] as string)
            : null,
      });
    }
  }
  return out;
}

function clampDepth(n: number): MystHeading['depth'] {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  if (n === 5) return 5;
  return 6;
}
