// @collaborationtool/open-content — Phase 6 W2 P2 (ADR-0018).
//
// Server-side helpers for the 4 open entity types + Merkle-signed
// provenance chain. Pure functions; database I/O is callers' job
// (apps/web routes + apps/open-agent-worker).

/** UUID v7 string. */
export type EntityId = string;

/** Hex-encoded sha-256 (32 bytes → 64 hex chars). */
export type ContentHashHex = string;

/** ed25519 signature (64 bytes hex-encoded or base64url JWS). */
export type SignedJws = string;

/** Stored as bytea in PG (32 bytes raw sha-256). */
export type ContentHash = Uint8Array;

export type EntityKind =
  | 'open_question'
  | 'open_dataset'
  | 'open_peer_review'
  | 'share_snapshot';

export const ENTITY_KINDS: readonly EntityKind[] = [
  'open_question',
  'open_dataset',
  'open_peer_review',
  'share_snapshot',
] as const;

export function isEntityKind(value: unknown): value is EntityKind {
  return typeof value === 'string' && (ENTITY_KINDS as readonly string[]).includes(value);
}
