// Merkle-signed provenance chain (ADR-0018 §2.3).
//
// Pure helpers — actual DB INSERT is caller's job (apps/web /api/publish
// route or apps/open-agent-worker). This module:
//
//   - buildMerkleEntry(): prepare a new entry given (prev entry,
//     entity_kind, entity_id, signer, canonical payload)
//   - verifyMerkleEntry(): single-row signature + content-hash check
//   - verifyMerkleChain(): walk the chain checking prev pointer +
//     entry_seq monotonicity + per-row signature
//
// All verify functions return structured results (never throw) so the
// nightly verify worker can produce a report rather than crash on first
// bad row.

import { contentHash } from './canonical-payload';
import type {
  ContentHash,
  EntityId,
  EntityKind,
  SignedJws,
} from './_shared';

// ---------- Building ----------

export interface BuildMerkleEntryInput {
  /** New entry id (uuidv7). */
  id: EntityId;
  /** Previous entry id; null only for the genesis entry. */
  prevEntryId: EntityId | null;
  /** Which entity table this attests to. */
  entityKind: EntityKind;
  /** Row PK in the attested entity table. */
  entityId: EntityId;
  /** Canonical payload — what the signer signed over. Used to compute content_hash. */
  payload: unknown;
  /** Detached JWS signature by signer's ed25519. */
  signedJws: SignedJws;
  /** Principal id of the signer (FK into principal). */
  signerPrincipalId: string;
}

export interface PreparedMerkleEntry {
  id: EntityId;
  prevEntryId: EntityId | null;
  entityKind: EntityKind;
  entityId: EntityId;
  contentHash: ContentHash; // 32 bytes sha-256
  signedJws: SignedJws;
  signerPrincipalId: string;
  // entry_seq is bigserial → assigned by PG on INSERT, NOT here
  // appendedAt is default now() → assigned by PG on INSERT, NOT here
}

/**
 * Prepare a row payload ready for `INSERT INTO provenance_merkle_log`.
 * Caller is responsible for the INSERT + checking the bigserial assignment.
 *
 * Does NOT verify the signed_jws — that's `verifyMerkleEntry`'s job and
 * usually happens server-side after caller hands over the request body.
 */
export function buildMerkleEntry(input: BuildMerkleEntryInput): PreparedMerkleEntry {
  return {
    id: input.id,
    prevEntryId: input.prevEntryId,
    entityKind: input.entityKind,
    entityId: input.entityId,
    contentHash: contentHash(input.payload),
    signedJws: input.signedJws,
    signerPrincipalId: input.signerPrincipalId,
  };
}

// ---------- Verifying single entry ----------

export type MerkleEntryVerifyResult =
  | { valid: true }
  | { valid: false; reason: string };

export interface VerifyMerkleEntryInput {
  /** Stored row's content_hash bytea (from PG). */
  storedContentHash: ContentHash;
  /** Canonical payload bytes the signer originally signed over. */
  payload: unknown;
  /** Detached JWS signature on canonical payload. */
  signedJws: SignedJws;
  /** Pluggable signature verifier (typically wraps @collaborationtool/identity.verify). */
  signatureVerifier: (signedJws: SignedJws, payload: unknown) => boolean;
}

/**
 * Verify a single Merkle log row against its expected payload:
 *   (a) recomputed content_hash matches stored bytea
 *   (b) signedJws verifies via injected `signatureVerifier`
 *
 * Signature verifier is injected (DI pattern) because the actual ed25519
 * verify needs to look up the signer's public key (via orcid.link.json
 * or PG `principal_ed25519_key` future table) — that lookup is
 * application-specific.
 */
export function verifyMerkleEntry(input: VerifyMerkleEntryInput): MerkleEntryVerifyResult {
  // Step 1: recompute content hash and byte-compare to stored.
  const recomputed = contentHash(input.payload);
  if (recomputed.length !== input.storedContentHash.length) {
    return {
      valid: false,
      reason: `content_hash length mismatch (computed ${recomputed.length}, stored ${input.storedContentHash.length})`,
    };
  }
  for (let i = 0; i < recomputed.length; i++) {
    if (recomputed[i] !== input.storedContentHash[i]) {
      return { valid: false, reason: `content_hash byte mismatch at offset ${i}` };
    }
  }

  // Step 2: signature verify.
  let sigOk: boolean;
  try {
    sigOk = input.signatureVerifier(input.signedJws, input.payload);
  } catch (err) {
    return { valid: false, reason: `signature verifier threw: ${(err as Error).message}` };
  }
  if (!sigOk) {
    return { valid: false, reason: 'signed_jws verify failed' };
  }
  return { valid: true };
}

