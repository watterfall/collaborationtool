// SyncGatewayTransport — bridges a Y.Doc to the D8 sync-gateway over the
// custom 1-byte-kind wire format documented in `wire.ts`. Browser-side.
//
// Lifecycle:
//   1. ctor: open WebSocket; wait for 'mode_set' frame to know our mode
//   2. observe(ydoc): on local Y.Doc updates → encode body frame → send
//      (writer) or draft frame → send (proposer); reader: drop with warn
//   3. inbound BODY_UPDATE → Y.applyUpdate(ydoc, payload)
//   4. inbound DRAFT_UPDATE → emit 'draft' event with draftId + bytes
//   5. inbound UPDATE_REJECTED → emit 'rejected' event (UI surfaces)
//   6. ping → reply pong
//   7. close: stop observing, drop pending sends

import * as Y from 'yjs';

import {
  FRAME_KIND,
  decodeDraftFrame,
  decodeFrame,
  decodeModeFrame,
  decodeRejectFrame,
  encodeBodyFrame,
  encodeDraftFrame,
  encodePongFrame,
  type ConnectionMode,
  type DraftFrame,
} from './wire';

export interface SyncGatewayTransportOptions {
  /** ws://gateway/ws — the gateway listens at /ws */
  url: string;
  documentId: string;
  /** JWT issued by apps/web /api/sync-token. */
  token: string;
  /** Optional WebSocket factory for tests. */
  webSocketImpl?: typeof WebSocket;
}

export type TransportEvent =
  | { type: 'open'; mode: ConnectionMode }
  | { type: 'close'; code: number; reason: string }
  | { type: 'error'; error: Error }
  | { type: 'mode-changed'; mode: ConnectionMode }
  | { type: 'rejected'; reason: string }
  | { type: 'draft'; draft: DraftFrame };

export type TransportListener = (e: TransportEvent) => void;

export class SyncGatewayTransport {
  private ws: WebSocket | null = null;
  private ydoc: Y.Doc | null = null;
  private updateHandler: ((u: Uint8Array, origin: unknown) => void) | null = null;
  private listeners = new Set<TransportListener>();
  private currentMode: ConnectionMode | null = null;
  private destroyed = false;
  private pendingDraftIds = new Set<string>();

  constructor(private readonly options: SyncGatewayTransportOptions) {}

  get mode(): ConnectionMode | null {
    return this.currentMode;
  }

  on(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Start the WebSocket and wire up Y.Doc updates. */
  connect(ydoc: Y.Doc): void {
    if (this.ws) throw new Error('SyncGatewayTransport already connected');
    this.ydoc = ydoc;

    const url = new URL(this.options.url);
    url.searchParams.set('docId', this.options.documentId);
    url.searchParams.set('token', this.options.token);

    const Impl = this.options.webSocketImpl ?? WebSocket;
    const ws = new Impl(url.toString());
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.addEventListener('message', (ev) => this.handleMessage(ev));
    ws.addEventListener('close', (ev) =>
      this.emit({
        type: 'close',
        code: ev.code,
        reason: typeof ev.reason === 'string' ? ev.reason : '',
      }),
    );
    ws.addEventListener('error', () =>
      this.emit({ type: 'error', error: new Error('websocket error') }),
    );

    // Send local Y.Doc updates to the gateway. `origin === this` skips
    // round-tripping our own remote applications.
    this.updateHandler = (update, origin) => {
      if (origin === this) return;
      this.send(update);
    };
    ydoc.on('update', this.updateHandler);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.ydoc && this.updateHandler) {
      this.ydoc.off('update', this.updateHandler);
    }
    this.updateHandler = null;
    this.ydoc = null;
    if (this.ws) {
      try {
        this.ws.close(1000, 'destroy');
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.listeners.clear();
  }

  /** True iff the underlying socket is OPEN. */
  isOpen(): boolean {
    return this.ws?.readyState === 1;
  }

  // ---------- internals ----------

  private send(update: Uint8Array): void {
    if (!this.ws || !this.isOpen()) return;
    if (this.currentMode === 'reader') {
      // Reader mode rejects writes server-side; don't even bother sending.
      return;
    }
    if (this.currentMode === 'proposer') {
      // Proposer: wrap in draft frame so the gateway routes to the draft
      // buffer. We generate a draftId here; the gateway echoes our own
      // draft back to other peers but not to us (origin filter).
      const draftId = newRandomDraftId();
      this.pendingDraftIds.add(draftId);
      this.ws.send(encodeDraftFrame(draftId, update));
      return;
    }
    // writer
    this.ws.send(encodeBodyFrame(update));
  }

  private handleMessage(ev: MessageEvent): void {
    if (!(ev.data instanceof ArrayBuffer)) {
      // Ignore string frames; gateway only sends binary.
      return;
    }
    const data = new Uint8Array(ev.data);
    const { kind, payload } = decodeFrame(data);
    switch (kind) {
      case FRAME_KIND.MODE_SET: {
        const mode = decodeModeFrame(payload);
        if (!mode) return;
        const isInitial = this.currentMode === null;
        this.currentMode = mode;
        if (isInitial) this.emit({ type: 'open', mode });
        else this.emit({ type: 'mode-changed', mode });
        return;
      }
      case FRAME_KIND.BODY_UPDATE: {
        if (this.ydoc) {
          // origin = this so our own update handler skips re-sending.
          Y.applyUpdate(this.ydoc, payload, this);
        }
        return;
      }
      case FRAME_KIND.DRAFT_UPDATE: {
        const draft = decodeDraftFrame(payload);
        if (!draft) return;
        // Filter out our own drafts that the gateway echoed back.
        if (this.pendingDraftIds.has(draft.draftId)) {
          this.pendingDraftIds.delete(draft.draftId);
          return;
        }
        this.emit({ type: 'draft', draft });
        return;
      }
      case FRAME_KIND.UPDATE_REJECTED: {
        this.emit({ type: 'rejected', reason: decodeRejectFrame(payload) });
        return;
      }
      case FRAME_KIND.PING: {
        if (this.ws && this.isOpen()) this.ws.send(encodePongFrame());
        return;
      }
      default:
        // Unknown frame kind — ignore for forward compatibility.
        return;
    }
  }

  private emit(event: TransportEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function newRandomDraftId(): string {
  // 12 random bytes hex; sufficient as a server-echo dedupe key.
  const buf = new Uint8Array(12);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  let hex = '';
  for (const b of buf) hex += b.toString(16).padStart(2, '0');
  return `local-${hex}`;
}
