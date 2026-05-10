// Phase 1 D10 sync setup — wires Y.Doc + IndexedDB + sync-gateway
// transport into a single bundle. apps/web's Editor component consumes
// this; tests can construct the transport directly without IndexedDB.
//
// Compared to proto-a/src/sync/setup-sync.ts:
//   - Drops y-websocket (proto-a's prototype relay)
//   - Talks our sync-gateway wire format directly
//   - Same IndexedDB bootstrap so offline edits survive a tab reload

import { IndexeddbPersistence } from 'y-indexeddb';

import {
  DocStore,
  type DocumentHandle,
} from '@collaborationtool/doc-store';

import {
  SyncGatewayTransport,
  type SyncGatewayTransportOptions,
} from './sync-gateway-transport';

export interface SetupSyncOptions extends SyncGatewayTransportOptions {
  /**
   * IndexedDB room name. Phase 1 convention: `doc-${documentId}` so each
   * document gets its own object store. Phase 2 might shard further by
   * principalId for multi-tenant local stores.
   */
  indexedDbRoom?: string;
  /**
   * Optional shared DocStore (multi-tab / SSR-safe scenarios). Defaults
   * to a fresh per-call store — same behaviour as pre-W7.1 setupSync.
   */
  docStore?: DocStore;
}

export interface SyncBundle {
  /** Phase 4 W7.1: abstract handle. */
  handle: DocumentHandle;
  /**
   * Backwards-compat escape hatch — same Y.Doc that handle.yDoc returns.
   * Editor.tsx still passes this to TipTap Collaboration extension; the
   * field is kept until y-prosemirror Collaboration itself consumes the
   * abstract handle (Phase 5 follow-up).
   */
  ydoc: DocumentHandle['yDoc'];
  persistence: IndexeddbPersistence;
  transport: SyncGatewayTransport;
  /** Resolves once IndexedDB is hydrated (NOT once gateway is open). */
  ready: Promise<void>;
  destroy(): void;
}

export function setupSync(options: SetupSyncOptions): SyncBundle {
  const store = options.docStore ?? new DocStore();
  const handle = store.getDocument(options.documentId);
  const room = options.indexedDbRoom ?? `doc-${options.documentId}`;
  const persistence = new IndexeddbPersistence(room, handle.yDoc);

  const transport = new SyncGatewayTransport(options);
  transport.connect(handle);

  const ready = new Promise<void>((resolve) => {
    persistence.once('synced', () => resolve());
  });

  let destroyed = false;
  return {
    handle,
    ydoc: handle.yDoc,
    persistence,
    transport,
    ready,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      transport.destroy();
      persistence.destroy();
      // Owned by the supplied DocStore (or the per-call default).
      store.releaseDocument(options.documentId);
    },
  };
}
