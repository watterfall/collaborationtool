// y-sweet-backed BodyBackend.
//
// Per active document, the gateway maintains:
//   - a server-side Y.Doc that mirrors the document body
//   - a y-websocket connection to y-sweet (so y-sweet persists to S3
//     and broadcasts to other gateway instances)
//
// Flow on a client write:
//   1. DocRoom calls persist({ bytes }) — the bytes ARE a Yjs update.
//   2. We Y.applyUpdate(ydoc, bytes, 'gateway-local').
//   3. y-websocket-provider sees the local change and pushes to y-sweet.
//   4. y-sweet persists to S3 and rebroadcasts to other gateway peers.
//
// Flow on a peer write (different gateway instance):
//   1. y-sweet sends update to our y-websocket-provider.
//   2. ydoc applies update with origin = the provider awareness object.
//   3. We emit via onExternalUpdate so DocRoom broadcasts to our local
//      members.
//
// Phase 1 D11 known limitation: the cross-gateway broadcast path is not
// integration-tested in this commit because the test environment lacks
// a running y-sweet. Unit-test coverage proves URL composition + token
// handling; the live path is verified at deploy time per
// `apps/sync-gateway/README.md` "Verification".

import { WebSocket as NodeWebSocket } from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import type { YSweetClient } from '../y-sweet/client';
import type { BodyBackend, BodyUpdateRecord } from './types';

const LOCAL_ORIGIN = Symbol('y-sweet-backend.local');

export interface YSweetBackendOptions {
  documentId: string;
  client: YSweetClient;
  /** Optional: override the WebSocket impl for tests. */
  webSocketImpl?: typeof WebSocket;
  /**
   * Optional: callback when the y-sweet connection opens / closes /
   * fails. Surfaced so the gateway can degrade visibly (e.g. log).
   */
  onStatus?: (
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    detail?: string,
  ) => void;
}

export class YSweetBackend implements BodyBackend {
  private readonly documentId: string;
  private readonly client: YSweetClient;
  private readonly ydoc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private readonly listeners = new Set<(update: Uint8Array) => void>();
  private readonly onStatus: YSweetBackendOptions['onStatus'];
  private readonly webSocketImpl: typeof WebSocket;
  private updateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;
  private destroyed = false;
  private startedAt = 0;

  constructor(options: YSweetBackendOptions) {
    this.documentId = options.documentId;
    this.client = options.client;
    this.ydoc = new Y.Doc();
    this.webSocketImpl = options.webSocketImpl
      ?? (NodeWebSocket as unknown as typeof WebSocket);
    if (options.onStatus !== undefined) this.onStatus = options.onStatus;
  }

  /**
   * Open the y-websocket connection. Must be called before persist /
   * getState. Resolves when the provider reports `connected` (or rejects
   * after a brief timeout — the gateway will then surface the error).
   */
  async start(opts: { connectTimeoutMs?: number } = {}): Promise<void> {
    if (this.provider) return;
    this.startedAt = Date.now();

    const tokenInfo = await this.client.issueClientToken(this.documentId);
    // y-sweet's URL is fully formed: ws://host:port/d/<docId>?token=...
    // y-websocket's WebsocketProvider expects (serverUrl, roomName).
    // We split: serverUrl = base, roomName = the path tail. y-sweet
    // accepts both shapes — testing shows passing the full URL as
    // serverUrl + empty room works because y-websocket appends room
    // segment, and y-sweet routes by URL path. Phase 1.5 may switch to
    // y-sweet's own client SDK if their URL conventions tighten.
    const u = new URL(tokenInfo.url);
    // serverUrl: scheme + host + port (no path)
    const serverUrl = `${u.protocol}//${u.host}`;
    // roomName: path without leading slash + query (token)
    const roomName =
      u.pathname.replace(/^\/+/, '') + (u.search ? u.search : '');

    const provider = new WebsocketProvider(serverUrl, roomName, this.ydoc, {
      WebSocketPolyfill: this.webSocketImpl as unknown as never,
      connect: true,
    });
    this.provider = provider;

    provider.on('status', (e: { status: string }) => {
      if (this.destroyed) return;
      switch (e.status) {
        case 'connecting':
          this.onStatus?.('connecting');
          break;
        case 'connected':
          this.onStatus?.('connected');
          break;
        case 'disconnected':
          this.onStatus?.('disconnected');
          break;
      }
    });

    // Forward updates that arrive from y-sweet (NOT our own writes) to
    // listeners so DocRoom can broadcast to local members.
    this.updateHandler = (update, origin) => {
      if (this.destroyed) return;
      if (origin === LOCAL_ORIGIN) return;
      for (const l of this.listeners) l(update);
    };
    this.ydoc.on('update', this.updateHandler);

    // Wait until either connected or the timeout elapses.
    const timeoutMs = opts.connectTimeoutMs ?? 5_000;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`y-sweet connect timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const onStatus = (e: { status: string }): void => {
        if (e.status === 'connected') {
          cleanup();
          resolve();
        }
      };
      const cleanup = (): void => {
        clearTimeout(timer);
        provider.off('status', onStatus);
      };
      provider.on('status', onStatus);
    });
  }

  persist(update: BodyUpdateRecord): void {
    if (!this.provider) {
      throw new Error('YSweetBackend.persist before start()');
    }
    Y.applyUpdate(this.ydoc, update.bytes, LOCAL_ORIGIN);
  }

  async getState(): Promise<Uint8Array | null> {
    // y-sweet has already pushed the doc state to our local Y.Doc on
    // start. encodeStateAsUpdate dumps it. If the doc is still empty
    // (first user creates it) we return a minimal empty update so the
    // joiner gets a "blank" state rather than null.
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  onExternalUpdate(listener: (update: Uint8Array) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.ydoc && this.updateHandler) {
      this.ydoc.off('update', this.updateHandler);
    }
    this.updateHandler = null;
    if (this.provider) {
      try {
        this.provider.destroy();
      } catch {
        /* ignore */
      }
      this.provider = null;
    }
    this.ydoc.destroy();
    this.listeners.clear();
  }

  // ----- test affordances -----

  get age(): number {
    return Date.now() - this.startedAt;
  }
}
