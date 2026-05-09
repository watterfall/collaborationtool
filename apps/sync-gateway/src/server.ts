// Phase 1 sync-gateway — WebSocket server in front of y-sweet.
//
// Hot path: client opens `wss://gateway/ws?docId=...&token=<JWT>`. We:
//   1. parseHandshakeQuery — pull docId + token from URL
//   2. authenticate — verifySyncToken, loadPrincipalContext, classify mode
//   3. accept WebSocket; send `mode_set` frame
//   4. send the doc backlog from the body backend so the client catches up
//   5. on each frame: gateUpdate → forward / route / reject
//   6. heartbeat every HEARTBEAT_MS — re-load ACL, reclassify, kick if revoked
//   7. on close — remove from room
//
// Phase 1 D11: per-room body persistence is delegated to a
// `BodyBackend`. Default = InMemoryBodyBackend; YSWEET_URL/YSWEET_AUTH
// switch to the YSweetBackend (S3-compat persistence + cross-instance
// broadcast). See backends/README path.

import { createServer, type IncomingMessage, type Server } from 'node:http';

import { v7 as uuidv7 } from 'uuid';
import { WebSocketServer, type WebSocket } from 'ws';

import { loadPrincipalContext } from '@collaborationtool/permissions';
import { openDatabase, type Database } from '@collaborationtool/drizzle';
import type { DocumentId } from '@collaborationtool/schema';

import {
  CLOSE_CODES,
  authenticate,
  failureToCloseCode,
  type AuthContext,
} from './auth';
import {
  type BodyBackend,
  InMemoryBodyBackend,
  YSweetBackend,
} from './backends';
import { gateUpdate } from './capability-gate';
import {
  DocRoom,
  FRAME_KIND,
  decodeFrame,
  encodeModeSet,
  encodePing,
  encodeUpdateRejected,
  type RoomMember,
} from './doc-room';
import { type GatewayEnv, loadEnv } from './env';
import { YSweetClient } from './y-sweet/client';

export interface SyncGatewayHandle {
  close: () => Promise<void>;
  port: number;
  /** Test hook: list active rooms by documentId. */
  rooms: ReadonlyMap<DocumentId, DocRoom>;
}

export interface StartGatewayOptions {
  env?: GatewayEnv;
  /** Test hook: pre-built db. If absent, opens from env. */
  db?: Database;
  /** Test hook: bind to port 0 for an ephemeral port. */
  port?: number;
  /** Test hook: custom logger. Default → console. */
  logger?: { debug: Console['debug']; info: Console['info']; warn: Console['warn']; error: Console['error'] };
  /**
   * Test hook: build a backend for a given docId. Default behavior:
   * use YSweetBackend when env.ysweetUrl is set, else InMemoryBodyBackend.
   */
  bodyBackendFactory?: (documentId: DocumentId) => Promise<BodyBackend>;
}

