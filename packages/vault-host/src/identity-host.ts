// Identity host — load-or-create the vault's ed25519 keypair and sign bytes.
//
// Wraps the identity package so the desktop host has one call for "give me
// this vault's signing key" (generate on first run, decrypt on subsequent
// runs) plus a thin sign helper. The signed output is the substrate for the
// Merkle-signed provenance log (ADR-0018); this file only owns key material +
// raw signing, not the log format.
//
// 封装 identity 包，给 desktop 主机一个统一入口："取这个 vault 的签名密钥"
// （首次生成 / 之后用 passphrase 解密）+ 一个薄签名 helper。

import {
  DEFAULT_KDF_OPTS,
  decryptKeypair,
  encryptKeypair,
  generateKeypair,
  readEncryptedKeypair,
  sign,
  toHex,
  verify,
  writeEncryptedKeypair,
  type Ed25519Signature,
  type Keypair,
} from '@collaborationtool/identity';

import type { VaultRoot } from './_shared';

export { verify, toHex } from '@collaborationtool/identity';
export type { Keypair, Ed25519Signature } from '@collaborationtool/identity';

/** Options for `loadOrCreateIdentity`. */
export interface LoadIdentityOptions {
  /**
   * KDF override forwarded to `encryptKeypair` on first-run generation.
   * Only affects newly created keys. Tests pass a cheap override; production
   * should omit it to use the intentionally-slow `DEFAULT_KDF_OPTS`.
   */
  kdf?: typeof DEFAULT_KDF_OPTS;
}

/** Result of `loadOrCreateIdentity`. */
export interface LoadedIdentity {
  keypair: Keypair;
  /** True when the keypair was generated on this call (first run). */
  created: boolean;
}

/**
 * Load the vault's keypair from `.vault/keys/identity.json`, or generate +
 * persist a fresh one when absent. `passphrase` decrypts an existing key or
 * encrypts a newly generated one.
 *
 * Throws `DecryptError` (from identity) on a wrong passphrase for an existing
 * key — callers surface this as "wrong passphrase", they do NOT silently
 * regenerate (that would orphan the user's prior signatures).
 */
export async function loadOrCreateIdentity(
  vaultRoot: VaultRoot,
  passphrase: string,
  options: LoadIdentityOptions = {},
): Promise<LoadedIdentity> {
  const existing = await readEncryptedKeypair(vaultRoot);
  if (existing) {
    const keypair = await decryptKeypair(existing, passphrase);
    return { keypair, created: false };
  }

  const keypair = generateKeypair();
  const encrypted = await encryptKeypair(keypair, passphrase, {
    kdf: options.kdf ?? DEFAULT_KDF_OPTS,
  });
  await writeEncryptedKeypair(vaultRoot, encrypted);
  return { keypair, created: true };
}

/**
 * Sign an already-canonicalised message with a loaded keypair. The caller is
 * responsible for canonicalising `message` before signing (identity's `sign`
 * contract — e.g. sorted-key JSON stringify for a provenance entry).
 */
export function signWithKeypair(
  keypair: Keypair,
  message: Uint8Array,
): Ed25519Signature {
  return sign(message, keypair.secretKey);
}
