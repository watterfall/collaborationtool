// annotation-anchor: inline mark (NOT atom node) so PM mark CRDT tracks
// the anchor as text moves. Per ADR-0001 §2.3.4: anchorId in Y; thread/comment in PG.

import { Mark, mergeAttributes } from '@tiptap/core';
import { newAnchorId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    annotationAnchor: {
      addAnnotationAnchor: (anchorId?: string) => ReturnType;
      removeAnnotationAnchor: () => ReturnType;
    };
  }
}

export const AnnotationAnchor = Mark.create({
  name: 'annotationAnchor',
  inclusive: false,

  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-anchor-id'),
        renderHTML: (attrs) => ({ 'data-anchor-id': attrs.anchorId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-pm-mark="annotation-anchor"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pm-mark': 'annotation-anchor',
        class: 'pm-mark-annotation-anchor',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      addAnnotationAnchor:
        (anchorId?: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, {
            anchorId: anchorId || newAnchorId(),
          });
        },
      removeAnnotationAnchor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
