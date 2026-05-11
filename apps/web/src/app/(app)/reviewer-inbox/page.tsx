// Phase 5 Wave B B5 — Reviewer Inbox dashboard (ADR-0016 §2.7).
//
// Server Component lists "open-for-review" claims for the signed-in
// reviewer principal. Pure DB-to-template — filter parsing + entry
// assembly + sort live in `lib/reviewer-inbox.ts` so tests cover the
// behavior without spinning up the page.
//
// Filter URL params:
//   ?documentId=<id>   scope to one paper
//   ?topic=<prefix>    Phase 5 stub — matches claim_id startsWith
//   ?mineOnly=1        show only claims the caller has verdicted on
//   ?excludeMine=1     hide claims the caller has verdicted on
//
// Design.md tokens only — hairline list rows, MonoDisc kind=reviewer
// monogram R, StatusPill for verdict status, accent triad for verdict
// badges. Reject grep clean.

import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { Button, HairlineRule, MonoDisc, StatusPill } from '@/components/design';
import { auth } from '@/lib/auth';
import type { ClaimReviewVerdict } from '@/lib/claim-review';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';
import {
  REVIEWER_INBOX_OPEN_AGING_DAYS,
  assembleInbox,
  parseInboxFilter,
  type InboxClaimRow,
  type InboxReviewSlim,
} from '@/lib/reviewer-inbox';

import { ClaimVerdictForm } from './ClaimVerdictForm';

const PAGE_SIZE = 50;

export const dynamic = 'force-dynamic';

const VERDICT_LABEL: Record<ClaimReviewVerdict, { zh: string; en: string }> = {
  endorses: { zh: '同意', en: 'Endorse' },
  challenges: { zh: '挑战', en: 'Challenge' },
  refines: { zh: '收窄', en: 'Refine' },
};

