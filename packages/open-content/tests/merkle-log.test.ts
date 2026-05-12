// Phase 6 W2 P2 — Merkle log chain contract.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildMerkleEntry,
  contentHash,
  verifyMerkleChain,
  verifyMerkleEntry,
  type MerkleChainRow,
  type EntityKind,
} from '../src/index';

// Always-pass / always-fail verifier stubs.
const okVerifier = () => true;
const failVerifier = () => false;

describe('buildMerkleEntry', () => {
  it('produces a row ready for INSERT with computed contentHash', () => {
    const payload = { kind: 'open_question', question: 'P=NP?', ts: '2026-05-12T00:00:00Z' };
    const entry = buildMerkleEntry({
      id: 'merkle-1',
      prevEntryId: null,
      entityKind: 'open_question',
      entityId: 'q-1',
      payload,
      signedJws: 'eyJ.x.y',
      signerPrincipalId: 'principal:jili',
    });
    assert.equal(entry.id, 'merkle-1');
    assert.equal(entry.prevEntryId, null);
    assert.equal(entry.entityKind, 'open_question');
    assert.equal(entry.entityId, 'q-1');
    assert.deepEqual(entry.contentHash, contentHash(payload));
    assert.equal(entry.signedJws, 'eyJ.x.y');
    assert.equal(entry.signerPrincipalId, 'principal:jili');
  });

  it('contentHash differs by payload semantics, not key order', () => {
    const e1 = buildMerkleEntry({
      id: '1', prevEntryId: null, entityKind: 'open_question', entityId: 'q',
      payload: { a: 1, b: 2 }, signedJws: 'x', signerPrincipalId: 'p',
    });
    const e2 = buildMerkleEntry({
      id: '2', prevEntryId: null, entityKind: 'open_question', entityId: 'q',
      payload: { b: 2, a: 1 }, signedJws: 'x', signerPrincipalId: 'p',
    });
    assert.deepEqual(e1.contentHash, e2.contentHash);
  });
});

describe('verifyMerkleEntry — single row contract', () => {
  it('valid when content_hash matches + signature valid', () => {
    const payload = { kind: 'open_dataset', title: 'T' };
    const stored = contentHash(payload);
    const r = verifyMerkleEntry({
      storedContentHash: stored,
      payload,
      signedJws: 'sig',
      signatureVerifier: okVerifier,
    });
    assert.equal(r.valid, true);
  });

  it('invalid when content_hash byte mismatch (tampered row)', () => {
    const payload = { kind: 'open_dataset', title: 'T' };
    const stored = new Uint8Array(contentHash(payload));
    stored[0] = (stored[0]! ^ 0xff) & 0xff; // flip first byte
    const r = verifyMerkleEntry({
      storedContentHash: stored,
      payload,
      signedJws: 'sig',
      signatureVerifier: okVerifier,
    });
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /content_hash byte mismatch/);
  });

  it('invalid when content_hash length mismatch', () => {
    const payload = { x: 1 };
    const r = verifyMerkleEntry({
      storedContentHash: new Uint8Array(16), // wrong length
      payload,
      signedJws: 'sig',
      signatureVerifier: okVerifier,
    });
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /content_hash length mismatch/);
  });

  it('invalid when signature verifier returns false', () => {
    const payload = { x: 1 };
    const stored = contentHash(payload);
    const r = verifyMerkleEntry({
      storedContentHash: stored,
      payload,
      signedJws: 'sig',
      signatureVerifier: failVerifier,
    });
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /signed_jws verify failed/);
  });

  it('invalid when signature verifier throws (caught + reported)', () => {
    const payload = { x: 1 };
    const stored = contentHash(payload);
    const r = verifyMerkleEntry({
      storedContentHash: stored,
      payload,
      signedJws: 'sig',
      signatureVerifier: () => {
        throw new Error('jwks fetch failed');
      },
    });
    assert.equal(r.valid, false);
    if (!r.valid) assert.match(r.reason, /signature verifier threw/);
  });
});

