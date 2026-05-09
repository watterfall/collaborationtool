// Sync-gateway wire format constants — must stay in lockstep with
// `apps/sync-gateway/src/doc-room.ts`. The values are duplicated here
// (rather than imported) because the editor-core can run in a browser
// where Node-only sync-gateway code is not bundleable. Keep BOTH in sync
// when adding a new frame kind.

export const FRAME_KIND = {
  BODY_UPDATE: 0x01,
  DRAFT_UPDATE: 0x02,
  MODE_SET: 0x03,
  UPDATE_REJECTED: 0x04,
  PING: 0x05,
  PONG: 0x06,
} as const;

export type FrameKind = (typeof FRAME_KIND)[keyof typeof FRAME_KIND];

export type ConnectionMode = 'reader' | 'proposer' | 'writer';

export interface DraftFrame {
  draftId: string;
  payload: Uint8Array;
}

/** Encode a body update frame. */
export function encodeBodyFrame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + payload.byteLength);
  out[0] = FRAME_KIND.BODY_UPDATE;
  out.set(payload, 1);
  return out;
}

/** Encode a draft update frame. */
export function encodeDraftFrame(
  draftId: string,
  payload: Uint8Array,
): Uint8Array {
  const idBytes = new TextEncoder().encode(draftId);
  const out = new Uint8Array(1 + 4 + idBytes.byteLength + payload.byteLength);
  out[0] = FRAME_KIND.DRAFT_UPDATE;
  // 4-byte big-endian length
  const dv = new DataView(out.buffer);
  dv.setUint32(1, idBytes.byteLength, false);
  out.set(idBytes, 5);
  out.set(payload, 5 + idBytes.byteLength);
  return out;
}

export function encodePongFrame(): Uint8Array {
  return new Uint8Array([FRAME_KIND.PONG]);
}

export interface DecodedFrame {
  kind: FrameKind;
  /** All bytes after the 1-byte kind. Caller decodes by kind. */
  payload: Uint8Array;
}

export function decodeFrame(data: Uint8Array): DecodedFrame {
  if (data.byteLength === 0) {
    return { kind: 0 as FrameKind, payload: new Uint8Array() };
  }
  const kind = data[0] as FrameKind;
  return { kind, payload: data.subarray(1) };
}

export function decodeDraftFrame(payload: Uint8Array): DraftFrame | null {
  if (payload.byteLength < 4) return null;
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const idLen = dv.getUint32(0, false);
  if (payload.byteLength < 4 + idLen) return null;
  const draftId = new TextDecoder().decode(payload.subarray(4, 4 + idLen));
  const body = payload.subarray(4 + idLen);
  return { draftId, payload: body };
}

export function decodeModeFrame(payload: Uint8Array): ConnectionMode | null {
  const text = new TextDecoder().decode(payload);
  if (text === 'reader' || text === 'proposer' || text === 'writer') {
    return text;
  }
  return null;
}

export function decodeRejectFrame(payload: Uint8Array): string {
  return new TextDecoder().decode(payload);
}

export function isConnectionMode(v: unknown): v is ConnectionMode {
  return v === 'reader' || v === 'proposer' || v === 'writer';
}