export default async function ReviewerInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    throw new Error(
      `No Principal row for user ${session.user.id}. Run principal-bridge.`,
    );
  }

  const sp = await searchParams;
  const filter = parseInboxFilter(sp);

  const db = getDb();

  // Candidate claims — agent-created, broad scope. We over-fetch and
  // filter in JS via assembleInbox() so the same SoT predicates serve
  // tests + future caching layers.
  const candidateClaimRows = await db
    .select({
      claimId: schema.claim.id,
      claimText: schema.claim.text,
      documentOriginId: schema.claim.documentOriginId,
      createdAt: schema.claim.createdAt,
      createdByKind: schema.principal.kind,
      claimStatus: schema.claim.status,
    })
    .from(schema.claim)
    .innerJoin(schema.principal, eq(schema.principal.id, schema.claim.createdBy))
    .where(
      and(
        eq(schema.principal.kind, 'agent'),
        // 'deprecated' and 'superseded' claims are excluded — the dogfood
        // signal is "stale ai-suggested / human-reviewed / approved claim
        // that nobody has reviewed". inArray with the keep-list is
        // safer than a NOT IN (deprecated / superseded).
        inArray(schema.claim.status, ['ai-suggested', 'human-reviewed', 'approved']),
      ),
    )
    .orderBy(desc(schema.claim.createdAt))
    .limit(PAGE_SIZE * 4); // headroom — assembleInbox filters down

  const claims: InboxClaimRow[] = candidateClaimRows.map((r) => ({
    claimId: r.claimId,
    claimText: r.claimText,
    documentOriginId: r.documentOriginId,
    createdAt: r.createdAt,
    createdByKind: r.createdByKind,
  }));

  const reviewRows =
    claims.length > 0
      ? await db
          .select({
            claimId: schema.claimReview.claimId,
            verdict: schema.claimReview.verdict,
            reviewerPrincipalId: schema.claimReview.reviewerPrincipalId,
            reviewerOrcidId: schema.claimReview.reviewerOrcidId,
            isAiVerdict: schema.claimReview.isAiVerdict,
            withdrawnAt: schema.claimReview.withdrawnAt,
          })
          .from(schema.claimReview)
          .where(
            inArray(
              schema.claimReview.claimId,
              claims.map((c) => c.claimId),
            ),
          )
      : [];

  const reviews: InboxReviewSlim[] = reviewRows.map((r) => ({
    claimId: r.claimId,
    verdict: r.verdict as ClaimReviewVerdict,
    reviewerPrincipalId: r.reviewerPrincipalId,
    reviewerOrcidId: r.reviewerOrcidId,
    isAiVerdict: r.isAiVerdict,
    withdrawnAt: r.withdrawnAt,
  }));

  const entries = assembleInbox(claims, reviews, principalId, filter).slice(
    0,
    PAGE_SIZE,
  );

  return (
    <main className="reviewer-inbox-page">
      <header>
        <h1>
          <span lang="zh">评审收件箱</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Reviewer Inbox</span>
        </h1>
        <p>
          <span lang="zh">
            待评审 claim：超过 {REVIEWER_INBOX_OPEN_AGING_DAYS} 天无人类背书
          </span>
          <span aria-hidden="true"> · </span>
          <span lang="en">
            Claims open for review (no human endorsement after{' '}
            {REVIEWER_INBOX_OPEN_AGING_DAYS} days)
          </span>
        </p>
      </header>

      <nav aria-label="filter">
        <FilterLinks active={filter} />
      </nav>

      <HairlineRule />

      {entries.length === 0 ? (
        <p>
          <em>
            <span lang="zh">收件箱已清空 — 等待下一轮 AI 提议</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">Inbox empty — waiting on the next AI proposal cycle</span>
          </em>
        </p>
      ) : (
        <ol className="reviewer-inbox-list">
          {entries.map((e) => (
            <li key={e.claim.claimId} className="reviewer-inbox-entry">
              <div className="reviewer-inbox-entry-head">
                <MonoDisc kind="human" monogram="R" />
                <div>
                  <p>
                    <strong>{e.claim.claimText}</strong>
                  </p>
                  <small>
                    <code>{e.claim.claimId.slice(0, 16)}</code>
                    <span aria-hidden="true"> · </span>
                    {e.claim.documentOriginId ? (
                      <Link
                        href={`/editor/${encodeURIComponent(e.claim.documentOriginId)}`}
                      >
                        <span lang="zh">打开文档</span>
                        <span aria-hidden="true"> · </span>
                        <span lang="en">Open document</span>
                      </Link>
                    ) : null}
                    <span aria-hidden="true"> · </span>
                    <span lang="zh">{e.agingDays} 天前</span>
                    <span aria-hidden="true"> · </span>
                    <span lang="en">{e.agingDays}d ago</span>
                  </small>
                  {e.callerVerdict ? (
                    <StatusPill
                      status="applied"
                      label={`已 ${VERDICT_LABEL[e.callerVerdict].zh}`}
                      labelEn={`Your ${VERDICT_LABEL[e.callerVerdict].en}`}
                    />
                  ) : null}
                </div>
              </div>
              <ClaimVerdictForm
                claimId={e.claim.claimId}
                hasExistingCallerVerdict={e.callerVerdict !== null}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function FilterLinks({
  active,
}: {
  active: ReturnType<typeof parseInboxFilter>;
}): React.ReactElement {
  // Three orthogonal scopes; each link toggles its own param without
  // dropping the others (except mineOnly/excludeMine which are mutex).
  return (
    <ul className="reviewer-inbox-filter">
      <li>
        <Link href="/reviewer-inbox" className={isDefault(active) ? 'is-active' : ''}>
          <span lang="zh">全部</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">All</span>
        </Link>
      </li>
      <li>
        <Link
          href="/reviewer-inbox?excludeMine=1"
          className={active.excludeMine ? 'is-active' : ''}
        >
          <span lang="zh">待我评审</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Awaiting me</span>
        </Link>
      </li>
      <li>
        <Link
          href="/reviewer-inbox?mineOnly=1"
          className={active.mineOnly ? 'is-active' : ''}
        >
          <span lang="zh">我已评审</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Mine</span>
        </Link>
      </li>
    </ul>
  );
}

function isDefault(
  active: ReturnType<typeof parseInboxFilter>,
): boolean {
  return !active.documentId && !active.topicPrefix && !active.mineOnly && !active.excludeMine;
}

void Button;
