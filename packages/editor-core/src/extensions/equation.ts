// Display equation (atom block).
// attrs: blockId (uuidv7), latex (raw LaTeX source).
// Atom = ProseMirror does not descend; the latex string is the content.

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId } from '../util/ids';
import { renderKatexInto } from '../util/katex-render';

export interface EquationAttrs {
  blockId: string;
  latex: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    equation: {
      insertEquation: (latex: string) => ReturnType;
    };
  }
}

export const Equation = Node.create({
  name: 'equation',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-block-id'),
        renderHTML: (attrs) => ({ 'data-block-id': attrs['blockId'] }),
      },
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (attrs) => ({ 'data-latex': attrs['latex'] }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-pm-node="equation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'equation',
        class: 'pm-node-equation',
      }),
      0,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.classList.add('pm-node-equation');
      dom.dataset['pmNode'] = 'equation';
      dom.dataset['blockId'] = node.attrs['blockId'] ?? '';
      dom.dataset['latex'] = node.attrs['latex'] ?? '';
      renderKatexInto(dom, node.attrs['latex'] ?? '', true);
      return { dom };
    };
  },

  addCommands() {
    return {
      insertEquation:
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
