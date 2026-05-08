// citation-ref: atom inline that points to a global Citation by attrs.citationId.
// Per ADR-0001: only the ID is in Y.Doc; citation metadata lives in Postgres.
// In this prototype we have no PG, so we fake it with a label attr.

import { Node, mergeAttributes } from '@tiptap/core';
import { newBlockId, newCitationId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citationRef: {
      insertCitationRef: (citationId: string, label: string) => ReturnType;
    };
  }
}

export const CitationRef = Node.create({
  name: 'citationRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-block-id'),
        renderHTML: (attrs) => ({ 'data-block-id': attrs.blockId }),
      },
      citationId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-citation-id'),
        renderHTML: (attrs) => ({ 'data-citation-id': attrs.citationId }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-pm-node="citation-ref"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'citation-ref',
        class: 'pm-node-citation-ref',
      }),
      `[${node.attrs.label || node.attrs.citationId || '?'}]`,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.classList.add('pm-node-citation-ref');
      dom.dataset.pmNode = 'citation-ref';
      dom.dataset.blockId = node.attrs.blockId ?? '';
      dom.dataset.citationId = node.attrs.citationId ?? '';
      dom.textContent = `[${node.attrs.label || node.attrs.citationId || '?'}]`;
      return { dom };
    };
  },

  addCommands() {
    return {
      insertCitationRef:
        (citationId: string, label: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              blockId: newBlockId(),
              citationId: citationId || newCitationId(),
              label,
            },
          });
        },
    };
  },
});
