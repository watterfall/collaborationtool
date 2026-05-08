// figure: block container with image + caption.
// Not atom — PM descends to render <img> + caption text. Phase 2 adds
// real image upload + cross-reference handle (figure label).

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      insertFigure: (src: string, captionText: string) => ReturnType;
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
            attrs: { blockId: newBlockId(), src },
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
