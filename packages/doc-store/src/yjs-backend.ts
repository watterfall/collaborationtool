// Phase 4 W7.1 — Yjs-backed DocumentHandle implementation.
//
// Default backend; matches what every existing call site already used
// (Y.Doc + getText/getMap/getXmlFragment/transact/encodeStateAsUpdate/
// applyUpdate). The wrapper is deliberately thin so that the byte-level
// behaviour is unchanged from pre-W7.1 callers.
//
// Subdocument behaviour (ADR-0014 W5):
//   - Each parent handle keeps a `Y.Map('__subdocs__')` mapping name →
//     child Y.Doc. y-prosemirror's prosemirrorJSONToYDoc, y-websocket
//     and y-sweet all leave clientId/state untouched on subdocs.
//   - getSubdocument(name) is idempotent: same name → same handle.
//   - Releasing the parent destroys the subdoc handles too. Tests cover
//     the lifecycle invariants.

import * as Y from 'yjs';

import type {
  Disposable,
  DocumentHandle,
  UpdateCallback,
} from './types';

const SUBDOC_MAP_KEY = '__doc_store_subdocs__';

export interface YjsDocumentHandleOptions {
  /** Stable identifier — used in logs and subdoc cache keys. */
  id: string;
  /** Optional pre-existing Y.Doc (e.g. one created by y-sweet provider). */
  yDoc?: Y.Doc;
}

export class YjsDocumentHandle implements DocumentHandle {
  readonly id: string;
  readonly yDoc: Y.Doc;
  private readonly subdocs = new Map<string, YjsDocumentHandle>();
  private destroyed = false;

  constructor(options: YjsDocumentHandleOptions) {
    this.id = options.id;
    this.yDoc = options.yDoc ?? new Y.Doc();
  }

  getText(name: string): Y.Text {
    return this.yDoc.getText(name);
  }

  getMap<T = unknown>(name: string): Y.Map<T> {
    return this.yDoc.getMap<T>(name);
  }

  getXmlFragment(name: string): Y.XmlFragment {
    return this.yDoc.getXmlFragment(name);
  }

  observe(callback: UpdateCallback): Disposable {
    const handler = (update: Uint8Array, origin: unknown): void => {
      callback(update, origin);
    };
    this.yDoc.on('update', handler);
    return {
      dispose: () => {
        this.yDoc.off('update', handler);
      },
    };
  }

  transact(fn: () => void, origin?: unknown): void {
    Y.transact(this.yDoc, fn, origin);
  }

  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.yDoc);
  }

  encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(this.yDoc);
  }

  encodeDelta(baseStateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.yDoc, baseStateVector);
  }

  applyUpdate(update: Uint8Array, origin?: unknown): void {
    Y.applyUpdate(this.yDoc, update, origin);
  }

  getSubdocument(name: string): DocumentHandle {
    const cached = this.subdocs.get(name);
    if (cached) return cached;

    // We track the subdoc child Y.Doc via a top-level Y.Map so that the
    // parent's CRDT state knows about it; this is the standard Yjs
    // pattern (see Yjs subdoc docs). If a child Y.Doc already exists in
    // the map we re-use it; otherwise we create a fresh one.
    const subdocMap = this.yDoc.getMap<Y.Doc>(SUBDOC_MAP_KEY);
    let childDoc = subdocMap.get(name);
    if (!childDoc) {
      childDoc = new Y.Doc();
      // Insert inside a transaction so the parent records the subdoc
      // birth in a single update (better for snapshot replay).
      Y.transact(this.yDoc, () => {
        subdocMap.set(name, childDoc!);
      });
    }

    const child = new YjsDocumentHandle({
      id: `${this.id}/${name}`,
      yDoc: childDoc,
    });
    this.subdocs.set(name, child);
    return child;
  }

  /**
   * Internal: release native resources. Call via DocStore.releaseDocument.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const child of this.subdocs.values()) child.destroy();
    this.subdocs.clear();
    this.yDoc.destroy();
  }
}
