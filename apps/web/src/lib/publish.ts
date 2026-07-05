// Phase 6 W2 P2 — F4 publish flow service layer (ADR-0018 §2.4).
//
// Pure validator + payload builder consumed by POST /api/publish route.
// Mirrors apps/web/src/lib/claim-review.ts pattern (Wave B B3) — service
// layer enforces invariants beyond what the DB CHECK constraints catch
// and returns structured reject codes the route maps to HTTP status.
//
// Three invariants (ADR-0018 §2.2-§2.4) enforced here:
//   1. signed_payload_jws non-empty (rejected at empty/whitespace level
//      before reaching DB NOT NULL)
//   2. content_hash claim matches recomputed hash of canonical payload
//      (anti-replay; if hash differs, payload was tampered after signing)
//   3. signature verifier (injected, wraps @collaborationtool/identity)
//      returns true for the signed_jws over the canonical bytes
//
// Public key lookup (principal_id → ed25519 public key) is the ROUTE
// layer's job. Forward-compat: migration 0017+ will add
// `principal.ed25519_public_key` text column. For now route can look up
// via orcid.link.json (client-uploaded) or test-injection.

import {
  buildMerkleEntry,
  canonicalBytes,
  contentHash,
  isEntityKind,
  type ContentHash,
  type EntityId,
  type EntityKind,
  type PreparedMerkleEntry,
  type SignedJws,
} from '@collaborationtool/open-content';

// ---------- Input shapes ----------

export interface PublishInput {
  /** Which entity table this targets. */
  kind: EntityKind;
  /** Caller-supplied entity id (uuidv7 from client). */
  entityId: EntityId;
  /** Canonical entity content — exactly what the signer signed over. */
  content: unknown;
  /** Hex-encoded sha-256 the client computed (must match server recompute). */
  contentHashHex: string;
  /** Detached JWS by signer's ed25519. */
  signedJws: SignedJws;
  /** Caller principal id; route stamps from session. */
  signerPrincipalId: string;
  /** Previous Merkle entry id; null only for genesis. Route loads from latest log row. */
  prevMerkleEntryId: EntityId | null;
  /** Caller-supplied new Merkle entry id (uuidv7 from client). */
  merkleEntryId: EntityId;
  /**
   * Injected signature verifier. The route loads the public key for
   * `signerPrincipalId` then provides a verifier closure that captures it.
   *
   *   const pubKey = await loadEd25519PublicKey(principalId);
   *   const verifier = (jws, payload) => identity.verify(
   *     fromJws(jws), canonicalBytes(payload), pubKey
   *   );
   */
  signatureVerifier: (signedJws: SignedJws, payload: unknown) => boolean;
}

export type PublishRejectReason =
  | 'invalid-kind'
  | 'empty-signed-jws'
  | 'invalid-content-hash-hex'
  | 'content-hash-mismatch'
  | 'signature-verify-failed'
  | 'signature-verify-threw'
  | 'missing-entity-id'
  | 'missing-merkle-entry-id'
  | 'missing-signer-principal-id';

export type PublishValidation =
  | {
      ok: true;
      /** Normalised payload for INSERT — route stamps timestamps server-side. */
      payload: {
        kind: EntityKind;
        entityId: EntityId;
        content: unknown;
        contentHash: ContentHash;
        signedJws: SignedJws;
        signerPrincipalId: string;
        merkleEntry: PreparedMerkleEntry;
      };
    }
  | { ok: false; reason: PublishRejectReason };

const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Validate a publish request. Performs three checks per file header.
 * Never touches DB; route layer handles INSERT in a single transaction
 * after this passes.
 */
