// Phase 1 sync-gateway — WebSocket server in front of (eventually) y-sweet.
//
// Hot path: client opens `wss://gateway/ws?docId=...&token=<JWT>`. We:
//   1. parseHandshakeQuery — pull docId + token from URL
//   2. authenticate — verifySyncToken, loadPrincipalContext, classify mode
//   3. accept WebSocket; send `mode_set` frame
//   4. on each frame: gateUpdate → forward / route / reject
//   5. heartbeat every HEARTBEAT_MS — re-load ACL, reclassify, kick if revoked
//   6. on close — remove from room
//
// Phase 1 deliberate omissions (deferred to later D-deliverables):
//   - y-sweet proxying (D11)
//   - Real revision row creation on draft (D14)
//   - PG snapshot worker integration (D11)
//   - TLS / reverse proxy (D16 + ADR-0004)

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
      onConnection(ws, ctx);
    });
  }

  function onConnection(ws: WebSocket, ctx: AuthContext): void {
    const room = getOrCreateRoom(ctx.documentId);

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

    // Phase 1: send body history so a late joiner sees prior state. D11
    // replaces this with y-sweet's protocol (state sync).
    for (const u of room.bodyHistory) {
      ws.send(
        Buffer.concat([Buffer.from([FRAME_KIND.BODY_UPDATE]), Buffer.from(u.bytes)]),
        { binary: true },
      );
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

  function getOrCreateRoom(documentId: DocumentId): DocRoom {
    let r = rooms.get(documentId);
    if (!r) {
      r = new DocRoom(documentId);
      rooms.set(documentId, r);
    }
    return r;
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
