// Phase 1 D10 sync setup — wires Y.Doc + IndexedDB + sync-gateway
// transport into a single bundle. apps/web's Editor component consumes
// this; tests can construct the transport directly without IndexedDB.
//
// Compared to proto-a/src/sync/setup-sync.ts:
//   - Drops y-websocket (proto-a's prototype relay)
//   - Talks our sync-gateway wire format directly
//   - Same IndexedDB bootstrap so offline edits survive a tab reload

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

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
}

export interface SyncBundle {
  ydoc: Y.Doc;
  persistence: IndexeddbPersistence;
  transport: SyncGatewayTransport;
  /** Resolves once IndexedDB is hydrated (NOT once gateway is open). */
  ready: Promise<void>;
  destroy(): void;
}

export function setupSync(options: SetupSyncOptions): SyncBundle {
  const ydoc = new Y.Doc();
  const room = options.indexedDbRoom ?? `doc-${options.documentId}`;
  const persistence = new IndexeddbPersistence(room, ydoc);

  const transport = new SyncGatewayTransport(options);
  transport.connect(ydoc);

  const ready = new Promise<void>((resolve) => {
    persistence.once('synced', () => resolve());
  });

  let destroyed = false;
  return {
    ydoc,
    persistence,
    transport,
    ready,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      transport.destroy();
      persistence.destroy();
      ydoc.destroy();
    },
  };
}
