// @collaborationtool/vault-fs — Phase 6 Spike-2 PoC.
// markdown ↔ Y.Doc reconcile + sidecar IO + file watch + 3-way merge.
// See docs/superpowers/specs/2026-05-11-client-first-pivot-design.md §4
// (vault-fs component) for the design.

export * from './_shared';
export * from './ydoc-to-markdown';
export * from './markdown-to-ydoc';
export * from './sidecar-io';
export * from './file-watcher';
// Tasks 6-7 fill these:
// export * from './markdown-to-ydoc';
// export * from './sidecar-io';
// export * from './file-watcher';
// export * from './drift-detector';
// export * from './three-way-merge';
