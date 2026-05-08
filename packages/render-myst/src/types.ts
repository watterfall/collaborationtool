// MyST AST shape used internally. Subset of the official `myst-spec`
// (https://mystmd.org/spec) — Phase 1 keeps only the node kinds the
// editor actually emits. When mystmd's official transformer libraries
// land as deps in Phase 1.5, this file gets replaced with imports from
// `myst-spec` directly.

export type MystNode =
  | MystRoot
  | MystParagraph
  | MystHeading
  | MystText
  | MystEmphasis
  | MystStrong
  | MystMath
  | MystInlineMath
  | MystCite
  | MystCrossReference
  | MystFigure
  | MystImage
  | MystCaption
  | MystCodeBlock
  | MystBlockquote
  | MystList
  | MystListItem;

export interface MystRoot {
  type: 'root';
  children: MystNode[];
}

export interface MystParagraph {
  type: 'paragraph';
  children: MystInline[];
}

export interface MystHeading {
  type: 'heading';
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: MystInline[];
}

export interface MystBlockquote {
  type: 'blockquote';
  children: MystNode[];
}

export interface MystList {
  type: 'list';
  ordered: boolean;
  children: MystListItem[];
}

export interface MystListItem {
  type: 'listItem';
  children: MystNode[];
}

export interface MystText {
  type: 'text';
  value: string;
  /** Annotation marks applied to this run (bold / italic / annotation-anchor). */
  marks?: MystMark[];
}

export interface MystEmphasis {
  type: 'emphasis';
  children: MystInline[];
}

export interface MystStrong {
  type: 'strong';
  children: MystInline[];
}

export interface MystMath {
  type: 'math';
  value: string; // LaTeX
}

export interface MystInlineMath {
  type: 'inlineMath';
  value: string;
}

/** Phase 1: citation-ref atom node lands as a `cite` AST node. */
export interface MystCite {
  type: 'cite';
  citationId: string;
  label?: string;
  /** Phase 2 will expand to full CSL-JSON metadata via PG join. */
}

/** Cross-reference (figure/section/equation label). Phase 1 unused. */
export interface MystCrossReference {
  type: 'crossReference';
  identifier: string;
}

export interface MystFigure {
  type: 'figure';
  identifier?: string;
  children: MystNode[]; // image + caption
}

export interface MystImage {
  type: 'image';
  url: string;
  alt?: string;
}

export interface MystCaption {
  type: 'caption';
  children: MystInline[];
}

export interface MystCodeBlock {
  type: 'code';
  lang?: string;
  value: string;
}

export type MystInline =
  | MystText
  | MystEmphasis
  | MystStrong
  | MystInlineMath
  | MystCite
  | MystCrossReference;

export type MystMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'annotation-anchor'; anchorId: string };
