// Regression tests for the InMemoryBodyBackend — confirms the
// pre-D11 DocRoom semantics (ring buffer + concat replay) survive the
// refactor.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InMemoryBodyBackend } from '../src/backends/in-memory';

describe('InMemoryBodyBackend', () => {
  it('persists then surfaces state via getState()', async () => {
    const backend = new InMemoryBodyBackend();
    backend.persist({ bytes: new Uint8Array([0x01, 0x02]) });
    backend.persist({ bytes: new Uint8Array([0x03]) });
    const state = await backend.getState();
    assert.ok(state);
    assert.deepEqual(Array.from(state!), [0x01, 0x02, 0x03]);
  });

  it('returns null when nothing persisted', async () => {
    const backend = new InMemoryBodyBackend();
    assert.equal(await backend.getState(), null);
  });

  it('respects maxHistory ring buffer', async () => {
    const backend = new InMemoryBodyBackend({ maxHistory: 3 });
    backend.persist({ bytes: new Uint8Array([1]) });
    backend.persist({ bytes: new Uint8Array([2]) });
    backend.persist({ bytes: new Uint8Array([3]) });
    backend.persist({ bytes: new Uint8Array([4]) });
    assert.equal(backend.historySize, 3);
    const state = await backend.getState();
    // Oldest dropped, last 3 concatenated.
    assert.deepEqual(Array.from(state!), [2, 3, 4]);
  });

  it('onExternalUpdate registers + unregisters cleanly (never invoked here)', () => {
    const backend = new InMemoryBodyBackend();
    let called = 0;
    const off = backend.onExternalUpdate(() => {
      called += 1;
    });
    // In-memory backend has no external source — listener never fires.
    backend.persist({ bytes: new Uint8Array([1]) });
    off();
    assert.equal(called, 0);
  });

  it('close() empties history and is idempotent', async () => {
    const backend = new InMemoryBodyBackend();
    backend.persist({ bytes: new Uint8Array([1]) });
    await backend.close();
    assert.equal(backend.historySize, 0);
    // Second close is a no-op.
    await backend.close();
  });
});
