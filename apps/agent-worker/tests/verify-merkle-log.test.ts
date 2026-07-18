// Nightly Merkle log verifier tests — Wave A4.3.
// Pure orchestrator (no PG): fixture rows exercise the 4 structural
// invariants + the optional per-entry signature verify path.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contentHash } from '@collaborationtool/open-content';

import {
  verifyMerkleLog,
  type LoadedMerkleRow,
} from '../src/verify-merkle-log';

const NOW = '2026-07-18T09:00:00.000Z';

function row(
  id: string,
  prevEntryId: string | null,
  entrySeq: number,
): LoadedMerkleRow {
  return {
    id,
    prevEntryId,
    entrySeq: BigInt(entrySeq),
    contentHash: new Uint8Array([1, 2, 3]),
    entityKind: 'open_question',
    entityId: `${id}-entity`,
    signedJws: `jws-${id}`,
    signerPrincipalId: 'user:alice',
  };
}

// A healthy linear chain: g → a → b.
const HEALTHY: LoadedMerkleRow[] = [
  row('g', null, 1),
  row('a', 'g', 2),
  row('b', 'a', 3),
];

describe('verifyMerkleLog — structural integrity', () => {
  it('reports healthy for a well-formed linear chain', () => {
    const report = verifyMerkleLog(HEALTHY, { now: NOW });
    assert.equal(report.healthy, true);
    assert.equal(report.totalRows, 3);
    assert.equal(report.genesisId, 'g');
    assert.deepEqual(report.structuralAnomalies, []);
    assert.equal(report.entryVerificationRan, false);
    assert.equal(report.checkedAt, NOW);
  });

  it('empty log is healthy (nothing published yet)', () => {
    const report = verifyMerkleLog([], { now: NOW });
    assert.equal(report.healthy, true);
    assert.equal(report.totalRows, 0);
    assert.equal(report.genesisId, null);
  });

  it('detects a fork — two rows sharing the same prev_entry_id', () => {
    const forked = [...HEALTHY, row('b2', 'a', 4)]; // b and b2 both point to a
    const report = verifyMerkleLog(forked, { now: NOW });
    assert.equal(report.healthy, false);
    assert.ok(
      report.structuralAnomalies.some((x) => /fork|same prev/i.test(x.reason)),
      `expected a fork anomaly, got ${JSON.stringify(report.structuralAnomalies)}`,
    );
  });

  it('detects multiple genesis rows', () => {
    const twoGenesis = [row('g', null, 1), row('g2', null, 2), row('a', 'g', 3)];
    const report = verifyMerkleLog(twoGenesis, { now: NOW });
    assert.equal(report.healthy, false);
    assert.ok(
      report.structuralAnomalies.some((x) => /genesis/i.test(x.reason)),
    );
  });

  it('detects a dangling prev pointer (prev references a missing row)', () => {
    const dangling = [row('g', null, 1), row('a', 'ghost', 2)];
    const report = verifyMerkleLog(dangling, { now: NOW });
    assert.equal(report.healthy, false);
    assert.ok(report.structuralAnomalies.length > 0);
  });

  it('detects duplicate entry_seq (non-monotonic — reordering / tampering)', () => {
    // verifyMerkleChain re-sorts by entry_seq (doesn't trust caller order),
    // so a plain descending list still sorts monotonic; the real detectable
    // tamper is two rows sharing the same seq.
    const dupSeq = [row('g', null, 1), row('a', 'g', 2), row('b', 'a', 2)];
    const report = verifyMerkleLog(dupSeq, { now: NOW });
    assert.equal(report.healthy, false);
    assert.ok(
      report.structuralAnomalies.some((x) => /monoton/i.test(x.reason)),
      `expected a monotonic anomaly, got ${JSON.stringify(report.structuralAnomalies)}`,
    );
  });
});

describe('verifyMerkleLog — optional per-entry signature verify', () => {
  it('runs the entry verifier when a resolver is supplied and flags a bad signature', () => {
    const report = verifyMerkleLog(HEALTHY, {
      now: NOW,
      entryResolver: (r) => {
        const payload = { entity: r.entityId };
        return {
          payload,
          // real content hash so verifyMerkleEntry reaches the sig step
          storedContentHash: contentHash(payload),
          signedJws: r.signedJws,
          signatureVerifier: (jws) => jws === 'jws-g', // only genesis "verifies"
        };
      },
    });
    assert.equal(report.entryVerificationRan, true);
    // a and b fail signature → healthy false, two entry anomalies
    assert.equal(report.healthy, false);
    assert.equal(report.entryAnomalies.length, 2);
    assert.ok(report.entryAnomalies.every((x) => /verify failed/i.test(x.reason)));
  });

  it('skips rows whose payload cannot be reconstructed (resolver returns null)', () => {
    const report = verifyMerkleLog(HEALTHY, {
      now: NOW,
      entryResolver: () => null,
    });
    assert.equal(report.entryVerificationRan, false);
    assert.equal(report.entryAnomalies.length, 0);
    assert.equal(report.healthy, true); // structural still healthy
  });

  it('a structurally-healthy chain with all signatures valid is healthy', () => {
    const report = verifyMerkleLog(HEALTHY, {
      now: NOW,
      entryResolver: (r) => {
        const payload = { entity: r.entityId };
        return {
          payload,
          storedContentHash: contentHash(payload),
          signedJws: r.signedJws,
          signatureVerifier: () => true,
        };
      },
    });
    assert.equal(report.entryVerificationRan, true);
    assert.equal(report.healthy, true);
    assert.deepEqual(report.entryAnomalies, []);
  });
});
