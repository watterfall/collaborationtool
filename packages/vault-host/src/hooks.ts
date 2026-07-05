// The load-bearing seam: bind vault-fs's reconcile + IO primitives to the
// doc-store FileSystemHooks interface. doc-store shipped the `FileSystemHooks`
// abstraction (Phase 4 W7.1) expecting a caller to inject the concrete
// functions; vault-fs shipped exactly those functions (Spike-2). Nobody wired
// them together until now — this file is that wiring.
//
// doc-store 早就留好了 `FileSystemHooks` 注入点（Phase 4 W7.1），vault-fs 也
// 早就实现了对应的四个函数（Spike-2），但两者从未被接线到一起——这个文件就是
// 那条接线。

import type { FileSystemHooks } from '@collaborationtool/doc-store/filesystem';
import {
  emitMarkdown,
  parseMarkdown,
  readSidecar,
  writeSidecar,
} from '@collaborationtool/vault-fs';

/**
 * Build the concrete `FileSystemHooks` that a `FileSystemDocumentHandle`
 * needs, backed by vault-fs. All four functions are pure re-exports except
 * `parseMarkdown`, which vault-fs exposes with an optional second argument;
 * we adapt it to the single-argument shape doc-store expects.
 *
 * Note (multi-yjs): vault-fs and doc-store both depend on `yjs@^13.6.x`.
 * pnpm dedups these to a single physical copy, so the `Y.Doc` produced by
 * vault-fs is the same class doc-store consumes. If a future version bump
 * splits them, promote `yjs` to a shared peer dependency here.
 */
export function createFileSystemHooks(): FileSystemHooks {
  return {
    readSidecar,
    writeSidecar,
    emitMarkdown,
    parseMarkdown: (markdown: string) => parseMarkdown(markdown),
  };
}
