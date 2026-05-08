// footnote-ref: atom inline pointing to footnote content stored in PG.
// Phase 1 shows the marker only; the footnote body row lives in PG via
// the same Citation-like pattern (kind=footnote in Phase 1.5 schema add).

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId, newFootnoteId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnoteRef: {
      insertFootnoteRef: (footnoteId: string, label: string) => ReturnType;
    };
  }
}

export const FootnoteRef = Node.create({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-block-id'),
        renderHTML: (attrs) => ({ 'data-block-id': attrs['blockId'] }),
      },
      footnoteId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-footnote-id'),
        renderHTML: (attrs) => ({ 'data-footnote-id': attrs['footnoteId'] }),
      },
      label: {
        default: '*',
        parseHTML: (el) => el.textContent ?? '*',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-pm-node="footnote-ref"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'footnote-ref',
        class: 'pm-node-footnote-ref',
      }),
      node.attrs['label'] || '*',
    ];
  },

  addCommands() {
    return {
      insertFootnoteRef:
        (footnoteId: string, label: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              blockId: newBlockId(),
              footnoteId: footnoteId || newFootnoteId(),
              label,
            },
          });
        },
    };
  },
});
