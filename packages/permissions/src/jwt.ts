// Sync token JWT — short-lived bearer token issued by the web app for a
// single (principal, document) pair, consumed by `apps/sync-gateway` to
// authorise the WebSocket connection.
//
// Phase 1 design (ADR-0002 §6 Bad/Trade-offs):
// - JWT carries only `sub` (PrincipalId) + `doc` (DocumentId), NOT the
//   capability set. The gateway loads capabilities from `document_acl`
//   on connect — caps can be revoked without waiting for token expiry.
// - HS256 with a shared secret between web app + gateway. better-auth
//   issues the session cookie; the web app exchanges that for a sync
//   token via `/api/sync-token`.
// - 5 minute default TTL: short enough that a revoke takes effect quickly,
//   long enough that token refresh isn't on the keystroke path.
//
// Phase 1.5 / Phase 2 evolution path:
// - Switch to RS256 (better-auth issuer key, gateway has public key) so
//   gateway doesn't share a secret with the web app.
// - Add JWKS rotation.
// - Optionally embed a small `caps` claim with the connection-mode hint
//   so gateway doesn't need a DB roundtrip on every connect (still
//   refresh from PG on heartbeat).

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';

import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

export const SYNC_TOKEN_ALG = 'HS256' as const;
export const SYNC_TOKEN_DEFAULT_TTL_SECONDS = 5 * 60; // 5 min

export interface SyncTokenPayload {
  /** PrincipalId, prefix-encoded (e.g. 'user:01HXX...'). */
  sub: PrincipalId;
  /** DocumentId — single doc per token in Phase 1. */
  doc: DocumentId;
  /** Issued at (seconds since epoch). */
  iat: number;
  /** Expiry (seconds since epoch). */
  exp: number;
  /** Issuer; e.g. 'collaborationtool.web'. */
  iss: string;
  /** Audience; e.g. 'sync-gateway'. */
  aud: string;
}

export interface SignSyncTokenOptions {
  issuer: string;
  audience: string;
  ttlSeconds?: number;
  /** For deterministic tests. */
  nowSeconds?: number;
}

export interface VerifySyncTokenOptions {
  issuer: string;
  audience: string;
  /** Tolerate small clock skew between web app and gateway. */
  clockToleranceSeconds?: number;
}

export class SyncTokenError extends Error {
  override name = 'SyncTokenError';
  constructor(
    public readonly code:
      | 'invalid-signature'
      | 'expired'
      | 'wrong-issuer'
      | 'wrong-audience'
      | 'malformed',
    message: string,
  ) {
    super(message);
  }
}

export async function signSyncToken(
  claims: { sub: PrincipalId; doc: DocumentId },
  secret: Uint8Array,
  options: SignSyncTokenOptions,
): Promise<string> {
  const ttl = options.ttlSeconds ?? SYNC_TOKEN_DEFAULT_TTL_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  return new SignJWT({ doc: claims.doc })
    .setProtectedHeader({ alg: SYNC_TOKEN_ALG })
    .setSubject(claims.sub)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(secret);
}

