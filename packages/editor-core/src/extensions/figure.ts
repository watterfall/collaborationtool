// figure: block container with image + caption.
// Not atom — PM descends to render <img> + caption text.
//
// Phase 2 W4 (ADR-0007 §2): adds optional `sourceCellId` attr that
// points at a `computational_cell.id` — when set, the figure's image
// was produced by a molab cell execution (cell.executed payload). UI
// renders a "↪ regenerate" affordance + provenance link.
//
// Per ADR-0007 §2 "figure with attrs.sourceCellId — no new node type"
// (we reuse figure rather than introduce computational-output).

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      insertFigure: (src: string, captionText: string) => ReturnType;
      insertCellOutputFigure: (
        src: string,
        captionText: string,
        sourceCellId: string,
      ) => ReturnType;
    };
  }
}

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'figureCaption',
  defining: true,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-block-id'),
        renderHTML: (attrs) => ({ 'data-block-id': attrs['blockId'] }),
      },
      src: {
        default: '',
        parseHTML: (el) => el.querySelector('img')?.getAttribute('src') ?? '',
        renderHTML: (attrs) => ({ 'data-src': attrs['src'] }),
      },
      // Phase 2 W4 ADR-0007 §2: optional source cell pointer.
      sourceCellId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-source-cell-id'),
        renderHTML: (attrs) =>
          attrs['sourceCellId']
            ? { 'data-source-cell-id': attrs['sourceCellId'] }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-pm-node="figure"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'figure',
        class: 'pm-node-figure',
      }),
      ['img', { src: node.attrs['src'] ?? '', alt: '' }],
      ['div', { class: 'pm-node-figure-caption' }, 0],
    ];
  },

  addCommands() {
    return {
      insertFigure:
        (src: string, captionText: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { blockId: newBlockId(), src, sourceCellId: null },
            content: [
              {
                type: 'figureCaption',
                content: [{ type: 'text', text: captionText }],
              },
            ],
          });
        },

      insertCellOutputFigure:
        (src: string, captionText: string, sourceCellId: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { blockId: newBlockId(), src, sourceCellId },
            content: [
              {
                type: 'figureCaption',
                content: [{ type: 'text', text: captionText }],
              },
            ],
          });
        },
    };
  },
});

export const FigureCaption = Node.create({
  name: 'figureCaption',
  content: 'inline*',
  group: 'block',
  defining: true,

  parseHTML() {
    return [{ tag: 'figcaption' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figcaption', mergeAttributes(HTMLAttributes), 0];
  },
});
