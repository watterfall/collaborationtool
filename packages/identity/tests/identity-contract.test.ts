// Phase 6 W2 — end-to-end identity contract.
//
// Full flow that a Tauri client would follow on first launch:
//   1. generateKeypair()
//   2. encryptKeypair(kp, userPassphrase)
//   3. writeEncryptedKeypair(vaultRoot, enc)
//   ... user closes app ...
//   4. readEncryptedKeypair(vaultRoot) → enc
//   5. decryptKeypair(enc, userPassphrase) → kp
//   6. sign(payload, kp.secretKey) → publish flow
//   7. verify(sig, payload, kp.publicKey) by third party

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildOrcidLinkPayload,
  canonicaliseOrcidLinkPayload,
  decryptKeypair,
  encryptKeypair,
  generateKeypair,
  readEncryptedKeypair,
  sign,
  toHex,
  verify,
  writeEncryptedKeypair,
} from '../src/index';

const FAST_KDF = { t: 1, m: 1024, p: 1, dkLen: 32 };

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'identity-e2e-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('Full identity lifecycle (ADR-0018 §2.1)', () => {
  it('first-launch → restart → sign → third-party verify', async () => {
    // First launch
    const original = generateKeypair();
    const enc = await encryptKeypair(original, 'user passphrase', { kdf: FAST_KDF });
    await writeEncryptedKeypair(dir, enc);

    // Restart — fresh process would read identity.json then prompt for passphrase
    const readBack = await readEncryptedKeypair(dir);
    assert.ok(readBack);
    const restored = await decryptKeypair(readBack, 'user passphrase');
    assert.deepEqual(restored.secretKey, original.secretKey);

    // Sign a publish payload (e.g. open-question signed body, ADR-0018 §2.4)
    const publishPayload = JSON.stringify({
      kind: 'open_question',
      question: 'P = NP?',
      timestamp: '2026-05-12T00:00:00Z',
    });
    const msg = new TextEncoder().encode(publishPayload);
    const sig = sign(msg, restored.secretKey);

    // Third party with just the public key verifies
    assert.equal(verify(sig, msg, restored.publicKey), true);

    // Tampered payload — verify fails
    const tamperedMsg = new TextEncoder().encode(publishPayload + ' tampered');
    assert.equal(verify(sig, tamperedMsg, restored.publicKey), false);
  });

  it('ORCID link payload canonical bytes used for JWS', async () => {
    // Simulate the bind flow: server signs canonical bytes with ORCID JWS;
    // client also signs the same bytes with its ed25519 key (for own
    // .vault audit). Verifies the contract is well-defined.
    const kp = generateKeypair();
    const payload = buildOrcidLinkPayload({
      publicKey: kp.publicKey,
      orcidId: '0000-0002-1825-0097',
      issuedAt: '2026-05-12T00:00:00Z',
    });
    const canonical = canonicaliseOrcidLinkPayload(payload);

    // Client co-signs
    const clientSig = sign(canonical, kp.secretKey);
    assert.equal(verify(clientSig, canonical, kp.publicKey), true);

    // Canonical bytes match what we'd JSON.stringify directly
    const expected = JSON.stringify({
      publicKey: `ed25519:${toHex(kp.publicKey)}`,
      orcidId: '0000-0002-1825-0097',
      issuedAt: '2026-05-12T00:00:00Z',
    });
    assert.equal(new TextDecoder().decode(canonical), expected);
  });

  it('5 unique keypairs all sign + verify independently', async () => {
    // Stress: ensure generateKeypair → sign → verify works at scale.
    const N = 5;
    const kps = Array.from({ length: N }, () => generateKeypair());
    const msg = new TextEncoder().encode('shared message');

    for (let i = 0; i < N; i++) {
      const sig = sign(msg, kps[i]!.secretKey);
      assert.equal(verify(sig, msg, kps[i]!.publicKey), true);
      // Cross-verify must fail (sig from i can't verify with key j !== i)
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        assert.equal(verify(sig, msg, kps[j]!.publicKey), false);
      }
    }
  });
});
