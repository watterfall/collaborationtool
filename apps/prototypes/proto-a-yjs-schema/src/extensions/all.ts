// Bundle all custom extensions for the proto-a editor.
// Order matters: marks before the Mark-using extensions; nodes in any order.

import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import History from '@tiptap/extension-history';

import { Equation } from './equation';
import { InlineEquation } from './inline-equation';
import { CitationRef } from './citation-ref';
import { DatasetRef } from './dataset-ref';
import { ComputationalCell } from './computational-cell';
import { AnnotationAnchor } from './annotation-anchor';
import { Figure, FigureCaption } from './figure';
import { FootnoteRef } from './footnote-ref';

export const PROTO_A_EXTENSIONS = [
  // Core PM nodes
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3] }),
  Bold,
  Italic,
  History,

  // Marks
  AnnotationAnchor,

  // Block atoms
  Equation,
  ComputationalCell,
  Figure,
  FigureCaption,

  // Inline atoms
  InlineEquation,
  CitationRef,
  DatasetRef,
  FootnoteRef,
];
