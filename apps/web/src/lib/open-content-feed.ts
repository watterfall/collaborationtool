// Phase 6 W2 P2 — Open content feed query helpers (ADR-0018 §2.5 F7).
//
// Server-side queries that back GET /api/open-content/feed and the web
// /open landing surface. Public surface, NO auth required (per spec §3
// web client open-content reader role).
//
// Filters supported (Phase 6 W2 baseline):
//   - status (default 'open' for question feed)
//   - domainTags (intersection match)
//   - kind (which entity table; default = open_question)
//   - sinceCreatedAt / untilCreatedAt (time window)
//   - limit (default 50, max 200 — pagination via prev_cursor in W3+)

export type FeedKind = 'open_question' | 'open_dataset' | 'share_snapshot';

export interface FeedFilter {
  kind: FeedKind;
  status?: 'open' | 'answered' | 'withdrawn';
  domainTags?: readonly string[];
  sinceCreatedAt?: Date;
  untilCreatedAt?: Date;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Parse raw URL search params into a typed FeedFilter. Caller passes
 * a `URLSearchParams` (Next.js route extracts from request).
 *
 * Invariants:
 *   - kind defaults to 'open_question' when missing
 *   - status only honored for open_question kind (other entities don't
 *     have status enum)
 *   - domainTags split on ',' (URL `?domainTags=ai,physics`)
 *   - limit clamped to [1, MAX_LIMIT]
 *   - invalid date strings → undefined (not error — keep parser lenient)
 */
export function parseFeedFilter(params: URLSearchParams): FeedFilter {
  const rawKind = params.get('kind');
  const kind: FeedKind = (['open_question', 'open_dataset', 'share_snapshot'] as const).includes(
    rawKind as FeedKind,
  )
    ? (rawKind as FeedKind)
    : 'open_question';

  const status = (params.get('status') ?? undefined) as FeedFilter['status'];
  const validStatus =
    kind === 'open_question' && status && ['open', 'answered', 'withdrawn'].includes(status)
      ? status
      : kind === 'open_question'
        ? 'open' // default for question feed
        : undefined;

  const tagsRaw = params.get('domainTags');
  const domainTags =
    tagsRaw && tagsRaw.length > 0
      ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;

  const since = params.get('sinceCreatedAt');
  const until = params.get('untilCreatedAt');
  const sinceCreatedAt = since ? parseDateOrUndef(since) : undefined;
  const untilCreatedAt = until ? parseDateOrUndef(until) : undefined;

  let limit = parseInt(params.get('limit') ?? '', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return {
    kind,
    ...(validStatus !== undefined ? { status: validStatus } : {}),
    ...(domainTags !== undefined ? { domainTags } : {}),
    ...(sinceCreatedAt !== undefined ? { sinceCreatedAt } : {}),
    ...(untilCreatedAt !== undefined ? { untilCreatedAt } : {}),
    limit,
  };
}

function parseDateOrUndef(s: string): Date | undefined {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

// ---------- Open question answer service ----------

/**
 * F7 stranger-reply validator. Called by POST /api/open-question/[id]/answer.
 *
 * Stranger publishes an open_peer_review with:
 *   - target_kind = 'question'
 *   - target_id = question.id
 *   - reviewer_orcid_id required (no anonymous in Merkle log)
 *   - verdict: typically 'endorses' (answer agrees) / 'refines' (partial)
 *     / 'challenges' (counter-question, evidence required)
 *
 * This validator wraps the generic publish path with question-specific
 * preconditions (question must exist + status = 'open' + reviewer
 * different from asker).
 */
export interface OpenQuestionAnswerInput {
  questionId: string;
  /** Loaded by route from open_question table. */
  questionRow: {
    id: string;
    status: 'open' | 'answered' | 'withdrawn';
    askerPrincipalId: string;
  } | null;
  reviewerPrincipalId: string;
  reviewerOrcidId: string;
}

export type AnswerOpenQuestionRejectReason =
  | 'question-not-found'
  | 'question-not-open'
  | 'cannot-self-answer'
  | 'reviewer-no-orcid';

export type AnswerOpenQuestionValidation =
  | { ok: true; questionId: string }
  | { ok: false; reason: AnswerOpenQuestionRejectReason };

export function validateOpenQuestionAnswer(
  input: OpenQuestionAnswerInput,
): AnswerOpenQuestionValidation {
  if (!input.questionRow) {
    return { ok: false, reason: 'question-not-found' };
  }
  if (input.questionRow.status !== 'open') {
    return { ok: false, reason: 'question-not-open' };
  }
  if (input.questionRow.askerPrincipalId === input.reviewerPrincipalId) {
    return { ok: false, reason: 'cannot-self-answer' };
  }
  if (!input.reviewerOrcidId || input.reviewerOrcidId.trim().length === 0) {
    return { ok: false, reason: 'reviewer-no-orcid' };
  }
  return { ok: true, questionId: input.questionRow.id };
}
