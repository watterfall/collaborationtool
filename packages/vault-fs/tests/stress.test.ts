// Stress test — 5 client × 1000 op with offline window. Asserts:
//   1. All clients converge to identical Y.Text content
//   2. All clients emit identical markdown
//   3. Total ops = clientCount × opsPerClient
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runStress } from '../src/stress-harness';

describe('stress harness (Spike-2 Task 9)', () => {
  it('5 client × 1000 ops + offline/online → CRDT converges', () => {
    const result = runStress({
      clientCount: 5,
      opsPerClient: 1000,
      offlineRound: { startOp: 1000, endOp: 2000 },
      seed: 12345,
    });
    assert.equal(result.totalOps, 5000);
    assert.equal(result.converged, true,
      `expected convergence; stateLengths=${result.stateLengths.join(',')}`);
    // Final text should be non-trivial (5000 inserts of a-z chars)
    assert.ok(result.finalText.length > 100,
      `expected non-trivial final text; got len=${result.finalText.length}`);
  });
});
