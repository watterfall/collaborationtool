// Per-document room. Tracks active subscribers + a Phase 1 stub for the
// document body (y-sweet wires up at D11). Proposers write to a separate
// draft buffer so reviewers/owners can still pull them, but their
// updates never enter the body buffer until accepted by D14 approval flow.
//
// IMPORTANT: this is NOT the persistent store. It exists only for the
// lifetime of the gateway process. D11 swaps the body update path to
// y-sweet (which persists to S3) and snapshot-worker handles PG dumps.

import type { WebSocket } from 'ws';

import type { ConnectionMode, PrincipalContext } from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

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

/**
 * In-process state for a single document. One instance per active doc.
 * Phase 1: we keep the last N body updates so a late-joining client can
 * receive them. Phase D11 replaces this with y-sweet's full history.
 */
export class DocRoom {
  readonly documentId: DocumentId;
  readonly members = new Set<RoomMember>();
  /** Phase 1 stub: last 100 body updates. */
  readonly bodyHistory: BodyUpdate[] = [];
  /** Phase 1: keep all draft updates until D14 accept/reject lands. */
  readonly drafts: DraftUpdate[] = [];

  private static readonly MAX_BODY_HISTORY = 100;

  constructor(documentId: DocumentId) {
    this.documentId = documentId;
  }

  addMember(m: RoomMember): void {
    this.members.add(m);
  }

  removeMember(m: RoomMember): void {
    this.members.delete(m);
  }

  /** Append a body update + broadcast to every other connected member. */
  applyBody(update: BodyUpdate, originator: RoomMember): void {
    this.bodyHistory.push(update);
    if (this.bodyHistory.length > DocRoom.MAX_BODY_HISTORY) {
      this.bodyHistory.shift();
    }
    for (const m of this.members) {
      if (m === originator) continue;
      // Only writer / proposer modes can be authors; readers receive.
      send(m.ws, encodeBodyMessage(update));
    }
  }

  /** Append a draft update. Phase 1 broadcast to everyone with block.review. */
  appendDraft(update: DraftUpdate, originator: RoomMember): void {
    this.drafts.push(update);
    for (const m of this.members) {
      if (m === originator) continue;
      // Phase 1 simplification: writers see drafts (so author can review).
      // Phase 1.5 will narrow this to `block.review` capability.
      if (m.mode === 'writer' || m.mode === 'proposer') {
        send(m.ws, encodeDraftMessage(update));
      }
    }
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
