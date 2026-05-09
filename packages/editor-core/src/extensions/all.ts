// All extensions in a single bundle. Order matters:
//   - Document, Paragraph, Text first (PM schema requires them)
//   - Marks before nodes that use them
//   - Atoms in any order
//
// History is intentionally absent: the Collaboration extension wires its
// own undo/redo via Yjs UndoManager; TipTap warns if both are loaded.
// (proto-a D3 follow-up P3.)

import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import Heading from '@tiptap/extension-heading';
import Italic from '@tiptap/extension-italic';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

import { AnnotationAnchor } from './annotation-anchor';
import { CitationRef } from './citation-ref';
import { ComputationalCell } from './computational-cell';
import { DatasetRef } from './dataset-ref';
import { Equation } from './equation';
import { Figure, FigureCaption } from './figure';
import { FootnoteRef } from './footnote-ref';
import { InlineEquation } from './inline-equation';

/**
 * The Phase 1 paper schema as TipTap extensions. apps/web's editor and
 * the Phase D15 E2E tests both consume this; proto-a keeps a copy
 * because it's a frozen prototype.
 */
export const PAPER_SCHEMA_EXTENSIONS = [
  // Core PM nodes
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3] }),
  Bold,
  Italic,

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

// Re-export individual extensions for callers that need to swap one out.
export {
  AnnotationAnchor,
  CitationRef,
  ComputationalCell,
  DatasetRef,
  Equation,
  Figure,
  FigureCaption,
  FootnoteRef,
  InlineEquation,
};