export async function verifySyncToken(
  token: string,
  secret: Uint8Array,
  options: VerifySyncTokenOptions,
): Promise<SyncTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [SYNC_TOKEN_ALG],
      issuer: options.issuer,
      audience: options.audience,
      clockTolerance: options.clockToleranceSeconds ?? 5,
    });

    if (
      typeof payload.sub !== 'string' ||
      typeof payload['doc'] !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iss !== 'string' ||
      // `aud` may be string | string[]; we only sign single string.
      (typeof payload.aud !== 'string' &&
        !(Array.isArray(payload.aud) && payload.aud.length === 1))
    ) {
      throw new SyncTokenError('malformed', 'sync token payload missing fields');
    }
    const aud =
      typeof payload.aud === 'string' ? payload.aud : (payload.aud as string[])[0]!;

    return {
      sub: payload.sub as PrincipalId,
      doc: payload['doc'] as DocumentId,
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      aud,
    };
  } catch (err) {
    if (err instanceof SyncTokenError) throw err;
    if (err instanceof joseErrors.JWTExpired) {
      throw new SyncTokenError('expired', 'sync token expired');
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      const claim = err.claim;
      if (claim === 'iss') {
        throw new SyncTokenError('wrong-issuer', 'sync token issuer mismatch');
      }
      if (claim === 'aud') {
        throw new SyncTokenError('wrong-audience', 'sync token audience mismatch');
      }
      throw new SyncTokenError('malformed', err.message);
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new SyncTokenError('invalid-signature', 'sync token signature mismatch');
    }
    throw new SyncTokenError(
      'malformed',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Helper: derive a Uint8Array secret from the env-supplied string. Throws
 * if too short. We require at least 32 bytes to keep brute-force out of
 * reach — the .env should hold a base64 of `openssl rand -base64 32` or
 * better.
 */
export function syncTokenSecretFromString(value: string): Uint8Array {
  if (value.length < 32) {
    throw new Error(
      `sync token secret too short (${value.length} chars); ` +
        'use at least 32 chars (e.g. `openssl rand -base64 32`).',
    );
  }
  return new TextEncoder().encode(value);
}

// ============================================================
// Phase 2 W4 ADR-0007: cell-runtime token (5 min TTL, audience
// 'cell-runtime', scope = `cell.execute:<cellId>`).
// Reuses SYNC_TOKEN_SECRET (per ADR-0007 §2.4); audience separation
// keeps it from being usable against sync-gateway and vice-versa.
// ============================================================

export const CELL_TOKEN_DEFAULT_TTL_SECONDS = 5 * 60;
export const CELL_TOKEN_AUDIENCE = 'cell-runtime' as const;

export interface CellTokenPayload {
  sub: PrincipalId;
  doc: DocumentId;
  /** computational_cell.id this token authorises execution for. */
  cell: string;
  /** Capability verb scoped to the cell: `cell.execute:<cellId>`. */
  scope: string;
  iat: number;
  exp: number;
  iss: string;
  aud: typeof CELL_TOKEN_AUDIENCE;
}

export interface SignCellTokenOptions {
  issuer: string;
  ttlSeconds?: number;
  nowSeconds?: number;
}

/** Sign a cell-runtime JWT. */
export async function signCellToken(
  claims: { sub: PrincipalId; doc: DocumentId; cell: string },
  secret: Uint8Array,
  options: SignCellTokenOptions,
): Promise<string> {
  const ttl = options.ttlSeconds ?? CELL_TOKEN_DEFAULT_TTL_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  return new SignJWT({
    doc: claims.doc,
    cell: claims.cell,
    scope: `cell.execute:${claims.cell}`,
  })
    .setProtectedHeader({ alg: SYNC_TOKEN_ALG })
    .setSubject(claims.sub)
    .setIssuer(options.issuer)
    .setAudience(CELL_TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(secret);
}

/** Verify a cell-runtime JWT. Throws SyncTokenError on failure. */
export async function verifyCellToken(
  token: string,
  secret: Uint8Array,
  options: { issuer: string; clockToleranceSeconds?: number },
): Promise<CellTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [SYNC_TOKEN_ALG],
      issuer: options.issuer,
      audience: CELL_TOKEN_AUDIENCE,
      clockTolerance: options.clockToleranceSeconds ?? 5,
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload['doc'] !== 'string' ||
      typeof payload['cell'] !== 'string' ||
      typeof payload['scope'] !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iss !== 'string'
    ) {
      throw new SyncTokenError('malformed', 'cell token payload missing fields');
    }
    return {
      sub: payload.sub as PrincipalId,
      doc: payload['doc'] as DocumentId,
      cell: payload['cell'] as string,
      scope: payload['scope'] as string,
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      aud: CELL_TOKEN_AUDIENCE,
    };
  } catch (err) {
    if (err instanceof SyncTokenError) throw err;
    if (err instanceof joseErrors.JWTExpired) {
      throw new SyncTokenError('expired', 'cell token expired');
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      throw new SyncTokenError(
        err.claim === 'aud' ? 'wrong-audience' : 'malformed',
        err.message,
      );
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new SyncTokenError('invalid-signature', 'cell token signature mismatch');
    }
    throw new SyncTokenError(
      'malformed',
      err instanceof Error ? err.message : String(err),
    );
  }
}
