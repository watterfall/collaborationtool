// ORCID identity link helpers.
//
// Two-step bind flow (ADR-0015 + ADR-0018):
//   1. User completes ORCID OAuth on server → server hands user a JWS
//      proving "ORCID iD <id> consents to bind to public key <X>"
//   2. Client receives JWS + stores in `.vault/keys/orcid.link.json`
//
// `buildOrcidLinkPayload` produces the canonical signing material the
// server-side ORCID flow signs over. Kept in this package so client +
// server share one canonicaliser; divergence = signature verify fails.

import { toHex, type Ed25519PublicKey, type OrcidLink } from './_shared';

export interface OrcidLinkPayload {
  /** Hex-encoded ed25519 public key with `ed25519:` prefix. */
  readonly publicKey: string;
  /** ORCID iD in dashed form, e.g. "0000-0002-1825-0097". */
  readonly orcidId: string;
  /** ISO-8601 timestamp the server should include in the JWS payload. */
  readonly issuedAt: string;
}

/**
 * Canonical JSON shape for the OrcidLink payload. Both client and
 * server stringify this in a deterministic order so the JWS signature
 * is over identical bytes.
 *
 * Object key order is fixed by the literal here — JSON.stringify on
 * this object always produces the same bytes for the same inputs.
 */
export function buildOrcidLinkPayload(args: {
  publicKey: Ed25519PublicKey;
  orcidId: string;
  issuedAt: string;
}): OrcidLinkPayload {
  return {
    publicKey: `ed25519:${toHex(args.publicKey)}`,
    orcidId: args.orcidId,
    issuedAt: args.issuedAt,
  };
}

/**
 * Canonicalise an OrcidLinkPayload to the bytes that the JWS signs.
 * Order is fixed by `buildOrcidLinkPayload`'s literal; we re-build it
 * here defensively to guard against caller field reordering.
 */
export function canonicaliseOrcidLinkPayload(p: OrcidLinkPayload): Uint8Array {
  const canonical = JSON.stringify({
    publicKey: p.publicKey,
    orcidId: p.orcidId,
    issuedAt: p.issuedAt,
  });
  return new TextEncoder().encode(canonical);
}

/**
 * Assemble an OrcidLink record (the on-disk shape) from the server's
 * signed JWS. Caller already obtained the JWS from the OAuth flow.
 */
export function assembleOrcidLink(args: {
  payload: OrcidLinkPayload;
  signedJws: string;
}): OrcidLink {
  return {
    publicKey: args.payload.publicKey,
    orcidId: args.payload.orcidId,
    signedJws: args.signedJws,
    linkedAt: args.payload.issuedAt,
  };
}

/**
 * Basic shape validation for ORCID iDs. The full ORCID iD format is
 * 4×4 hex groups separated by `-`; the last digit may be `X` (mod-11
 * checksum). Strict checksum is left to the server flow.
 */
export function isOrcidIdShape(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$/.test(s);
}