export function validatePublish(input: PublishInput): PublishValidation {
  if (!isEntityKind(input.kind)) {
    return { ok: false, reason: 'invalid-kind' };
  }
  if (!input.entityId || typeof input.entityId !== 'string') {
    return { ok: false, reason: 'missing-entity-id' };
  }
  if (!input.merkleEntryId || typeof input.merkleEntryId !== 'string') {
    return { ok: false, reason: 'missing-merkle-entry-id' };
  }
  if (!input.signerPrincipalId || typeof input.signerPrincipalId !== 'string') {
    return { ok: false, reason: 'missing-signer-principal-id' };
  }
  const jws = (input.signedJws ?? '').trim();
  if (jws.length === 0) {
    return { ok: false, reason: 'empty-signed-jws' };
  }
  if (typeof input.contentHashHex !== 'string' || !HEX64_RE.test(input.contentHashHex)) {
    return { ok: false, reason: 'invalid-content-hash-hex' };
  }

  // Recompute content_hash; reject if it disagrees with caller claim.
  // Anti-replay: caller can't sign payload-A then submit payload-B
  // claiming the hash of A.
  const recomputedHash = contentHash(input.content);
  let recomputedHex = '';
  for (const b of recomputedHash) recomputedHex += b.toString(16).padStart(2, '0');
  if (recomputedHex !== input.contentHashHex) {
    return { ok: false, reason: 'content-hash-mismatch' };
  }

  // Signature verify — wraps caller-supplied verifier; catch throws so
  // route gets a structured reason rather than a 500.
  let sigOk: boolean;
  try {
    sigOk = input.signatureVerifier(jws, input.content);
  } catch {
    return { ok: false, reason: 'signature-verify-threw' };
  }
  if (!sigOk) {
    return { ok: false, reason: 'signature-verify-failed' };
  }

  // Build the Merkle entry row payload for INSERT.
  const merkleEntry = buildMerkleEntry({
    id: input.merkleEntryId,
    prevEntryId: input.prevMerkleEntryId,
    entityKind: input.kind,
    entityId: input.entityId,
    payload: input.content,
    signedJws: jws,
    signerPrincipalId: input.signerPrincipalId,
  });

  return {
    ok: true,
    payload: {
      kind: input.kind,
      entityId: input.entityId,
      content: input.content,
      contentHash: recomputedHash,
      signedJws: jws,
      signerPrincipalId: input.signerPrincipalId,
      merkleEntry,
    },
  };
}

// ---------- Entity-specific content shape validators ----------
//
// Each open entity has a minimal required content shape. Service layer
// surface these so route can pre-flight the JSON body before signature
// verify (cheaper to reject malformed body than to verify-then-reject).

export interface OpenQuestionContent {
  questionMd: string;
  domainTags: readonly string[];
  sourceSubdocId?: string;
}

export interface OpenDatasetContent {
  title: string;
  descriptionMd: string;
  blobStorageRef: string;
  sizeBytes: number;
  licenseSpdx: string;
  datasetDoi?: string;
}

export interface OpenPeerReviewContent {
  reviewerOrcidId: string;
  targetKind: 'question' | 'dataset' | 'snapshot';
  targetId: string;
  verdict: 'endorses' | 'challenges' | 'refines';
  bodyMd: string;
  evidenceRefs: readonly string[];
}

export interface ShareSnapshotContent {
  sourceSubdocId?: string;
  markdownContent: string;
  /** Base64-encoded Y.Doc binary; route decodes on persist. */
  yjsBinaryBase64: string;
  kind: 'section' | 'preprint' | 'dataset';
  permalinkHash: string;
  doi?: string;
}

export type ValidateContentResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateOpenQuestionContent(c: unknown): ValidateContentResult {
  if (!c || typeof c !== 'object') return { ok: false, reason: 'content-not-object' };
  const o = c as Record<string, unknown>;
  if (typeof o.questionMd !== 'string' || o.questionMd.trim().length === 0) {
    return { ok: false, reason: 'question_md-empty' };
  }
  if (!Array.isArray(o.domainTags)) return { ok: false, reason: 'domain_tags-not-array' };
  for (const t of o.domainTags) {
    if (typeof t !== 'string') return { ok: false, reason: 'domain_tag-not-string' };
  }
  return { ok: true };
}

