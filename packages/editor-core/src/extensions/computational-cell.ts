// computational-cell: atom block placeholder for Marimo / Pyodide / remote Jupyter.
// Phase 1 stores attrs only; Phase 2 wires molab iframe; Phase 3 Pyodide-inline.
// kernel field per ADR-0001 §3 §5 lets the renderer pick at execution time.

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId, newCellId } from '../util/ids';

export type ComputationalKernel =
  | 'molab'
  | 'pyodide-inline'
  | 'remote-jupyter'
  | 'marimo-server';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    computationalCell: {
      insertComputationalCell: (
        kernel: ComputationalKernel,
        sourceCode: string,
      ) => ReturnType;
    };
  }
}

export const ComputationalCell = Node.create({
  name: 'computationalCell',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-block-id'),
        renderHTML: (attrs) => ({ 'data-block-id': attrs['blockId'] }),
      },
      cellId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-cell-id'),
        renderHTML: (attrs) => ({ 'data-cell-id': attrs['cellId'] }),
      },
      kernel: {
        default: 'molab',
        parseHTML: (el) => el.getAttribute('data-kernel'),
        renderHTML: (attrs) => ({ 'data-kernel': attrs['kernel'] }),
      },
      sourceCode: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-source') ?? '',
        renderHTML: (attrs) => ({ 'data-source': attrs['sourceCode'] }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'pre[data-pm-node="computational-cell"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'computational-cell',
        class: 'pm-node-computational-cell',
      }),
      0,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('pre');
      dom.classList.add('pm-node-computational-cell');
      dom.dataset['pmNode'] = 'computational-cell';
      dom.dataset['blockId'] = node.attrs['blockId'] ?? '';
      dom.dataset['cellId'] = node.attrs['cellId'] ?? '';
      dom.dataset['kernel'] = node.attrs['kernel'] ?? 'molab';
      const header = document.createElement('div');
      header.className = 'pm-node-computational-cell__header';
      header.textContent = `[${node.attrs['kernel'] ?? 'molab'} cell · ${
        (node.attrs['cellId'] as string | undefined)?.slice(0, 8) ?? '?'
      }]`;
      const code = document.createElement('code');
      code.textContent = node.attrs['sourceCode'] ?? '';
      dom.appendChild(header);
      dom.appendChild(code);
      return { dom };
    };
  },

  addCommands() {
    return {
      insertComputationalCell:
        (kernel: ComputationalKernel, sourceCode: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              blockId: newBlockId(),
              cellId: newCellId(),
              kernel,
              sourceCode,
            },
          });
        },
    };
  },
});
