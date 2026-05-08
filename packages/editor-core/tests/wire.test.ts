// Wire format encode/decode round-trip tests. Pure (no DOM, no PG).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FRAME_KIND,
  decodeDraftFrame,
  decodeFrame,
  decodeModeFrame,
  decodeRejectFrame,
  encodeBodyFrame,
  encodeDraftFrame,
  encodePongFrame,
} from '../src/sync/wire';

describe('wire format', () => {
  it('encodeBodyFrame prepends FRAME_KIND.BODY_UPDATE', () => {
    const payload = new Uint8Array([0x10, 0x20, 0x30]);
    const frame = encodeBodyFrame(payload);
    assert.equal(frame[0], FRAME_KIND.BODY_UPDATE);
    assert.deepEqual(Array.from(frame.subarray(1)), [0x10, 0x20, 0x30]);
  });

  it('decodeFrame splits kind from payload', () => {
    const data = new Uint8Array([FRAME_KIND.BODY_UPDATE, 0xa, 0xb, 0xc]);
    const { kind, payload } = decodeFrame(data);
    assert.equal(kind, FRAME_KIND.BODY_UPDATE);
    assert.deepEqual(Array.from(payload), [0xa, 0xb, 0xc]);
  });

  it('decodeFrame on empty input returns empty payload', () => {
    const { kind, payload } = decodeFrame(new Uint8Array());
    assert.equal(kind, 0);
    assert.equal(payload.byteLength, 0);
  });

  it('encodeDraftFrame round-trips through decodeDraftFrame', () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const frame = encodeDraftFrame('draft-abc-001', payload);
    assert.equal(frame[0], FRAME_KIND.DRAFT_UPDATE);

    const inner = frame.subarray(1);
    const decoded = decodeDraftFrame(inner);
    assert.ok(decoded);
    assert.equal(decoded.draftId, 'draft-abc-001');
    assert.deepEqual(Array.from(decoded.payload), [1, 2, 3, 4, 5]);
  });

  it('encodeDraftFrame handles UTF-8 draft ids (CJK)', () => {
    const payload = new Uint8Array([0xff]);
    const frame = encodeDraftFrame('修订-1', payload);
    const decoded = decodeDraftFrame(frame.subarray(1));
    assert.ok(decoded);
    assert.equal(decoded.draftId, '修订-1');
  });

  it('decodeDraftFrame returns null on truncated payload', () => {
    // 4-byte length says 100 but only 1 byte follows — short.
    const truncated = new Uint8Array([0, 0, 0, 100, 0xa]);
    assert.equal(decodeDraftFrame(truncated), null);
  });

  it('decodeModeFrame parses each ConnectionMode', () => {
    const enc = new TextEncoder();
    assert.equal(decodeModeFrame(enc.encode('reader')), 'reader');
    assert.equal(decodeModeFrame(enc.encode('proposer')), 'proposer');
    assert.equal(decodeModeFrame(enc.encode('writer')), 'writer');
  });

  it('decodeModeFrame rejects unknown mode strings', () => {
    const enc = new TextEncoder();
    assert.equal(decodeModeFrame(enc.encode('admin')), null);
    assert.equal(decodeModeFrame(enc.encode('')), null);
  });

  it('decodeRejectFrame decodes UTF-8 reason', () => {
    const enc = new TextEncoder();
    assert.equal(
      decodeRejectFrame(enc.encode('reader-cannot-write')),
      'reader-cannot-write',
    );
  });

  it('encodePongFrame is a single byte', () => {
    const f = encodePongFrame();
    assert.equal(f.length, 1);
    assert.equal(f[0], FRAME_KIND.PONG);
  });
});
