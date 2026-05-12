// @collaborationtool/identity — Phase 6 W2-W3.
//
// ed25519 keypair + argon2id-derived encryption + ORCID identity link.
// Underlies ADR-0018 §2.1 / Merkle-signed provenance.
//
// Spec ref: docs/superpowers/specs/2026-05-11-client-first-pivot-design.md
//           §3 (vault keys/) + §2 invariant #7 (provenance 不可伪造).
//
// Algorithms locked (Phase 6 W2):
//   - Signing:    ed25519 via @noble/ed25519 (pure JS, cross-Tauri)
//   - KDF:        argon2id via @noble/hashes/argon2 (memory-hard,
//                 resistant to GPU/ASIC attacks per RFC 9106)
//   - Symmetric:  xchacha20-poly1305 via @noble/ciphers/chacha (24-byte
//                 nonce safe for random generation)
//
// Why these and not the alternatives:
//   - secp256k1: associated with Bitcoin/Ethereum, deliberately avoided
//     to keep DeSCI 去区块链立场 unambiguous (spec §1 Q4)
//   - PBKDF2 / scrypt: weaker resistance to modern attacks; argon2id is
//     the winner of the Password Hashing Competition
//   - AES-GCM: requires careful nonce management; xchacha20-poly1305
//     accepts random 24-byte nonces with negligible collision risk

import type { ArgonOpts } from '@noble/hashes/argon2.js';

// ---------- Branded byte types ----------

/** ed25519 public key (32 bytes). */
export type Ed25519PublicKey = Uint8Array & { readonly __brand: 'Ed25519PublicKey' };
/** ed25519 secret key (32 bytes). */
export type Ed25519SecretKey = Uint8Array & { readonly __brand: 'Ed25519SecretKey' };
/** ed25519 signature (64 bytes). */
export type Ed25519Signature = Uint8Array & { readonly __brand: 'Ed25519Signature' };

// ---------- Keypair structure ----------

export interface Keypair {
  readonly publicKey: Ed25519PublicKey;
  readonly secretKey: Ed25519SecretKey;
}

/**
 * On-disk encrypted keypair format. The plaintext (secret key) is
 * encrypted with xchacha20-poly1305 using a key derived from the user
 * passphrase via argon2id.
 *
 * `version` reserves the format for future migration; v1 is the only
 * shape Phase 6 ships.
 */
export interface EncryptedKeypair {
  readonly version: 1;
  /** Hex-encoded public key (33 chars: "ed25519:" prefix + 64 hex). */
  readonly publicKey: string;
  /** Hex-encoded ciphertext of secret key + 16-byte poly1305 tag. */
  readonly ciphertext: string;
  /** Hex-encoded 24-byte xchacha20 nonce. */
  readonly nonce: string;
  /** Hex-encoded 16-byte argon2id salt. */
  readonly salt: string;
  /** argon2id parameters used to derive the encryption key. */
  readonly kdf: {
    readonly algorithm: 'argon2id';
    readonly t: number; // iterations
    readonly m: number; // memory KiB
    readonly p: number; // parallelism
  };
  /** ISO-8601 timestamp of keypair creation. */
  readonly createdAt: string;
}

/** Default KDF cost — Phase 6 W2 baseline (~250ms on M1 / 4-year-old machines). */
export const DEFAULT_KDF_OPTS: ArgonOpts = {
  t: 3, // 3 iterations
  m: 65536, // 64 MiB memory
  p: 4, // 4 parallel lanes
  dkLen: 32, // 32-byte derived key for xchacha20
};

// ---------- ORCID identity link ----------

export interface OrcidLink {
  readonly publicKey: string; // hex-encoded ed25519 public key
  readonly orcidId: string; // e.g. "0000-0002-1825-0097"
  /**
   * JWS detached signature from ORCID OAuth flow proving the ORCID iD
   * holder consented to bind their identity to the public key.
   * Issued by ORCID's OIDC OP per ADR-0015.
   */
  readonly signedJws: string;
  readonly linkedAt: string; // ISO-8601
}

// ---------- Vault paths (per spec §3) ----------

/**
 * Relative paths inside a vault root for identity material. Callers
 * compose with `path.join(vaultRoot, VAULT_KEYS_DIR, …)`.
 */
export const VAULT_KEYS_DIR = '.vault/keys' as const;
export const KEYPAIR_FILE = 'identity.json' as const; // EncryptedKeypair
export const PUBLIC_KEY_FILE = 'ed25519.pub' as const; // plaintext hex public key
export const ORCID_LINK_FILE = 'orcid.link.json' as const; // OrcidLink

// ---------- Errors ----------

export class DecryptError extends Error {
  constructor(public readonly reason: string) {
    super(`identity: decrypt failed — ${reason}`);
    this.name = 'DecryptError';
  }
}

export class CorruptKeyfileError extends Error {
  constructor(public readonly path: string, public readonly reason: string) {
    super(`identity: keyfile corrupt at ${path} — ${reason}`);
    this.name = 'CorruptKeyfileError';
  }
}

// ---------- hex helpers (no external dep — keep package surface small) ----------

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`identity: invalid hex length ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`identity: invalid hex at offset ${i * 2}`);
    }
    out[i] = byte;
  }
  return out;
}
