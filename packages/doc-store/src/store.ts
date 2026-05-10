// Phase 4 W7.1 — DocStore: id → DocumentHandle cache + lifecycle.
//
// Single ownership policy:
//   - Each documentId resolves to exactly one DocumentHandle in this
//     process. Concurrent callers share the same handle.
//   - createDocument(id) is idempotent — calling it twice with the same
//     id returns the existing handle. This matches the editor flow
//     where the seed path may race the sync bootstrap.
//   - releaseDocument(id) destroys the underlying Y.Doc and evicts from
//     the cache. The next getDocument(id) creates a fresh handle.

import type { DocumentHandle } from './types';
import { YjsDocumentHandle } from './yjs-backend';

export interface DocStoreOptions {
  /**
   * Optional factory override — useful for tests that want to inject a
   * non-Yjs handle. Default factory creates a YjsDocumentHandle.
   */
  factory?: (id: string) => DocumentHandle;
}

export interface CreateDocumentOptions {
  /**
   * Pre-existing handle to register under this id (e.g. when y-sweet
   * already produced a Y.Doc). If supplied, the factory is not invoked.
   */
  existing?: DocumentHandle;
}

export class DocStore {
  private readonly handles = new Map<string, DocumentHandle>();
  private readonly factory: (id: string) => DocumentHandle;

  constructor(options: DocStoreOptions = {}) {
    this.factory = options.factory ?? ((id) => new YjsDocumentHandle({ id }));
  }

  /** Returns the cached handle, or creates one via the configured factory. */
  getDocument(id: string): DocumentHandle {
    const cached = this.handles.get(id);
    if (cached) return cached;
    const handle = this.factory(id);
    this.handles.set(id, handle);
    return handle;
  }

  /**
   * Idempotent create. If the id is already registered, returns the
   * existing handle; otherwise creates one (optionally adopting an
   * `existing` instance for the y-sweet / external-provider case).
   */
  createDocument(id: string, opts: CreateDocumentOptions = {}): DocumentHandle {
    const cached = this.handles.get(id);
    if (cached) return cached;
    const handle = opts.existing ?? this.factory(id);
    this.handles.set(id, handle);
    return handle;
  }

  /** True when `id` is currently cached in this store. */
  has(id: string): boolean {
    return this.handles.has(id);
  }

  /**
   * Destroy and evict the handle for `id`. No-op if absent. After
   * release, getDocument(id) creates a fresh handle.
   */
  releaseDocument(id: string): void {
    const handle = this.handles.get(id);
    if (!handle) return;
    this.handles.delete(id);
    if (handle instanceof YjsDocumentHandle) {
      handle.destroy();
    }
  }

  /** Number of cached handles — for diagnostics / tests. */
  get size(): number {
    return this.handles.size;
  }
}
