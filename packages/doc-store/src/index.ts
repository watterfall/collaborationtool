// Phase 4 W7.1 — @collaborationtool/doc-store entry point.
//
// Public surface:
//   - DocumentHandle / Disposable / UpdateCallback (abstract types)
//   - YjsDocumentHandle (default Yjs backend)
//   - DocStore (id → handle cache + lifecycle)
//   - openSubdocument / encodeSubdocumentState (ADR-0014 W5 helpers)
//
// History note for ADR-0001 §7 review log Phase 4 W7.1:
// doc-store 抽象迟到落地，原因是 Phase 1 决策推后到 Phase 4 W5
// subdocument trigger。这一版只 cover editor-core / sync-gateway 现有
// 使用，ai-runtime 的 Y.Map 收口推到 Phase 5。Loro 评估 (W10) 现在可以
// 基于真实的 DocumentHandle 接口对齐而不是想象。

export type {
  Disposable,
  DocumentHandle,
  UpdateCallback,
} from './types';

export { YjsDocumentHandle } from './yjs-backend';
export type { YjsDocumentHandleOptions } from './yjs-backend';

// Phase 6 W2-W3 (ADR-0017 §1.3) — filesystem-backed handle for desktop.
// Wraps a Y.Doc + sidecar (.vault/yjs/<id>.bin) + markdown twin.
// Markdown emit/parse are INJECTED via FileSystemHooks to avoid the
// doc-store ← editor-core ← vault-fs cycle (vault-fs depends on
// editor-core for paperSchema; doc-store stays purely CRDT).
export {
  FileSystemDocumentHandle,
  sidecarPath,
  markdownPath,
} from './filesystem-backend';
export type {
  FileSystemDocumentHandleOptions,
  FileSystemHooks,
} from './filesystem-backend';

export {
  DocStore,
} from './store';
export type {
  DocStoreOptions,
  CreateDocumentOptions,
} from './store';

export {
  openSubdocument,
  encodeSubdocumentState,
} from './subdocument';

// ---------- Yjs primitive re-exports (escape hatch) ----------
//
// Until ai-runtime + render emitters fully migrate (Phase 5), some call
// sites still need the raw Yjs constructors and free functions to talk
// to y-prosemirror, y-websocket, and y-sweet. Routing those through
// doc-store keeps a single import surface — when we swap to Loro /
// Automerge 3 we will know exactly which call sites need rework
// (anything that imported these primitives from doc-store).
//
// Direct `import * as Y from 'yjs'` is still permitted in tests of the
// doc-store package itself (the abstraction tests need the underlying
// types) but should not appear in editor-core / sync-gateway after
// W7.1.

export {
  Doc as YDoc,
  XmlElement as YXmlElement,
  XmlFragment as YXmlFragment,
  XmlText as YXmlText,
  Map as YMap,
  Text as YText,
  Array as YArray,
  applyUpdate as yApplyUpdate,
  encodeStateAsUpdate as yEncodeStateAsUpdate,
  encodeStateVector as yEncodeStateVector,
  transact as yTransact,
} from 'yjs';