// ---------- Verifying entire chain ----------

export interface MerkleChainRow {
  id: EntityId;
  prevEntryId: EntityId | null;
  entrySeq: bigint;
  contentHash: ContentHash;
}

export interface MerkleChainAnomaly {
  rowId: EntityId;
  reason: string;
}

export interface MerkleChainVerifyResult {
  /** Total rows scanned. */
  totalRows: number;
  /** Genesis entry id (single row with prev=null; multiple = corruption). */
  genesisId: EntityId | null;
  /** Anomalies found — chain integrity violations. */
  anomalies: readonly MerkleChainAnomaly[];
}

/**
 * Walk the entire log and check four invariants:
 *   (1) Exactly one genesis row (prev_entry_id = null)
 *   (2) entry_seq strictly monotonic in PG insert order
 *   (3) Every non-genesis row's prev_entry_id refers to an existing row
 *   (4) No two rows share the same prev_entry_id (chain must be linear —
 *       a fork would let two entries claim the same predecessor, breaking
 *       the append-only single-chain guarantee)
 *
 * Per-row signature + content_hash check is `verifyMerkleEntry`'s job;
 * caller composes (this checks structural integrity, that checks payload).
 *
 * Returns an aggregated result — never throws, so nightly worker
 * produces a complete report. Empty `anomalies` array = chain healthy.
 */
export function verifyMerkleChain(rows: readonly MerkleChainRow[]): MerkleChainVerifyResult {
  if (rows.length === 0) {
    return { totalRows: 0, genesisId: null, anomalies: [] };
  }

  // Sort rows by entry_seq to walk in insert order (don't trust caller).
  const sorted = [...rows].sort((a, b) => Number(a.entrySeq - b.entrySeq));
  const anomalies: MerkleChainAnomaly[] = [];
  const seenIds = new Set<EntityId>();
  const usedPrevIds = new Set<EntityId>();

  // Invariant 1: exactly one genesis row.
  const genesisRows = sorted.filter((r) => r.prevEntryId === null);
  let genesisId: EntityId | null = null;
  if (genesisRows.length === 0) {
    anomalies.push({ rowId: sorted[0]!.id, reason: 'no genesis row (all rows have prev_entry_id)' });
  } else if (genesisRows.length > 1) {
    for (const g of genesisRows.slice(1)) {
      anomalies.push({ rowId: g.id, reason: 'multiple genesis rows (prev=null)' });
    }
    genesisId = genesisRows[0]!.id;
  } else {
    genesisId = genesisRows[0]!.id;
  }

  // Invariant 2 + 3: walk in order, check monotonic seq + prev resolves.
  let prevSeq: bigint | null = null;
  for (const row of sorted) {
    if (prevSeq !== null && row.entrySeq <= prevSeq) {
      anomalies.push({
        rowId: row.id,
        reason: `entry_seq not strictly monotonic (${row.entrySeq} after ${prevSeq})`,
      });
    }
    prevSeq = row.entrySeq;

    if (row.prevEntryId !== null) {
      // Invariant 4: prev_entry_id must be unique across the log.
      if (usedPrevIds.has(row.prevEntryId)) {
        anomalies.push({
          rowId: row.id,
          reason: `prev_entry_id ${row.prevEntryId} already referenced by another entry (forked chain)`,
        });
      }
      usedPrevIds.add(row.prevEntryId);

      if (!seenIds.has(row.prevEntryId)) {
        // prev points to either a missing row OR a later-seq row (out of order)
        // Pre-collect IDs in `sorted` to distinguish.
        const allIds = new Set(sorted.map((r) => r.id));
        if (!allIds.has(row.prevEntryId)) {
          anomalies.push({
            rowId: row.id,
            reason: `prev_entry_id ${row.prevEntryId} refers to non-existent row`,
          });
        } else {
          anomalies.push({
            rowId: row.id,
            reason: `prev_entry_id ${row.prevEntryId} refers to a row with later or equal entry_seq`,
          });
        }
      }
    }
    seenIds.add(row.id);
  }

  return { totalRows: rows.length, genesisId, anomalies };
}
