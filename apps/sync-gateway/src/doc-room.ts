// Per-document room. Tracks active subscribers + delegates body
// persistence to a BodyBackend (in-memory dev / y-sweet production —
// see `backends/`).
//
// Drafts (proposer mode) stay in-memory until D14 wires them to PG
// `revision` rows + the approval flow UI.

import type { WebSocket } from 'ws';

import type { ConnectionMode, PrincipalContext } from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import type { BodyBackend } from './backends/types';

export interface RoomMember {
  ws: WebSocket;
  principalId: PrincipalId;
  mode: ConnectionMode;
  principalContext: PrincipalContext;
  jwtExpiresAt: Date;
  aclExpiresAt: Date | null;
}

export interface BodyUpdate {
  bytes: Uint8Array;
  fromPrincipalId: PrincipalId;
  receivedAt: Date;
}

export interface DraftUpdate extends BodyUpdate {
  /** Synthetic ID — D14 will wire this to a real revision row. */
  draftId: string;
}

export class DocRoom {
  readonly documentId: DocumentId;
  readonly members = new Set<RoomMember>();
  readonly drafts: DraftUpdate[] = [];
  readonly backend: BodyBackend;

  /** Cleanup the backend's external-update listener registration. */
  private readonly unsubscribeExternal: () => void;

  constructor(documentId: DocumentId, backend: BodyBackend) {
    this.documentId = documentId;
    this.backend = backend;

    // Backend reports an update from outside this gateway (e.g. another
    // gateway instance pushing through y-sweet). Broadcast to local
    // members so they stay in sync.
    this.unsubscribeExternal = backend.onExternalUpdate((bytes) => {
      const synthetic: BodyUpdate = {
        bytes,
        fromPrincipalId: 'service:y-sweet' as PrincipalId,
        receivedAt: new Date(),
      };
      for (const m of this.members) {
        send(m.ws, encodeBodyMessage(synthetic));
      }
    });
  }

  addMember(m: RoomMember): void {
    this.members.add(m);
  }

  removeMember(m: RoomMember): void {
    this.members.delete(m);
  }

  /** Append a body update + broadcast to every other connected member. */
  applyBody(update: BodyUpdate, originator: RoomMember): void {
    void this.backend.persist({
      bytes: update.bytes,
      receivedAt: update.receivedAt,
    });
    for (const m of this.members) {
      if (m === originator) continue;
      send(m.ws, encodeBodyMessage(update));
    }
  }

  /** Replay current backend state to a freshly joined member. */
  async sendBacklog(member: RoomMember): Promise<void> {
    const state = await this.backend.getState();
    if (!state || state.byteLength === 0) return;
    const synthetic: BodyUpdate = {
      bytes: state,
      fromPrincipalId: 'service:backlog' as PrincipalId,
      receivedAt: new Date(),
    };
    send(member.ws, encodeBodyMessage(synthetic));
  }

  /** Append a draft update. Phase 1 broadcast to writer + proposer modes. */
  appendDraft(update: DraftUpdate, originator: RoomMember): void {
    this.drafts.push(update);
    for (const m of this.members) {
      if (m === originator) continue;
      // Phase 1 simplification: writers see drafts (so author can
      // review). Phase 1.5 narrows this to `block.review` capability.
      if (m.mode === 'writer' || m.mode === 'proposer') {
        send(m.ws, encodeDraftMessage(update));
      }
    }
  }

  async close(): Promise<void> {
    this.unsubscribeExternal();
    await this.backend.close();
  }
}

// ---------- Wire format ----------
//
// Phase 1 wire format is a tagged byte structure: 1 byte type prefix
// followed by payload. y-sweet will replace this in D11 with the y-sweet
// protocol; we keep the prefix scheme so capability-gate can sniff
// frame intent without parsing Yjs.
//
//   0x01 = body update (writer → server, server → all readers/proposers)
//   0x02 = draft update (proposer → server, server → writer/proposer)
//   0x03 = mode_set (server → client, sent at handshake)
//   0x04 = update_rejected (server → client, sent on gate.reject)
//   0x05 = ping (server → client, server-driven heartbeat)
//   0x06 = pong (client → server)

export const FRAME_KIND = {
  BODY_UPDATE: 0x01,
  DRAFT_UPDATE: 0x02,
  MODE_SET: 0x03,
  UPDATE_REJECTED: 0x04,
  PING: 0x05,
  PONG: 0x06,
} as const;

export function encodeBodyMessage(u: BodyUpdate): Buffer {
  const head = Buffer.from([FRAME_KIND.BODY_UPDATE]);
  return Buffer.concat([head, Buffer.from(u.bytes)]);
}

export function encodeDraftMessage(u: DraftUpdate): Buffer {
  const head = Buffer.from([FRAME_KIND.DRAFT_UPDATE]);
  // Phase 1 wire: 1-byte kind, 4-byte big-endian draftId length, draftId
  // utf-8 bytes, then payload.
  const idBytes = Buffer.from(u.draftId, 'utf8');
  const idLen = Buffer.alloc(4);
  idLen.writeUInt32BE(idBytes.length, 0);
  return Buffer.concat([head, idLen, idBytes, Buffer.from(u.bytes)]);
}

export function encodeModeSet(mode: ConnectionMode): Buffer {
  const head = Buffer.from([FRAME_KIND.MODE_SET]);
  const body = Buffer.from(mode, 'utf8');
  return Buffer.concat([head, body]);
}

export function encodeUpdateRejected(reason: string): Buffer {
  const head = Buffer.from([FRAME_KIND.UPDATE_REJECTED]);
  const body = Buffer.from(reason, 'utf8');
  return Buffer.concat([head, body]);
}

export function encodePing(): Buffer {
  return Buffer.from([FRAME_KIND.PING]);
}

export function decodeFrame(data: Buffer): {
  kind: number;
  payload: Buffer;
} {
  if (data.length === 0) return { kind: 0, payload: Buffer.alloc(0) };
  return { kind: data[0]!, payload: data.subarray(1) };
}

function send(ws: WebSocket, frame: Buffer): void {
  // ws.OPEN === 1
  if (ws.readyState === 1) ws.send(frame, { binary: true });
}
