// Yjs setup for proto-a:
//   * Y.Doc per document
//   * y-indexeddb for local persistence (Local-first principle)
//   * y-webrtc for cross-tab sync (no backend needed for this prototype)
//
// Multiple browser tabs on the same origin will discover each other via
// the WebRTC signalling rooms; in practice this also works through
// BroadcastChannel for same-origin tabs without external signalling.

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';

export interface SyncBundle {
  ydoc: Y.Doc;
  persistence: IndexeddbPersistence;
  webrtc: WebrtcProvider;
  ready: Promise<void>;
  destroy(): void;
}

export interface SyncOptions {
  roomName: string;
  signalingServers?: string[];
}

const DEFAULT_SIGNALING = [
  // Public Yjs signalling servers; fine for prototype.
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com',
];

export function setupSync(opts: SyncOptions): SyncBundle {
  const ydoc = new Y.Doc();
  const persistence = new IndexeddbPersistence(opts.roomName, ydoc);
  const webrtc = new WebrtcProvider(opts.roomName, ydoc, {
    signaling: opts.signalingServers ?? DEFAULT_SIGNALING,
  });

  const ready = new Promise<void>((resolve) => {
    persistence.once('synced', () => resolve());
  });

  return {
    ydoc,
    persistence,
    webrtc,
    ready,
    destroy() {
      webrtc.destroy();
      persistence.destroy();
      ydoc.destroy();
    },
  };
}
