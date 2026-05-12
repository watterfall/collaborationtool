// Phase 6 W2 — sign / verify contract.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateKeypair, sign, verify } from '../src/index';

describe('sign / verify', () => {
  it('verify(sign(msg, sk), msg, pk) === true', () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode('hello world');
    const sig = sign(msg, kp.secretKey);
    assert.equal(verify(sig, msg, kp.publicKey), true);
  });

  it('signature is 64 bytes', () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode('x');
    const sig = sign(msg, kp.secretKey);
    assert.equal(sig.length, 64);
  });

  it('signature is deterministic — same input → same signature', () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode('deterministic');
    const sig1 = sign(msg, kp.secretKey);
    const sig2 = sign(msg, kp.secretKey);
    assert.deepEqual(sig1, sig2);
  });

  it('tampered message → verify false (no throw)', () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode('original');
    const sig = sign(msg, kp.secretKey);
    const tampered = new TextEncoder().encode('originat'); // last byte changed
    assert.equal(verify(sig, tampered, kp.publicKey), false);
  });

  it('wrong public key → verify false', () => {
    const kpA = generateKeypair();
    const kpB = generateKeypair();
    const msg = new TextEncoder().encode('m');
    const sig = sign(msg, kpA.secretKey);
    assert.equal(verify(sig, msg, kpB.publicKey), false);
  });

  it('tampered signature → verify false (no throw)', () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode('m');
    const sig = sign(msg, kp.secretKey);
    // Flip first byte of sig
    const tamperedSig = new Uint8Array(sig);
    tamperedSig[0] = (tamperedSig[0]! ^ 0xff) & 0xff;
    assert.equal(verify(tamperedSig as typeof sig, msg, kp.publicKey), false);
  });

  it('malformed inputs → verify false (no throw)', () => {
    const kp = generateKeypair();
    const msg = new TextEncoder().encode('m');
    const shortSig = new Uint8Array(32); // too short
    assert.equal(verify(shortSig as Parameters<typeof verify>[0], msg, kp.publicKey), false);
  });
});
