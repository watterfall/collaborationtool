// Phase 5 Wave B B3 — claim-review service layer.
//
// Pure logic + DB helpers consumed by the 4 API routes. Keeping
// invariant checks in one file mirrors `apps/web/src/lib/maintenance.ts`
// pattern from Phase 4 W4 — the route is a thin wrapper that maps
// validator output to HTTP status codes.
//
// Three invariants (ADR-0016 §2.1) enforced at the service layer
// **in addition to** the DB CHECK constraints (migration 0014 §2):
//   1. verdict='challenges' ⇒ evidence_refs non-empty
//   2. is_ai_verdict=true ⇒ no reviewer_orcid_id, no signed_payload_jws
//   3. signed_payload_jws set ⇒ reviewer_orcid_id + orcid_signed_at
//
// The DB layer catches raw INSERT bugs; the service layer gives
// callers structured error codes (vs PG's CHECK error string).

export type ClaimReviewVerdict = 'endorses' | 'challenges' | 'refines';

export const CLAIM_REVIEW_VERDICTS: ReadonlySet<ClaimReviewVerdict> = new Set<
  ClaimReviewVerdict
>(['endorses', 'challenges', 'refines']);

export interface SubmitClaimReviewInput {
  verdict: ClaimReviewVerdict;
  bodyMarkdown: string;
  evidenceRefs: string[];
  /** Optional at submit-time — sign step (POST /review/<id>/sign)
   * supplies it after the OIDC dance. */
  signedPayloadJws?: string | null;
  reviewerOrcidId?: string | null;
  /** True ⇒ AI verdict path; reviewer_orcid_id + signed_payload_jws
   * must both be null. */
  isAiVerdict: boolean;
}

export type ClaimReviewRejectReason =
  | 'invalid-verdict'
  | 'empty-body'
  | 'challenges-requires-evidence'
  | 'ai-must-not-sign'
  | 'sign-requires-orcid'
  | 'invalid-evidence-ref-id';

export type ClaimReviewValidation =
  | {
      ok: true;
      /** Normalised insert payload — caller stamps id / provenance_id /
       * submitted_at / reviewer_principal_id before INSERT. */
      payload: {
        verdict: ClaimReviewVerdict;
        bodyMarkdown: string;
        evidenceRefs: string[];
        signedPayloadJws: string | null;
        reviewerOrcidId: string | null;
        isAiVerdict: boolean;
      };
    }
  | { ok: false; reason: ClaimReviewRejectReason };

const EVIDENCE_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function validateSubmitClaimReview(
  input: SubmitClaimReviewInput,
): ClaimReviewValidation {
  if (!CLAIM_REVIEW_VERDICTS.has(input.verdict)) {
    return { ok: false, reason: 'invalid-verdict' };
  }
  const body = input.bodyMarkdown.trim();
  if (body.length === 0) {
    return { ok: false, reason: 'empty-body' };
  }
  const refs = input.evidenceRefs ?? [];
  if (input.verdict === 'challenges' && refs.length === 0) {
    return { ok: false, reason: 'challenges-requires-evidence' };
  }
  for (const id of refs) {
    if (typeof id !== 'string' || !EVIDENCE_ID_RE.test(id)) {
      return { ok: false, reason: 'invalid-evidence-ref-id' };
    }
  }
  if (input.isAiVerdict) {
    if (input.reviewerOrcidId || input.signedPayloadJws) {
      return { ok: false, reason: 'ai-must-not-sign' };
    }
  }
  if (input.signedPayloadJws && !input.reviewerOrcidId) {
    return { ok: false, reason: 'sign-requires-orcid' };
  }
  return {
    ok: true,
    payload: {
      verdict: input.verdict,
      bodyMarkdown: body,
      evidenceRefs: [...refs],
      signedPayloadJws: input.signedPayloadJws ?? null,
      reviewerOrcidId: input.reviewerOrcidId ?? null,
      isAiVerdict: input.isAiVerdict,
    },
  };
}

// ---------- Sign step ----------

export interface ApplySignatureInput {
  /** Row snapshot as the route just read it. */
  row: {
    id: string;
    reviewerPrincipalId: string;
    isAiVerdict: boolean;
    signedPayloadJws: string | null;
    withdrawnAt: Date | null;
  };
  callerPrincipalId: string;
  /** ORCID iD on file for the caller (loaded by route from
   * principal.orcid_id). */
  callerOrcidId: string | null;
  /** Detached JWS that the OAuth client produced. */
  signedPayloadJws: string;
  signatureAlgorithm: string;
}

