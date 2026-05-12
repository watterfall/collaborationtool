// ed25519 detached signing + verification.
//
// `sign(message, secretKey)` returns a 64-byte detached signature.
// `verify(signature, message, publicKey)` returns boolean (no throw on
// invalid; just false). Both operations are deterministic — same input
// yields same signature (ed25519 spec).
//
// Used by:
//   - .vault/provenance.log append entries (ADR-0018)
//   - F4 publish flow signed_payload_jws builder (ADR-0018 §2.4)
//   - ORCID identity link payload (orcid-link.ts)

import * as ed from '@noble/ed25519';

import type { Ed25519PublicKey, Ed25519SecretKey, Ed25519Signature } from './_shared';

/**
 * Sign `message` with `secretKey`. Returns a 64-byte detached signature.
 *
 * Deterministic: same (message, secretKey) → same signature. Caller is
 * responsible for canonicalising `message` (e.g. sorted-key JSON
 * stringify) before signing.
 */
export function sign(
  message: Uint8Array,
  secretKey: Ed25519SecretKey,
): Ed25519Signature {
  return ed.sign(message, secretKey) as Ed25519Signature;
}

/**
 * Verify a detached `signature` against `message` and `publicKey`.
 * Returns true iff the signature is valid. Returns false on:
 *   - tampered message
 *   - tampered signature
 *   - wrong public key
 *   - malformed inputs (any length deviation)
 *
 * Never throws — invalid inputs map to `false` to keep call sites
 * branch-free.
 */
export function verify(
  signature: Ed25519Signature,
  message: Uint8Array,
  publicKey: Ed25519PublicKey,
): boolean {
  try {
    return ed.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}
