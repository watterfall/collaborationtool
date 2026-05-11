// Phase 5 Wave B B5 — Reviewer Inbox query + filter helpers.
//
// ADR-0016 §2.7. The Inbox dashboard is the reviewer's command surface:
// it lists claims that are open-for-review, lets the reviewer file a
// verdict in one click, and (when ORCID is linked) auto-routes to the
// sign step.
//
// Pure logic + types live here so:
//   - The Server Component (page.tsx) stays a thin DB-to-template wrapper.
//   - The client form (ClaimVerdictForm.tsx) shares the verdict + filter
//     vocabulary without duplicating constants.
//   - Tests cover the filter parser + "is this claim open-for-review"
//     predicate without a DB.

import type { ClaimReviewVerdict } from './claim-review';

/** Filter shape parsed from URL search params. All optional; missing
 * means "no constraint". */
export interface ReviewerInboxFilter {
  /** Scope to a specific document. */
  documentId?: string;
  /** Scope to a topic tag (Phase 6 will plumb claim.topic; Phase 5
   * accepts the param but treats it as a literal claim_id prefix
   * match — good enough to dogfood without new schema). */
  topicPrefix?: string;
  /** When true, only claims the caller has already verdicted (any
   * verdict, including withdrawn). Inverse: claims the caller has not
   * touched. Useful for "what's left for me?" vs "what have I done?". */
  mineOnly?: boolean;
  /** When true, exclude claims the caller has already verdicted on.
   * Mutually exclusive with `mineOnly`. */
  excludeMine?: boolean;
}

export const REVIEWER_INBOX_OPEN_AGING_DAYS = 7;

/** Pure parser — URL search params → typed filter. Unknown keys are
 * dropped silently. */
export function parseInboxFilter(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): ReviewerInboxFilter {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const raw = params[key];
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  };
  const filter: ReviewerInboxFilter = {};
  const documentId = get('documentId');
  if (documentId && documentId.trim()) filter.documentId = documentId.trim();
  const topicPrefix = get('topic');
  if (topicPrefix && topicPrefix.trim()) {
    filter.topicPrefix = topicPrefix.trim();
  }
  const mineOnly = get('mineOnly');
  if (mineOnly === '1' || mineOnly === 'true') filter.mineOnly = true;
  const excludeMine = get('excludeMine');
  if (excludeMine === '1' || excludeMine === 'true') filter.excludeMine = true;
  // mineOnly wins when both are set (defensive — UI never sets both).
  if (filter.mineOnly && filter.excludeMine) {
    delete filter.excludeMine;
  }
  return filter;
}

export interface InboxClaimRow {
  claimId: string;
  claimText: string;
  documentOriginId: string | null;
  createdAt: Date;
  createdByKind: string;
}

export interface InboxReviewSlim {
  claimId: string;
  verdict: ClaimReviewVerdict;
  reviewerPrincipalId: string;
  reviewerOrcidId: string | null;
  isAiVerdict: boolean;
  withdrawnAt: Date | null;
}

export interface InboxEntry {
  claim: InboxClaimRow;
  hasEndorsingHuman: boolean;
  callerVerdict: ClaimReviewVerdict | null;
  agingDays: number;
}

/** Pure assembly — given the candidate claims, every claim_review row
 * touching them, and the caller's principal id, build the inbox entry
 * list filtered by the parsed filter. */
export function assembleInbox(
  claims: InboxClaimRow[],
  reviews: InboxReviewSlim[],
  callerPrincipalId: string,
  filter: ReviewerInboxFilter,
  now: Date = new Date(),
): InboxEntry[] {
  const reviewsByClaim = new Map<string, InboxReviewSlim[]>();
  for (const r of reviews) {
    const bucket = reviewsByClaim.get(r.claimId);
    if (bucket) bucket.push(r);
    else reviewsByClaim.set(r.claimId, [r]);
  }

  const out: InboxEntry[] = [];
  for (const c of claims) {
    const rs = reviewsByClaim.get(c.claimId) ?? [];
    const hasEndorsingHuman = rs.some(
      (r) =>
        r.verdict === 'endorses' && !r.isAiVerdict && r.withdrawnAt === null,
    );
    const callerVerdict =
      rs.find(
        (r) =>
          r.reviewerPrincipalId === callerPrincipalId && r.withdrawnAt === null,
      )?.verdict ?? null;
    const agingDays = Math.floor(
      (now.getTime() - c.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Apply filter constraints.
    if (filter.documentId && c.documentOriginId !== filter.documentId) continue;
    if (filter.topicPrefix && !c.claimId.startsWith(filter.topicPrefix)) continue;
    if (filter.mineOnly && callerVerdict === null) continue;
    if (filter.excludeMine && callerVerdict !== null) continue;

    // Default Inbox view: claim has no endorsing human verdict AND
    // aging >= OPEN_AGING_DAYS. mineOnly view bypasses both gates so
    // the reviewer can see their own active verdicts.
    if (!filter.mineOnly) {
      if (hasEndorsingHuman) continue;
      if (agingDays < REVIEWER_INBOX_OPEN_AGING_DAYS) continue;
    }

    out.push({
      claim: c,
      hasEndorsingHuman,
      callerVerdict,
      agingDays,
    });
  }

  // Most-aging first — the dogfood loop is "reviewer sees the staleness
  // and acts"; newest claims sort under them.
  out.sort((a, b) => b.agingDays - a.agingDays);
  return out;
}