export type ApplySignatureRejectReason =
  | 'not-found'
  | 'unauthorized'
  | 'ai-cannot-sign'
  | 'already-signed'
  | 'withdrawn'
  | 'no-orcid-linked'
  | 'empty-jws';

export type ApplySignatureValidation =
  | {
      ok: true;
      update: {
        signedPayloadJws: string;
        orcidSignedAt: Date;
        signatureAlgorithm: string;
        reviewerOrcidId: string;
      };
    }
  | { ok: false; reason: ApplySignatureRejectReason };

export function validateApplySignature(
  input: ApplySignatureInput,
  now: Date = new Date(),
): ApplySignatureValidation {
  if (input.row.reviewerPrincipalId !== input.callerPrincipalId) {
    return { ok: false, reason: 'unauthorized' };
  }
  if (input.row.withdrawnAt) {
    return { ok: false, reason: 'withdrawn' };
  }
  if (input.row.isAiVerdict) {
    return { ok: false, reason: 'ai-cannot-sign' };
  }
  if (input.row.signedPayloadJws) {
    return { ok: false, reason: 'already-signed' };
  }
  if (!input.callerOrcidId) {
    return { ok: false, reason: 'no-orcid-linked' };
  }
  if (!input.signedPayloadJws.trim()) {
    return { ok: false, reason: 'empty-jws' };
  }
  return {
    ok: true,
    update: {
      signedPayloadJws: input.signedPayloadJws,
      orcidSignedAt: now,
      signatureAlgorithm: input.signatureAlgorithm,
      reviewerOrcidId: input.callerOrcidId,
    },
  };
}

// ---------- Withdraw step ----------

export interface WithdrawClaimReviewInput {
  row: {
    id: string;
    reviewerPrincipalId: string;
    withdrawnAt: Date | null;
  };
  callerPrincipalId: string;
  reason: string;
}

export type WithdrawRejectReason =
  | 'not-found'
  | 'unauthorized'
  | 'already-withdrawn'
  | 'empty-reason';

export type WithdrawValidation =
  | {
      ok: true;
      update: { withdrawnAt: Date; withdrawnReason: string };
    }
  | { ok: false; reason: WithdrawRejectReason };

export function validateWithdraw(
  input: WithdrawClaimReviewInput,
  now: Date = new Date(),
): WithdrawValidation {
  if (input.row.reviewerPrincipalId !== input.callerPrincipalId) {
    return { ok: false, reason: 'unauthorized' };
  }
  if (input.row.withdrawnAt) {
    return { ok: false, reason: 'already-withdrawn' };
  }
  const trimmed = input.reason.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty-reason' };
  }
  return {
    ok: true,
    update: { withdrawnAt: now, withdrawnReason: trimmed },
  };
}

// ---------- Lineage aggregation ----------

export interface LineageReviewRow {
  id: string;
  verdict: ClaimReviewVerdict;
  reviewerOrcidId: string | null;
  isAiVerdict: boolean;
  withdrawnAt: Date | null;
}

export interface LineageAggregate {
  endorses: number;
  challenges: number;
  refines: number;
  orcidSignedCount: number;
  aiVerdictCount: number;
  totalReviews: number;
  activeReviews: number;
  withdrawnCount: number;
}

/** Pure roll-up — caller passes the full review list for a claim and
 * gets every counter needed by the lineage public endpoint + the PM
 * mark refresh. */
export function aggregateLineage(rows: LineageReviewRow[]): LineageAggregate {
  const out: LineageAggregate = {
    endorses: 0,
    challenges: 0,
    refines: 0,
    orcidSignedCount: 0,
    aiVerdictCount: 0,
    totalReviews: rows.length,
    activeReviews: 0,
    withdrawnCount: 0,
  };
  for (const r of rows) {
    if (r.withdrawnAt) {
      out.withdrawnCount += 1;
      continue;
    }
    out.activeReviews += 1;
    switch (r.verdict) {
      case 'endorses':
        out.endorses += 1;
        break;
      case 'challenges':
        out.challenges += 1;
        break;
      case 'refines':
        out.refines += 1;
        break;
    }
    if (r.reviewerOrcidId) out.orcidSignedCount += 1;
    if (r.isAiVerdict) out.aiVerdictCount += 1;
  }
  return out;
}
