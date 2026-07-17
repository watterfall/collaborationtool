// Wave A1 — pure-logic tests for the vault surface's lib helpers:
// base64 ↔ bytes (Y.Doc state travels base64 over the vault-host RPC)
// and "vault-host://event" payload parsing (Rust forwards host ndjson
// event lines verbatim; the parser must accept both wrapped and bare
// shapes and reject malformed input).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { base64ToBytes, bytesToBase64 } from '../src/lib/bytes';
import {
  parseVaultHostEvent,
  VAULT_HOST_EVENT,
} from '../src/lib/vault-events';

describe('bytes base64 round-trip', () => {
  it('round-trips binary content including high bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255, 66]);
    const encoded = bytesToBase64(bytes);
    assert.deepEqual(Array.from(base64ToBytes(encoded)), Array.from(bytes));
  });

  it('round-trips the empty payload (brand-new markdown file)', () => {
    assert.equal(bytesToBase64(new Uint8Array(0)), '');
    assert.equal(base64ToBytes('').byteLength, 0);
  });

  it('handles chunk-boundary sizes without spread overflow', () => {
    const big = new Uint8Array(0x8000 + 17);
    for (let i = 0; i < big.length; i += 1) big[i] = i % 251;
    const round = base64ToBytes(bytesToBase64(big));
    assert.equal(round.byteLength, big.byteLength);
    assert.equal(round[0x8000 + 16], big[0x8000 + 16]);
  });
});

describe('parseVaultHostEvent', () => {
  const bare = { root: '/tmp/v', kind: 'change', path: 'notes.md' };

  it('parses the bare payload shape', () => {
    assert.deepEqual(parseVaultHostEvent(bare), bare);
  });

  it('parses the wrapped ndjson line shape from server.ts', () => {
    const wrapped = { event: 'vault-event', payload: bare };
    assert.deepEqual(parseVaultHostEvent(wrapped), bare);
  });

  it('accepts all three chokidar kinds and rejects others', () => {
    for (const kind of ['add', 'change', 'unlink']) {
      assert.equal(parseVaultHostEvent({ ...bare, kind })?.kind, kind);
    }
    assert.equal(parseVaultHostEvent({ ...bare, kind: 'rename' }), null);
  });

  it('rejects malformed input without throwing', () => {
    for (const raw of [null, undefined, 42, 'x', {}, { event: 'other' }]) {
      assert.equal(parseVaultHostEvent(raw), null);
    }
    assert.equal(
      parseVaultHostEvent({ event: 'vault-event', payload: { root: 1 } }),
      null,
    );
  });

  it('locks the Tauri event channel name to the Rust constant', () => {
    // apps/desktop/src-tauri/src/commands/vault_host.rs VAULT_HOST_EVENT
    assert.equal(VAULT_HOST_EVENT, 'vault-host://event');
  });
});
