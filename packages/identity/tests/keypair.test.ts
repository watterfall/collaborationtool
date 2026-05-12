// Phase 6 W2 — keypair generate / encrypt / decrypt roundtrip.
// Uses faster KDF params (t=1, m=1024) for speed; production uses
// DEFAULT_KDF_OPTS (t=3, m=65536).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DecryptError,
  decryptKeypair,
  encryptKeypair,
  generateKeypair,
} from '../src/index';

const FAST_KDF = { t: 1, m: 1024, p: 1, dkLen: 32 };

describe('generateKeypair', () => {
  it('produces 32-byte secret + 32-byte public', () => {
    const kp = generateKeypair();
    assert.equal(kp.secretKey.length, 32);
    assert.equal(kp.publicKey.length, 32);
  });

  it('successive calls produce different keypairs', () => {
    const a = generateKeypair();
    const b = generateKeypair();
    assert.notDeepEqual(a.secretKey, b.secretKey);
    assert.notDeepEqual(a.publicKey, b.publicKey);
  });
});

describe('encryptKeypair / decryptKeypair roundtrip', () => {
  it('correct passphrase recovers secret key', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'my passphrase', { kdf: FAST_KDF });
    const restored = await decryptKeypair(enc, 'my passphrase');
    assert.deepEqual(restored.secretKey, kp.secretKey);
    assert.deepEqual(restored.publicKey, kp.publicKey);
  });

  it('wrong passphrase throws DecryptError', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'right passphrase', { kdf: FAST_KDF });
    await assert.rejects(
      decryptKeypair(enc, 'wrong passphrase'),
      (err) => err instanceof DecryptError,
    );
  });

  it('corrupted ciphertext throws DecryptError', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    // Flip a byte in the ciphertext
    const ct = enc.ciphertext;
    const flipped = ct.slice(0, 2) + (parseInt(ct.slice(2, 4), 16) ^ 0xff).toString(16).padStart(2, '0') + ct.slice(4);
    const tampered = { ...enc, ciphertext: flipped };
    await assert.rejects(decryptKeypair(tampered, 'pp'), (err) => err instanceof DecryptError);
  });

  it('encrypted shape stores publicKey with ed25519: prefix', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    assert.match(enc.publicKey, /^ed25519:[0-9a-f]{64}$/);
  });

  it('encrypted shape records argon2id KDF params', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    assert.equal(enc.kdf.algorithm, 'argon2id');
    assert.equal(enc.kdf.t, 1);
    assert.equal(enc.kdf.m, 1024);
    assert.equal(enc.kdf.p, 1);
  });

  it('encrypted shape JSON round-trips losslessly', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    const json = JSON.stringify(enc);
    const parsed = JSON.parse(json);
    const restored = await decryptKeypair(parsed, 'pp');
    assert.deepEqual(restored.secretKey, kp.secretKey);
  });

  it('rejects unsupported version', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    const bad = { ...enc, version: 99 } as unknown as Parameters<typeof decryptKeypair>[0];
    await assert.rejects(decryptKeypair(bad, 'pp'), (err) => err instanceof DecryptError);
  });
});
