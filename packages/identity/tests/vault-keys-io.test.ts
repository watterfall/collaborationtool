// Phase 6 W2 — vault keys read/write contract.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  KEYPAIR_FILE,
  ORCID_LINK_FILE,
  PUBLIC_KEY_FILE,
  VAULT_KEYS_DIR,
  encryptKeypair,
  generateKeypair,
  keysDir,
  readEncryptedKeypair,
  readOrcidLink,
  writeEncryptedKeypair,
  writeOrcidLink,
  type OrcidLink,
} from '../src/index';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'identity-vault-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const FAST_KDF = { t: 1, m: 1024, p: 1, dkLen: 32 };

describe('keysDir + paths', () => {
  it('keysDir resolves under .vault/keys/', () => {
    assert.equal(keysDir('/foo/MyVault'), '/foo/MyVault/.vault/keys');
  });

  it('VAULT_KEYS_DIR is .vault/keys', () => {
    assert.equal(VAULT_KEYS_DIR, '.vault/keys');
  });

  it('file names are stable', () => {
    assert.equal(KEYPAIR_FILE, 'identity.json');
    assert.equal(PUBLIC_KEY_FILE, 'ed25519.pub');
    assert.equal(ORCID_LINK_FILE, 'orcid.link.json');
  });
});

describe('writeEncryptedKeypair / readEncryptedKeypair', () => {
  it('writes identity.json + ed25519.pub atomically', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    await writeEncryptedKeypair(dir, enc);

    const identityPath = join(keysDir(dir), KEYPAIR_FILE);
    const pubPath = join(keysDir(dir), PUBLIC_KEY_FILE);
    await assert.doesNotReject(stat(identityPath));
    await assert.doesNotReject(stat(pubPath));

    // No .tmp leftover
    await assert.rejects(stat(`${identityPath}.tmp`));
  });

  it('ed25519.pub contains plaintext "ed25519:<hex>\\n"', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    await writeEncryptedKeypair(dir, enc);
    const pub = await readFile(join(keysDir(dir), PUBLIC_KEY_FILE), 'utf8');
    assert.match(pub, /^ed25519:[0-9a-f]{64}\n$/);
  });

  it('readEncryptedKeypair returns null when no identity.json', async () => {
    assert.equal(await readEncryptedKeypair(dir), null);
  });

  it('readEncryptedKeypair round-trips JSON', async () => {
    const kp = generateKeypair();
    const enc = await encryptKeypair(kp, 'pp', { kdf: FAST_KDF });
    await writeEncryptedKeypair(dir, enc);
    const read = await readEncryptedKeypair(dir);
    assert.ok(read);
    assert.deepEqual(read, enc);
  });
});

describe('writeOrcidLink / readOrcidLink', () => {
  it('writes + reads orcid.link.json', async () => {
    const link: OrcidLink = {
      publicKey: 'ed25519:0000000000000000000000000000000000000000000000000000000000000000',
      orcidId: '0000-0002-1825-0097',
      signedJws: 'eyJhbGc.payload.signature',
      linkedAt: '2026-05-12T00:00:00Z',
    };
    await writeOrcidLink(dir, link);
    const read = await readOrcidLink(dir);
    assert.deepEqual(read, link);
  });

  it('readOrcidLink returns null when not present', async () => {
    assert.equal(await readOrcidLink(dir), null);
  });
});
