// ProseMirror JSON tree shape — wire format between editor-core and the
// render-* packages.
//
// This is the headless, server-friendly PM JSON shape (no @tiptap/* or
// prosemirror-* imports). It corresponds to what `editor.getJSON()`
// produces in editor-core and what render-myst / render-typst consume.
//
// ADR-0005 §2.4 mandated extracting this from the per-package
// duplicates by Phase 1.5; this file is the result. Render packages
// re-export the types from their own index for ergonomic consumers.
//
// Stability: any breaking change here MUST come with a new ADR (see
// ADR-0005 §2.4 evolution rules).

/**
 * A single ProseMirror node in JSON form. Both block and inline nodes use
 * this shape; `text` is set on text leaves only, `content` holds children
 * for branch nodes, `marks` holds inline annotations on text leaves.
 */
export interface PmNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: PmMark[];
}

/**
 * A ProseMirror inline mark (bold / italic / annotation-anchor / ...).
 */
export interface PmMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * Top-level PM document input for renderers — `content` is left as
 * `unknown[]` so callers feeding `JSON.parse(...)` results don't need to
 * statically narrow the whole tree. Renderers narrow per-node internally.
 */
export interface PmDocInput {
  type: string;
  content?: unknown[];
}