// ---------- Chain integrity ----------

function makeRow(
  id: string,
  prevEntryId: string | null,
  entrySeq: bigint,
  entityKind: EntityKind = 'open_question',
): MerkleChainRow {
  return {
    id,
    prevEntryId,
    entrySeq,
    contentHash: contentHash({ id, kind: entityKind }),
  };
}

describe('verifyMerkleChain — chain integrity', () => {
  it('empty log → trivially OK, 0 anomalies', () => {
    const r = verifyMerkleChain([]);
    assert.equal(r.totalRows, 0);
    assert.equal(r.genesisId, null);
    assert.deepEqual(r.anomalies, []);
  });

  it('single genesis row → OK', () => {
    const r = verifyMerkleChain([makeRow('g', null, 1n)]);
    assert.equal(r.totalRows, 1);
    assert.equal(r.genesisId, 'g');
    assert.deepEqual(r.anomalies, []);
  });

  it('5-row valid chain → OK', () => {
    const rows = [
      makeRow('a', null, 1n),
      makeRow('b', 'a', 2n),
      makeRow('c', 'b', 3n),
      makeRow('d', 'c', 4n),
      makeRow('e', 'd', 5n),
    ];
    const r = verifyMerkleChain(rows);
    assert.equal(r.totalRows, 5);
    assert.equal(r.genesisId, 'a');
    assert.deepEqual(r.anomalies, []);
  });

  it('handles rows passed out of order (sorts by entry_seq)', () => {
    const rows = [
      makeRow('d', 'c', 4n),
      makeRow('a', null, 1n),
      makeRow('e', 'd', 5n),
      makeRow('b', 'a', 2n),
      makeRow('c', 'b', 3n),
    ];
    const r = verifyMerkleChain(rows);
    assert.deepEqual(r.anomalies, []);
  });

  it('detects no-genesis (every row has prev) — tampering signal', () => {
    const rows = [
      makeRow('a', 'b', 1n),
      makeRow('b', 'a', 2n),
    ];
    const r = verifyMerkleChain(rows);
    assert.ok(r.anomalies.some((a) => /no genesis row/.test(a.reason)));
  });

  it('detects multiple genesis rows', () => {
    const rows = [
      makeRow('g1', null, 1n),
      makeRow('g2', null, 2n),
    ];
    const r = verifyMerkleChain(rows);
    assert.ok(r.anomalies.some((a) => /multiple genesis rows/.test(a.reason)));
  });

  it('detects duplicate entry_seq (UNIQUE INDEX violation surfaced)', () => {
    // Two rows with same entry_seq — would normally be blocked by the
    // UNIQUE INDEX at DB level, but if the index were dropped or a
    // backup-restore raced, verify catches the duplicate. (After sort,
    // duplicate seq violates strict monotonicity.)
    const rows = [
      makeRow('a', null, 1n),
      makeRow('b', 'a', 1n), // <-- same seq as a
    ];
    const r = verifyMerkleChain(rows);
    assert.ok(r.anomalies.some((a) => /not strictly monotonic/.test(a.reason)));
  });

  it('detects prev pointing to non-existent row', () => {
    const rows = [
      makeRow('a', null, 1n),
      makeRow('b', 'ghost-row', 2n),
    ];
    const r = verifyMerkleChain(rows);
    assert.ok(r.anomalies.some((a) => /non-existent row/.test(a.reason)));
  });

  it('detects prev pointing to a future row (out-of-order chain link)', () => {
    const rows = [
      makeRow('a', 'b', 1n), // a points to b but b comes later
      makeRow('b', null, 2n), // b is supposedly genesis
    ];
    const r = verifyMerkleChain(rows);
    // Should detect: a's prev=b which has entry_seq 2 > a's entry_seq 1
    assert.ok(
      r.anomalies.some((a) => /later or equal entry_seq|non-existent row|no genesis/.test(a.reason)),
    );
  });
});
