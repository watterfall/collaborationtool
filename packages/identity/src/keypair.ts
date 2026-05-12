// ed25519 keypair generation + argon2id-derived passphrase encryption.
//
// Generate:
//   const kp = generateKeypair();
//   const enc = await encryptKeypair(kp, 'my passphrase');
//   // → write enc to .vault/keys/identity.json
//
// Restore:
//   const enc = readEncryptedKeypair('.vault/keys/identity.json');
//   const kp = await decryptKeypair(enc, 'my passphrase');
//   // → sign with kp.secretKey
//
// Wrong passphrase → DecryptError (poly1305 tag mismatch).
// Corrupt ciphertext → DecryptError.

import * as ed from '@noble/ed25519';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';

// Wire @noble/ed25519's sync sha512 (the lib is intentionally
// zero-dep — caller provides the hash). Done once at module load; sets
// `ed.etc.sha512Sync` globally so any subsequent sync `getPublicKey` /
// `sign` / `verify` call works.
ed.etc.sha512Sync = (...messages) => sha512(ed.etc.concatBytes(...messages));

import {
  DEFAULT_KDF_OPTS,
  DecryptError,
  fromHex,
  toHex,
  type Ed25519PublicKey,
  type Ed25519SecretKey,
  type EncryptedKeypair,
  type Keypair,
} from './_shared';

/**
 * Generate a fresh ed25519 keypair. Secret key is 32 random bytes,
 * public key derived via curve point multiplication. Pure JS; no
 * native deps.
 */
export function generateKeypair(): Keypair {
  const secretKey = ed.utils.randomPrivateKey() as Ed25519SecretKey;
  const publicKey = ed.getPublicKey(secretKey) as Ed25519PublicKey;
  return { publicKey, secretKey };
}

/**
 * Encrypt a Keypair's secret key with a passphrase. Public key is
 * stored alongside in plaintext (it's already public).
 *
 * Process:
 *   1. random salt (16 bytes)
 *   2. argon2id(passphrase, salt, default opts) → 32-byte encryption key
 *   3. random nonce (24 bytes for xchacha20)
 *   4. xchacha20poly1305(encryptionKey, nonce).encrypt(secretKey) → ciphertext + 16-byte poly1305 tag
 *
 * KDF is intentionally slow (~250ms on M1 default) to resist offline
 * brute-force. Tests pass a faster `opts` override.
 */
export async function encryptKeypair(
  kp: Keypair,
  passphrase: string,
  opts: { kdf?: typeof DEFAULT_KDF_OPTS } = {},
): Promise<EncryptedKeypair> {
  const kdf = opts.kdf ?? DEFAULT_KDF_OPTS;
  const salt = randomBytes(16);
  const encKey = await argon2idAsync(
    new TextEncoder().encode(passphrase),
    salt,
    kdf,
  );
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(encKey, nonce);
  const ciphertext = cipher.encrypt(kp.secretKey);

  return {
    version: 1,
    publicKey: `ed25519:${toHex(kp.publicKey)}`,
    ciphertext: toHex(ciphertext),
    nonce: toHex(nonce),
    salt: toHex(salt),
    kdf: {
      algorithm: 'argon2id',
      t: kdf.t,
      m: kdf.m,
      p: kdf.p,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypt an EncryptedKeypair with the same passphrase used to encrypt.
 * Throws DecryptError on wrong passphrase, corrupted ciphertext, or
 * unsupported version.
 */
export async function decryptKeypair(
  enc: EncryptedKeypair,
  passphrase: string,
): Promise<Keypair> {
  if (enc.version !== 1) {
    throw new DecryptError(`unsupported version ${enc.version}`);
  }
  if (enc.kdf.algorithm !== 'argon2id') {
    throw new DecryptError(`unsupported kdf ${enc.kdf.algorithm}`);
  }
  if (!enc.publicKey.startsWith('ed25519:')) {
    throw new DecryptError(`publicKey missing ed25519: prefix`);
  }

  const salt = fromHex(enc.salt);
  const nonce = fromHex(enc.nonce);
  const ciphertext = fromHex(enc.ciphertext);
  const publicKey = fromHex(enc.publicKey.slice('ed25519:'.length)) as Ed25519PublicKey;

  const encKey = await argon2idAsync(
    new TextEncoder().encode(passphrase),
    salt,
    {
      t: enc.kdf.t,
      m: enc.kdf.m,
      p: enc.kdf.p,
      dkLen: 32,
    },
  );

  let plaintext: Uint8Array;
  try {
    const cipher = xchacha20poly1305(encKey, nonce);
    plaintext = cipher.decrypt(ciphertext);
  } catch (err) {
    throw new DecryptError(
      `poly1305 tag mismatch (wrong passphrase or corrupted ciphertext): ${(err as Error).message}`,
    );
  }

  if (plaintext.length !== 32) {
    throw new DecryptError(`unexpected secret key length ${plaintext.length}`);
  }
  const secretKey = plaintext as Ed25519SecretKey;

  // Sanity check: re-derive public key from decrypted secret key, must
  // match the stored public key. Catches the rare case where decryption
  // appears to succeed (wrong-key collision on tag) but produced garbage.
  const derivedPublic = ed.getPublicKey(secretKey);
  for (let i = 0; i < 32; i++) {
    if (derivedPublic[i] !== publicKey[i]) {
      throw new DecryptError(`derived public key does not match stored public key`);
    }
  }

  return { publicKey, secretKey };
}
