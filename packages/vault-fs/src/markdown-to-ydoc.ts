// markdown → Y.Doc parse.
// Strategy: markdown → PM JSON via prosemirror-markdown defaultMarkdownParser
// → Y.Doc XmlFragment via prosemirrorJSONToYDoc.
//
// Caveat: defaultMarkdownParser does NOT understand paper-schema custom
// nodes — they round-trip as raw HTML blocks (preserved verbatim).
// Phase 6 W3-W4 will swap to a custom Parser extending markdown-it with
// directive plugin (`:::claim{...}`) for proper paper-schema parse.
//
// API note (Spike-2 W1 fix, 2026-05-12): defaultMarkdownParser is
// constructed against the DEFAULT prosemirror-markdown schema (which uses
// `strong` / `em` mark names + nodes like `bullet_list` / `code_block` /
// `image` not in paperSchema). When we feed its JSON into our paperSchema
// (which has `bold` / `italic`), the marks would not validate.
// Solution: (a) rename marks between parse and prosemirrorJSONToYDoc;
// (b) flatten unsupported block nodes to paragraphs so paperSchema accepts
// the JSON. Phase 6 W3-W4 swaps to a markdown-it custom parser built
// against paperSchema directly so these rewrites are no longer needed.

import * as Y from 'yjs';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';
import { defaultMarkdownParser } from 'prosemirror-markdown';

import { paperSchema } from '@collaborationtool/editor-core';

export interface ParseMarkdownOptions {
  /** Pre-existing Y.Doc to merge into. If omitted, a fresh Y.Doc is created. */
  baseDoc?: Y.Doc;
}

type PmJson = Record<string, unknown>;

// Block-node names that exist in prosemirror-markdown default schema but
// NOT in paperSchema. We flatten these to paragraphs in Spike-2;
// Phase 6 W3-W4 swap to a parser that lowers them properly.
const UNSUPPORTED_BLOCK_NODES = new Set([
  'bullet_list',
  'ordered_list',
  'list_item',
  'blockquote',
  'code_block',
  'horizontal_rule',
  'hard_break',
  'image',
]);

// Recursive helper: rename mark names + flatten unsupported nodes.
function rewriteJson(node: PmJson): PmJson {
  const out: PmJson = { ...node };

  // Rename marks: strong → bold, em → italic.
  if (Array.isArray(out['marks'])) {
    out['marks'] = (out['marks'] as Array<PmJson>).map((m) => {
      if (m['type'] === 'strong') return { ...m, type: 'bold' };
      if (m['type'] === 'em') return { ...m, type: 'italic' };
      return m;
    });
  }

  // Recurse into content.
  if (Array.isArray(out['content'])) {
    const rewritten = (out['content'] as Array<PmJson>).map(rewriteJson);
    // Flatten unsupported block nodes: replace them with a paragraph
    // wrapping their text content. For list nodes, recurse into list_item
    // children which are themselves paragraph wrappers.
    const flattened: PmJson[] = [];
    for (const child of rewritten) {
      const t = child['type'] as string;
      if (UNSUPPORTED_BLOCK_NODES.has(t)) {
        // Lift child content up (list_item / blockquote contain block
        // children; code_block contains text; hard_break / image become
        // empty).
        if (Array.isArray(child['content'])) {
          for (const grandchild of child['content'] as PmJson[]) {
            const gt = grandchild['type'] as string;
            if (UNSUPPORTED_BLOCK_NODES.has(gt)) {
              flattened.push(...lowerToParagraphs(grandchild));
            } else {
              flattened.push(grandchild);
            }
          }
        }
      } else {
        flattened.push(child);
      }
    }
    out['content'] = flattened;
  }

  return out;
}

function lowerToParagraphs(node: PmJson): PmJson[] {
  if (!Array.isArray(node['content'])) return [];
  const result: PmJson[] = [];
  for (const child of node['content'] as PmJson[]) {
    const ct = child['type'] as string;
    if (UNSUPPORTED_BLOCK_NODES.has(ct)) {
      result.push(...lowerToParagraphs(child));
    } else {
      result.push(child);
    }
  }
  return result;
}

export function parseMarkdown(
  markdown: string,
  options: ParseMarkdownOptions = {},
): Y.Doc {
  if (markdown.length === 0) return options.baseDoc ?? new Y.Doc();

  const pmNode = defaultMarkdownParser.parse(markdown);
  if (!pmNode) {
    throw new Error('vault-fs: markdown parse returned null');
  }
  const rawJson = pmNode.toJSON() as PmJson;
  const pmJson = rewriteJson(rawJson); // strong→bold, em→italic, flatten lists
  // prosemirrorJSONToYDoc returns a fresh Y.Doc; the 3rd arg is the
  // fragment NAME (string), not a fragment OBJECT.
  // (y-prosemirror@1.3.7 src/lib.d.ts:41 — see Task 2 file header note.)
  const fresh = prosemirrorJSONToYDoc(paperSchema(), pmJson);

  // If caller passed baseDoc, merge the fresh state into it via an update.
  if (options.baseDoc) {
    const update = Y.encodeStateAsUpdate(fresh);
    // Clear existing fragment so we don't double-append.
    const baseFragment = options.baseDoc.getXmlFragment('prosemirror');
    if (baseFragment.length > 0) baseFragment.delete(0, baseFragment.length);
    Y.applyUpdate(options.baseDoc, update);
    return options.baseDoc;
  }
  return fresh;
}
