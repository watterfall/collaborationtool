// Phase 4 W7.1 — DocumentHandle abstract interface.
//
// Why this exists (read alongside ADR-0001 §5.D + ADR-0014 §subdocument):
//   - ADR-0001 §5.D promised Phase 1 ships with Yjs and that
//     `packages/doc-store` would buffer Loro / Automerge 3 evaluation in
//     Phase 4 W10 to a 1-2 week migration. The package never landed
//     until W7.1 because we deferred until Phase 4 W5 subdocument forced
//     us to handle parent/child Y.Doc lifecycle for real.
//   - The interface exposes ONLY the operations the rest of the
//     monorepo currently needs: text + map + xml fragment, transact,
//     observe, encode/apply state, plus subdocument support for ADR-0014.
//   - `yDoc` is intentional escape hatch: y-prosemirror, y-websocket,
//     y-sweet HTTP all take a raw Y.Doc; until we replace those (Phase
//     5+) the handle exposes the underlying instance. New call sites
//     should prefer the abstract surface so future backend swaps
//     (Loro, Automerge 3) need only a new YjsDocumentHandle-equivalent.
//
// What this is NOT:
//   - It is not a full Yjs facade — Y.XmlElement / Y.XmlText / Y.Array /
//     Y.UndoManager are not (yet) re-exported here. Reach through
//     `handle.yDoc` if you need them; the day we move off Yjs we will
//     port those call sites case-by-case.
//   - It is not an async / network surface. Persistence, websocket,
//     IndexedDB live in editor-core/sync and apps/sync-gateway. doc-store
//     is *only* the in-memory CRDT abstraction.

import type * as Y from 'yjs';

/** Subscription handle returned from observers. */
export interface Disposable {
  dispose(): void;
}

/** Callback invoked whenever the underlying CRDT receives an update. */
export type UpdateCallback = (update: Uint8Array, origin: unknown) => void;

/**
 * Abstract handle to a single collaborative document. The default
 * implementation (`YjsDocumentHandle`) wraps a `Y.Doc`; future
 * implementations may wrap Loro / Automerge 3 with the same surface.
 *
 * Lifetime: owned by `DocStore`. Do not call `yDoc.destroy()` directly;
 * use `DocStore.releaseDocument(id)` instead.
 */
export interface DocumentHandle {
  /** Stable identifier. Matches the documentId used to fetch the handle. */
  readonly id: string;

  /**
   * Underlying Y.Doc instance. **Integration-boundary escape hatch
   * ONLY** — allowed call sites (Phase 4.5 W1.1 codex review 2026-05-11
   * follow-up):
   *
   *   1. `apps/sync-gateway/src/backends/y-sweet.ts` — y-sweet HTTP
   *      provider takes a raw Y.Doc; replacement requires off-ramp from
   *      y-sweet.
   *   2. `packages/editor-core/src/sync/setup.ts` — `IndexeddbPersistence`
   *      + `WebsocketProvider` both take a raw Y.Doc; replacement
   *      requires off-ramp from y-indexeddb / y-websocket.
   *   3. `packages/editor-core/src/sync/setup.ts` — y-prosemirror's
   *      `ySyncPlugin(handle.yDoc)` binding (3rd-party PM binding).
   *
   * **Business logic MUST use the abstract API below** (`getText` /
   * `getMap` / `getXmlFragment` / `transact` / `observe` /
   * `encodeStateAsUpdate` / `encodeStateVector` / `encodeDelta` /
   * `applyUpdate`). The grep gate `grep -rn '\.yDoc\b' apps packages
   * --include='*.ts' | grep -v -E '(doc-store/src|sync/setup|sync-gateway/src/backends/y-sweet|tests/yjs-backend|tests/subdocument)'`
   * must return 0 results.
   *
   * Direct mutation is allowed but logically owned by this handle — do
   * not destroy it.
   */
  readonly yDoc: Y.Doc;

  /** Get (or create) a Yjs Y.Text by name. */
  getText(name: string): Y.Text;

  /** Get (or create) a Yjs Y.Map by name with typed values. */
  getMap<T = unknown>(name: string): Y.Map<T>;

  /** Get (or create) a Yjs Y.XmlFragment by name. */
  getXmlFragment(name: string): Y.XmlFragment;

  /** Subscribe to update events. Returns a Disposable; call .dispose() to unsubscribe. */
  observe(callback: UpdateCallback): Disposable;

  /** Atomic transaction. `origin` is forwarded to update observers. */
  transact(fn: () => void, origin?: unknown): void;

  /** Encode the entire CRDT state as a binary update for transport / persistence. */
  encodeStateAsUpdate(): Uint8Array;

  /** Encode only the state vector — sufficient to compute a delta. */
  encodeStateVector(): Uint8Array;

  /**
   * Encode a binary delta sufficient to advance a receiver whose state
   * vector matches `baseStateVector`. Equivalent to Yjs's
   * `encodeStateAsUpdate(doc, baseStateVector)` two-arg form; exposed
   * on the handle (Phase 4.5 W1.1) so commit-serialiser callers don't
   * reach through `.yDoc`.
   */
  encodeDelta(baseStateVector: Uint8Array): Uint8Array;

  /** Apply a remote update; mutates the doc in place. */
  applyUpdate(update: Uint8Array, origin?: unknown): void;

  /**
   * Get (or create) a child Yjs subdocument (ADR-0014). The returned
   * handle wraps a separate Y.Doc registered as a subdocument of this
   * one. Same `name` returns the same handle on subsequent calls.
   */
  getSubdocument(name: string): DocumentHandle;
}