export async function startGateway(
  options: StartGatewayOptions = {},
): Promise<SyncGatewayHandle> {
  const env = options.env ?? loadEnv();
  const dbHandle = options.db
    ? { db: options.db, close: async () => {} }
    : openDatabase({ url: env.databaseUrl });
  const log =
    options.logger ??
    {
      debug: env.logLevel === 'debug' ? console.debug : () => {},
      info: ['debug', 'info'].includes(env.logLevel) ? console.info : () => {},
      warn: env.logLevel !== 'error' ? console.warn : () => {},
      error: console.error,
    };

  const rooms = new Map<DocumentId, DocRoom>();

  const httpServer: Server = createServer((req, res) => {
    // Lightweight liveness probe; everything else upgrades to ws.
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: env.maxFrameBytes,
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', `http://${req.headers.host ?? ''}`).pathname;
    if (path !== '/ws') {
      socket.destroy();
      return;
    }
    void handleUpgrade(req, socket, head);
  });

  async function handleUpgrade(
    req: IncomingMessage,
    socket: NodeJS.WritableStream,
    head: Buffer,
  ): Promise<void> {
    const result = await authenticate(req, { env, db: dbHandle.db });
    if (!result.ok) {
      const code = failureToCloseCode(result.failure);
      log.warn('[handshake reject]', result.failure);
      // Reject before upgrade by closing socket. We could also
      // accept-then-immediately-close with a code, but plain TCP close
      // is cheaper and good enough for clients that read the HTTP 401.
      const body = JSON.stringify({ error: result.failure });
      try {
        socket.write(
          `HTTP/1.1 ${code === CLOSE_CODES.MALFORMED_URL ? '400 Bad Request' : '401 Unauthorized'}\r\n` +
            `content-type: application/json\r\n` +
            `content-length: ${Buffer.byteLength(body)}\r\n\r\n` +
            body,
        );
      } catch {
        /* socket may already be torn down */
      }
      try {
        socket.end();
      } catch {
        /* same */
      }
      return;
    }
    const ctx = result.context;
    wss.handleUpgrade(req, socket as never, head, (ws) => {
      void onConnection(ws, ctx);
    });
  }

  async function onConnection(ws: WebSocket, ctx: AuthContext): Promise<void> {
    let room: DocRoom;
    try {
      room = await getOrCreateRoom(ctx.documentId);
    } catch (err) {
      log.error('[backend init failed]', err);
      try {
        ws.close(CLOSE_CODES.NO_ACCESS, 'backend-unavailable');
      } catch {
        /* ignore */
      }
      return;
    }

    const member: RoomMember = {
      ws,
      principalId: ctx.principalId,
      mode: ctx.mode,
      principalContext: ctx.principalContext,
      jwtExpiresAt: ctx.jwtExpiresAt,
      aclExpiresAt: ctx.aclExpiresAt,
    };
    room.addMember(member);

    log.info('[connect]', {
      principalId: ctx.principalId,
      documentId: ctx.documentId,
      mode: ctx.mode,
    });

    // Tell the client which mode they got.
    ws.send(encodeModeSet(ctx.mode), { binary: true });

    // Send the doc backlog from the body backend so the client catches up.
    try {
      await room.sendBacklog(member);
    } catch (err) {
      log.warn('[backlog send failed]', err);
    }

    // ----- Heartbeat -----
    const heartbeat = setInterval(() => {
      void heartbeatTick(member, room);
    }, env.heartbeatMs);
    heartbeat.unref();

    ws.on('message', (data) => {
      void onFrame(member, room, data as Buffer | ArrayBuffer | Buffer[]);
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      room.removeMember(member);
      // Phase 1: don't drop empty rooms — process typically has dozens.
      log.info('[disconnect]', {
        principalId: ctx.principalId,
        documentId: ctx.documentId,
        remaining: room.members.size,
      });
    });

    ws.on('error', (err) => {
      log.warn('[ws error]', err);
    });
  }

  async function onFrame(
    member: RoomMember,
    room: DocRoom,
    raw: Buffer | ArrayBuffer | Buffer[],
  ): Promise<void> {
    const data = toBuffer(raw);
    const { kind, payload } = decodeFrame(data);

    if (kind === FRAME_KIND.PONG) {
      // pong noted; nothing else.
      return;
    }

    if (kind !== FRAME_KIND.BODY_UPDATE && kind !== FRAME_KIND.DRAFT_UPDATE) {
      // Ignore unknown frames silently — keeps the wire flexible for
      // future kinds without breaking older clients.
      return;
    }

    const outcome = gateUpdate({
      principalContext: member.principalContext,
      documentId: room.documentId,
      mode: member.mode,
      update: payload,
    });

    switch (outcome.kind) {
      case 'forward-to-body':
        room.applyBody(
          {
            bytes: payload,
            fromPrincipalId: member.principalId,
            receivedAt: new Date(),
          },
          member,
        );
        return;
      case 'route-to-draft':
        room.appendDraft(
          {
            bytes: payload,
            fromPrincipalId: member.principalId,
            receivedAt: new Date(),
            draftId: uuidv7(),
          },
          member,
        );
        return;
      case 'reject':
        member.ws.send(encodeUpdateRejected(outcome.reason), { binary: true });
        return;
    }
  }

  async function heartbeatTick(member: RoomMember, room: DocRoom): Promise<void> {
    const now = Date.now();
    if (member.jwtExpiresAt.getTime() <= now) {
      log.info('[heartbeat] jwt expired — closing', { p: member.principalId });
      member.ws.close(CLOSE_CODES.EXPIRED, 'jwt-expired');
      return;
    }
    // Phase 1: every heartbeat, reload ACL to catch revocations / role
    // changes within HEARTBEAT_MS. ADR-0002 §6 Bad/Trade-offs.
    const fresh = await loadPrincipalContext(
      dbHandle.db,
      member.principalId,
      room.documentId,
    );
    if (!fresh || !fresh.documentCapabilities.has('document.read')) {
      log.info('[heartbeat] ACL revoked — closing', { p: member.principalId });
      member.ws.close(CLOSE_CODES.REVOKED, 'acl-revoked');
      return;
    }
    member.principalContext = fresh;
    member.aclExpiresAt = fresh.expiresAt ?? null;
    // Mode could change (e.g. reviewer promoted to author).
    const next = classifyConnectionModeFromCaps(fresh.documentCapabilities);
    if (next && next !== member.mode) {
      member.mode = next;
      member.ws.send(encodeModeSet(next), { binary: true });
    }

    // Application-level ping — easier to debug than ws-level heartbeat.
    member.ws.send(encodePing(), { binary: true });
  }

  // ----- backend factory -----

  const ysweetClient =
    env.ysweetUrl && env.ysweetServerToken
      ? new YSweetClient({
          baseUrl: env.ysweetUrl,
          serverAuthToken: env.ysweetServerToken,
        })
      : null;

  const buildBackend =
    options.bodyBackendFactory ??
    (async (documentId: DocumentId): Promise<BodyBackend> => {
      if (ysweetClient) {
        const backend = new YSweetBackend({
          documentId,
          client: ysweetClient,
          onStatus: (status, detail) =>
            log.debug('[y-sweet]', { documentId, status, detail }),
        });
        await backend.start({
          connectTimeoutMs: env.ysweetConnectTimeoutMs,
        });
        return backend;
      }
      return new InMemoryBodyBackend();
    });

  // In-flight room creations are deduplicated so concurrent connections
  // for the same doc don't double-init the backend.
  const pendingRooms = new Map<DocumentId, Promise<DocRoom>>();

  async function getOrCreateRoom(documentId: DocumentId): Promise<DocRoom> {
    const existing = rooms.get(documentId);
    if (existing) return existing;
    const pending = pendingRooms.get(documentId);
    if (pending) return pending;

    const created = (async () => {
      const backend = await buildBackend(documentId);
      const room = new DocRoom(documentId, backend);
      rooms.set(documentId, room);
      return room;
    })();
    pendingRooms.set(documentId, created);
    try {
      return await created;
    } finally {
      pendingRooms.delete(documentId);
    }
  }

  await new Promise<void>((resolve, reject) => {
    const port = options.port ?? env.port;
    httpServer.once('error', reject);
    httpServer.listen(port, env.host, () => resolve());
  });
  const address = httpServer.address();
  const boundPort =
    typeof address === 'object' && address !== null ? address.port : env.port;

  log.info(`[boot] sync-gateway listening on ${env.host}:${boundPort}`);

  return {
    port: boundPort,
    rooms,
    close: async () => {
      wss.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      // Close backends so y-sweet WebSocket connections drain cleanly.
      await Promise.all(
        Array.from(rooms.values()).map((room) =>
          room.close().catch((err: unknown) => log.warn('[room close]', err)),
        ),
      );
      await dbHandle.close();
    },
  };
}

function toBuffer(raw: Buffer | ArrayBuffer | Buffer[]): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  return Buffer.concat(raw);
}

// Local re-export so server.ts doesn't import classifyConnectionMode
// directly — keeps the auth.ts boundary clean.
function classifyConnectionModeFromCaps(
  caps: ReadonlySet<string>,
): 'reader' | 'proposer' | 'writer' | null {
  if (!caps.has('document.read')) return null;
  if (caps.has('block.commit')) return 'writer';
  if (caps.has('block.propose')) return 'proposer';
  return 'reader';
}
