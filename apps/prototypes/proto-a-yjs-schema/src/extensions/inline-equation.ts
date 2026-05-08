// Inline equation (atom inline). Same as Equation but inline + non-display.

import { Node, mergeAttributes } from '@tiptap/core';
import { renderKatexInto } from '../util/katex-render';
import { newBlockId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineEquation: {
      insertInlineEquation: (latex: string) => ReturnType;
    };
  }
}

export const InlineEquation = Node.create({
  name: 'inlineEquation',
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
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-pm-node="inline-equation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'inline-equation',
        class: 'pm-node-inline-equation',
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.classList.add('pm-node-inline-equation');
      dom.dataset.pmNode = 'inline-equation';
      dom.dataset.blockId = node.attrs.blockId ?? '';
      dom.dataset.latex = node.attrs.latex ?? '';
      renderKatexInto(dom, node.attrs.latex ?? '', false);
      return { dom };
    };
  },

  addCommands() {
    return {
      insertInlineEquation:
        (latex: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { blockId: newBlockId(), latex },
          });
        },
    };
  },
});