export function validateOpenDatasetContent(c: unknown): ValidateContentResult {
  if (!c || typeof c !== 'object') return { ok: false, reason: 'content-not-object' };
  const o = c as Record<string, unknown>;
  if (typeof o.title !== 'string' || o.title.trim().length === 0) {
    return { ok: false, reason: 'title-empty' };
  }
  if (typeof o.descriptionMd !== 'string' || o.descriptionMd.trim().length === 0) {
    return { ok: false, reason: 'description_md-empty' };
  }
  if (typeof o.blobStorageRef !== 'string' || o.blobStorageRef.trim().length === 0) {
    return { ok: false, reason: 'blob_storage_ref-empty' };
  }
  if (typeof o.sizeBytes !== 'number' || o.sizeBytes < 0 || !Number.isFinite(o.sizeBytes)) {
    return { ok: false, reason: 'size_bytes-invalid' };
  }
  if (typeof o.licenseSpdx !== 'string' || o.licenseSpdx.trim().length === 0) {
    return { ok: false, reason: 'license_spdx-empty' };
  }
  return { ok: true };
}

export function validateOpenPeerReviewContent(c: unknown): ValidateContentResult {
  if (!c || typeof c !== 'object') return { ok: false, reason: 'content-not-object' };
  const o = c as Record<string, unknown>;
  if (typeof o.reviewerOrcidId !== 'string' || o.reviewerOrcidId.trim().length === 0) {
    return { ok: false, reason: 'reviewer_orcid_id-required' };
  }
  if (!['question', 'dataset', 'snapshot'].includes(o.targetKind as string)) {
    return { ok: false, reason: 'invalid-target-kind' };
  }
  if (typeof o.targetId !== 'string' || o.targetId.trim().length === 0) {
    return { ok: false, reason: 'target_id-empty' };
  }
  if (!['endorses', 'challenges', 'refines'].includes(o.verdict as string)) {
    return { ok: false, reason: 'invalid-verdict' };
  }
  if (typeof o.bodyMd !== 'string' || o.bodyMd.trim().length === 0) {
    return { ok: false, reason: 'body_md-empty' };
  }
  if (o.verdict === 'challenges') {
    if (!Array.isArray(o.evidenceRefs) || o.evidenceRefs.length === 0) {
      return { ok: false, reason: 'challenges-requires-evidence' };
    }
  }
  return { ok: true };
}

export function validateShareSnapshotContent(c: unknown): ValidateContentResult {
  if (!c || typeof c !== 'object') return { ok: false, reason: 'content-not-object' };
  const o = c as Record<string, unknown>;
  if (typeof o.markdownContent !== 'string') {
    return { ok: false, reason: 'markdown_content-required' };
  }
  if (typeof o.yjsBinaryBase64 !== 'string' || o.yjsBinaryBase64.length === 0) {
    return { ok: false, reason: 'yjs_binary-required' };
  }
  if (!['section', 'preprint', 'dataset'].includes(o.kind as string)) {
    return { ok: false, reason: 'invalid-kind' };
  }
  if (typeof o.permalinkHash !== 'string' || o.permalinkHash.length === 0) {
    return { ok: false, reason: 'permalink_hash-required' };
  }
  return { ok: true };
}

/**
 * Dispatch to the content-shape validator for a given entity kind.
 * Convenience for routes that pre-flight body before signature verify.
 */
export function validateContentForKind(
  kind: unknown,
  content: unknown,
): ValidateContentResult {
  if (!isEntityKind(kind)) {
    return { ok: false, reason: 'invalid-kind' };
  }
  switch (kind) {
    case 'open_question':
      return validateOpenQuestionContent(content);
    case 'open_dataset':
      return validateOpenDatasetContent(content);
    case 'open_peer_review':
      return validateOpenPeerReviewContent(content);
    case 'share_snapshot':
      return validateShareSnapshotContent(content);
  }
}

/** Re-export for routes to compose canonical bytes when calling identity.verify. */
export { canonicalBytes };
