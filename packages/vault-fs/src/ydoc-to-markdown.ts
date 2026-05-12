// Y.Doc → markdown emit.
// Strategy: Y.Doc XmlFragment → PM tree (via yXmlFragmentToProsemirrorJSON) →
// markdown via prosemirror-markdown's defaultMarkdownSerializer extended
// for paper-schema custom nodes/marks (claim / evidence / claim-review-anchor /
// figure / dataset).
//
// For Spike-2 only base nodes (doc / heading / paragraph / text) + bold +
// italic marks are wired. Custom paper-schema nodes (claim / evidence /
// figure / figureCaption / equation / computationalCell / inlineEquation /
// citationRef / datasetRef / footnoteRef) emit as HTML comments
// `<!-- claim {"...":"..."} -->` for round-trip preservation — Phase 6 W3-W4
// will replace with proper markdown directive syntax (`::claim{...}` per MyST).
//
// API note (Spike-2 W1 fix, 2026-05-12):
//   - paperSchema is a *function*: call `paperSchema()` to get the Schema
//   - prosemirror-markdown defaultMarkdownSerializer expects mark names
//     `strong` and `em`; TipTap @tiptap/extension-bold registers name
//     `bold` and @tiptap/extension-italic registers name `italic`. Add
//     aliases mapping bold→strong, italic→em rules so emit round-trips.

import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
} from 'prosemirror-markdown';
import type { Schema } from 'prosemirror-model';

import { paperSchema } from '@collaborationtool/editor-core';

// Build a Serializer that knows about paper-schema custom nodes/marks.
// Custom nodes fall back to HTML-comment preservation; see file header.
let cachedSerializer: MarkdownSerializer | null = null;
function getSerializer(): MarkdownSerializer {
  if (!cachedSerializer) {
    cachedSerializer = buildPaperSerializer(paperSchema());
  }
  return cachedSerializer;
}

function buildPaperSerializer(schema: Schema): MarkdownSerializer {
  const nodes: Record<string, any> = { ...defaultMarkdownSerializer.nodes };
  const marks: Record<string, any> = { ...defaultMarkdownSerializer.marks };

  // TipTap mark-name aliases — defaultMarkdownSerializer indexes by
  // `strong` / `em` but our schema (via TipTap) registers `bold` / `italic`.
  if (schema.marks['bold'] && !marks['bold']) {
    marks['bold'] = defaultMarkdownSerializer.marks['strong']!;
  }
  if (schema.marks['italic'] && !marks['italic']) {
    marks['italic'] = defaultMarkdownSerializer.marks['em']!;
  }

  // Spike-2 stub: custom nodes preserved as comments.
  const customNodeNames = [
    'claim',
    'evidence',
    'figure',
    'figureCaption',
    'equation',
    'computationalCell',
    'inlineEquation',
    'citationRef',
    'datasetRef',
    'footnoteRef',
  ];
  for (const name of customNodeNames) {
    if (!schema.nodes[name]) continue;
    const isInline = schema.nodes[name]!.isInline;
    const isAtom = schema.nodes[name]!.isAtom;
    nodes[name] = (state: any, node: any) => {
      const attrs = JSON.stringify(node.attrs);
      if (isInline) {
        state.write(`<!-- ${name} ${attrs} -->`);
      } else {
        state.write(`<!-- ${name} ${attrs} -->`);
        // Block-level container: recurse into children if not atom.
        if (!isAtom && node.content && node.content.size > 0) {
          state.write('\n');
          state.renderContent(node);
        }
        state.closeBlock(node);
      }
    };
  }

  // Custom marks (annotationAnchor / claimReviewAnchor) — Spike-2 stub:
  // render the inner content verbatim, drop the mark (preserved in Y.Doc
  // but not in markdown round-trip until Phase 6 directive support).
  const customMarkNames = ['annotationAnchor', 'claimReviewAnchor'];
  for (const name of customMarkNames) {
    if (!schema.marks[name]) continue;
    marks[name] = { open: '', close: '', mixable: true };
  }

  return new MarkdownSerializer(nodes, marks);
}

export function emitMarkdown(yDoc: Y.Doc): string {
  const fragment = yDoc.getXmlFragment('prosemirror');
  if (fragment.length === 0) return '';
  // API note (Spike-2 W1 fix): yXmlFragmentToProsemirrorJSON@1.3.7
  // signature is `(xmlFragment: Y.XmlFragment) => Record<string, any>`
  // — takes the fragment directly, not (yDoc, name).
  const pmJson = yXmlFragmentToProsemirrorJSON(fragment);
  const node = paperSchema().nodeFromJSON(pmJson);
  return getSerializer().serialize(node);
}
