// dataset-ref: atom inline pointing to Citation kind='dataset'.
// Same Citation table as literature; kind discriminates UI.

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId, newCitationId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    datasetRef: {
      insertDatasetRef: (citationId: string, label: string) => ReturnType;
    };
  }
}

export const DatasetRef = Node.create({
  name: 'datasetRef',
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
      citationId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-citation-id'),
        renderHTML: (attrs) => ({ 'data-citation-id': attrs['citationId'] }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-pm-node="dataset-ref"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'dataset-ref',
        class: 'pm-node-dataset-ref',
      }),
      `${node.attrs['label'] || node.attrs['citationId'] || '?'}`,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.classList.add('pm-node-dataset-ref');
      dom.dataset['pmNode'] = 'dataset-ref';
      dom.dataset['blockId'] = node.attrs['blockId'] ?? '';
      dom.dataset['citationId'] = node.attrs['citationId'] ?? '';
      dom.textContent = `${node.attrs['label'] || node.attrs['citationId'] || '?'}`;
      return { dom };
    };
  },

  addCommands() {
    return {
      insertDatasetRef:
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
