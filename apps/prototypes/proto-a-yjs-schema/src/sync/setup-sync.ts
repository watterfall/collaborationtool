// Yjs setup for proto-a:
//   * Y.Doc per document
//   * y-indexeddb for local persistence (Local-first principle)
//   * y-websocket for cross-tab / cross-browser sync via a local relay
//     (`pnpm proto-a:sync`, see server/sync-server.mjs)
//
// Same-origin tabs in the same browser also sync via BroadcastChannel
// (built into WebsocketProvider), so the dev server need only be running
// for cross-browser tests. Public signalling servers were dropped (D3
// follow-up P1) — Phase 1 will replace this relay with the real sync
// gateway, but the wire protocol stays the same.

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';

export interface SyncBundle {
  ydoc: Y.Doc;
  persistence: IndexeddbPersistence;
  websocket: WebsocketProvider;
  ready: Promise<void>;
  destroy(): void;
}

export interface SyncOptions {
  roomName: string;
  websocketUrl?: string;
}

const DEFAULT_WEBSOCKET_URL = 'ws://localhost:1234';

export function setupSync(opts: SyncOptions): SyncBundle {
  const ydoc = new Y.Doc();
  const persistence = new IndexeddbPersistence(opts.roomName, ydoc);
  const websocket = new WebsocketProvider(
    opts.websocketUrl ?? DEFAULT_WEBSOCKET_URL,
    opts.roomName,
    ydoc
  );

  const ready = new Promise<void>((resolve) => {
    persistence.once('synced', () => resolve());
  });

  return {
    ydoc,
    persistence,
    websocket,
    ready,
    destroy() {
      websocket.destroy();
      persistence.destroy();
      ydoc.destroy();
    },
  };
}
