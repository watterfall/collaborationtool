import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { DEFAULT_KDF_OPTS } from '@collaborationtool/identity';

import {
  loadOrCreateIdentity,
  signWithKeypair,
  toHex,
  verify,
} from '../src/index';

// Cheap KDF for tests only — production uses the intentionally-slow default.
const FAST_KDF = { ...DEFAULT_KDF_OPTS, t: 1, m: 256, p: 1 };

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test('loadOrCreateIdentity: generates + persists on first run, reloads same key on second', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-id-'));
  try {
    const first = await loadOrCreateIdentity(dir, 'correct horse', { kdf: FAST_KDF });
    assert.equal(first.created, true);
    assert.ok(await exists(join(dir, '.vault', 'keys', 'identity.json')));
    assert.ok(await exists(join(dir, '.vault', 'keys', 'ed25519.pub')));

    const second = await loadOrCreateIdentity(dir, 'correct horse', { kdf: FAST_KDF });
    assert.equal(second.created, false);
    assert.equal(toHex(second.keypair.publicKey), toHex(first.keypair.publicKey));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('signWithKeypair + verify: signature round-trips, tampered message fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-sign-'));
  try {
    const { keypair } = await loadOrCreateIdentity(dir, 'pw', { kdf: FAST_KDF });
    const message = new TextEncoder().encode('provenance entry #1');
    const signature = signWithKeypair(keypair, message);

    assert.equal(verify(signature, message, keypair.publicKey), true);
    const tampered = new TextEncoder().encode('provenance entry #2');
    assert.equal(verify(signature, tampered, keypair.publicKey), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
