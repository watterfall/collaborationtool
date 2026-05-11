// Phase 5 Wave B B6 — public claim review lineage page.
//
// Renders the review DAG for a single claim: list of reviewers, their
// verdicts, ORCID iD (linked to ORCID profile), signed-at timestamp,
// withdrawn badge when applicable. Each row exposes the raw
// signed_payload_jws so a third party can independently verify against
// ORCID's public JWKS without trusting this platform.
//
// Phase 5 scope: route requires session (matches /api/claim/[id]/lineage).
// Wave C dogfood gate (improvement-plan §三 Wave C) flips this to
// optional-session so the public web view is truly anonymous — at that
// point both this page and the API route's auth check change in
// lockstep.

import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { HairlineRule, MonoDisc, StatusPill } from '@/components/design';
import { auth } from '@/lib/auth';
import {
  aggregateLineage,
  type ClaimReviewVerdict,
} from '@/lib/claim-review';
import { getDb } from '@/lib/db';

const VERDICT_LABEL: Record<
  ClaimReviewVerdict,
  { zh: string; en: string; accent: 'moss' | 'ox' | 'ink' }
> = {
  endorses: { zh: '同意', en: 'Endorse', accent: 'moss' },
  challenges: { zh: '挑战', en: 'Challenge', accent: 'ox' },
  refines: { zh: '收窄', en: 'Refine', accent: 'ink' },
};

export const dynamic = 'force-dynamic';

export default async function ClaimLineagePage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const { claimId } = await params;

  const db = getDb();
  const claimRows = await db
    .select({
      id: schema.claim.id,
      text: schema.claim.text,
      claimType: schema.claim.claimType,
      status: schema.claim.status,
      documentOriginId: schema.claim.documentOriginId,
      createdAt: schema.claim.createdAt,
    })
    .from(schema.claim)
    .where(eq(schema.claim.id, claimId))
    .limit(1);
  const claim = claimRows[0];
  if (!claim) {
    return (
      <main>
        <h1>
          <span lang="zh">claim 不存在</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Claim not found</span>
        </h1>
      </main>
    );
  }

  const reviews = await db
    .select()
    .from(schema.claimReview)
    .where(eq(schema.claimReview.claimId, claimId));

  const sortedReviews = reviews
    .slice()
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  const allEvidenceIds = Array.from(
    new Set(sortedReviews.flatMap((r) => r.evidenceRefs)),
  );
  const evidenceChain =
    allEvidenceIds.length > 0
      ? await db
          .select({
            id: schema.evidence.id,
            excerpt: schema.evidence.excerpt,
            relation: schema.evidence.relation,
          })
          .from(schema.evidence)
          .where(inArray(schema.evidence.id, allEvidenceIds))
      : [];
  const evidenceById = new Map(evidenceChain.map((e) => [e.id, e]));

  const aggregate = aggregateLineage(
    sortedReviews.map((r) => ({
      id: r.id,
      verdict: r.verdict as ClaimReviewVerdict,
      reviewerOrcidId: r.reviewerOrcidId,
      isAiVerdict: r.isAiVerdict,
      withdrawnAt: r.withdrawnAt,
    })),
  );

  return (
    <main className="claim-lineage-page">
      <header>
        <h1>
          <span lang="zh">Claim 评审血统</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Claim review lineage</span>
        </h1>
        <blockquote>
          <p>{claim.text}</p>
          <small>
            <code>{claim.id.slice(0, 16)}</code>
            <span aria-hidden="true"> · </span>
            <span lang="zh">{claim.claimType}</span>
            <span aria-hidden="true"> · </span>
            <span lang="zh">状态</span> <span lang="en">status</span>{' '}
            <em>{claim.status}</em>
            {claim.documentOriginId ? (
              <>
                <span aria-hidden="true"> · </span>
                <Link
                  href={`/editor/${encodeURIComponent(claim.documentOriginId)}`}
                >
                  <span lang="zh">回到文档</span>
                  <span aria-hidden="true"> · </span>
                  <span lang="en">Back to document</span>
                </Link>
              </>
            ) : null}
          </small>
        </blockquote>
      </header>

      <section aria-label="aggregate">
        <p>
          <strong>
            <span lang="zh">{aggregate.activeReviews} 条有效评审</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">{aggregate.activeReviews} active reviews</span>
          </strong>
          <span aria-hidden="true"> · </span>
          <span lang="zh">
            同意 {aggregate.endorses} / 挑战 {aggregate.challenges} / 收窄{' '}
            {aggregate.refines}
          </span>
          <span aria-hidden="true"> · </span>
          <span lang="en">
            endorses {aggregate.endorses} / challenges {aggregate.challenges} /
            refines {aggregate.refines}
          </span>
        </p>
        <p>
          <small>
            <span lang="zh">
              ORCID 签名 {aggregate.orcidSignedCount} 条 · AI {aggregate.aiVerdictCount} 条 · 撤回 {aggregate.withdrawnCount} 条
            </span>
            <span aria-hidden="true"> · </span>
            <span lang="en">
              {aggregate.orcidSignedCount} ORCID-signed · {aggregate.aiVerdictCount} AI · {aggregate.withdrawnCount} withdrawn
            </span>
          </small>
        </p>
      </section>

      <HairlineRule />

      {sortedReviews.length === 0 ? (
        <p>
          <em>
            <span lang="zh">尚未有 reviewer 出过判断</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">No reviewer verdicts yet</span>
          </em>
        </p>
      ) : (
        <ol className="claim-lineage-list">
          {sortedReviews.map((r) => {
            const verdict = r.verdict as ClaimReviewVerdict;
            const label = VERDICT_LABEL[verdict];
            return (
              <li key={r.id} data-verdict={verdict} data-withdrawn={r.withdrawnAt ? 'true' : 'false'}>
                <div className="claim-lineage-row-head">
                  <MonoDisc
                    kind={r.isAiVerdict ? 'agent' : 'human'}
                    monogram={r.isAiVerdict ? 'A' : 'R'}
                  />
                  <div>
                    <p>
                      <strong className={`accent-${label.accent}`}>
                        <span lang="zh">{label.zh}</span>
                        <span aria-hidden="true"> · </span>
                        <span lang="en">{label.en}</span>
                      </strong>
                      {r.withdrawnAt ? (
                        <>
                          {' '}
                          <StatusPill
                            status="blocked"
                            label="已撤回"
                            labelEn="Withdrawn"
                          />
                        </>
                      ) : null}
                    </p>
                    <small>
                      {r.reviewerOrcidId ? (
                        <a
                          href={`https://orcid.org/${r.reviewerOrcidId}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={`ORCID profile ${r.reviewerOrcidId}`}
                        >
                          {r.reviewerOrcidId}
                        </a>
                      ) : r.isAiVerdict ? (
                        <em>
                          <span lang="zh">AI 评审</span>
                          <span aria-hidden="true"> · </span>
                          <span lang="en">AI reviewer</span>
                        </em>
                      ) : (
                        <em>
                          <span lang="zh">未 link ORCID</span>
                          <span aria-hidden="true"> · </span>
                          <span lang="en">No linked ORCID</span>
                        </em>
                      )}
                      <span aria-hidden="true"> · </span>
                      <time dateTime={r.submittedAt.toISOString()}>
                        {r.submittedAt.toISOString().slice(0, 10)}
                      </time>
                      {r.orcidSignedAt ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span lang="zh">已签</span>
                          <span aria-hidden="true"> · </span>
                          <span lang="en">signed</span>
                        </>
                      ) : null}
                    </small>
                  </div>
                </div>
                <p>{r.bodyMarkdown}</p>
                {r.evidenceRefs.length > 0 ? (
                  <details>
                    <summary>
                      <span lang="zh">引用证据 ({r.evidenceRefs.length})</span>
                      <span aria-hidden="true"> · </span>
                      <span lang="en">Evidence ({r.evidenceRefs.length})</span>
                    </summary>
                    <ul>
                      {r.evidenceRefs.map((id) => {
                        const e = evidenceById.get(id);
                        return (
                          <li key={id}>
                            <code>{id.slice(0, 12)}</code>
                            {e ? (
                              <>
                                <span aria-hidden="true"> · </span>
                                <em>{e.relation}</em>
                                <span aria-hidden="true"> · </span>
                                <span>{e.excerpt.slice(0, 200)}</span>
                              </>
                            ) : (
                              <>
                                {' '}
                                <em>
                                  <span lang="zh">悬空引用</span>
                                  <span aria-hidden="true"> · </span>
                                  <span lang="en">dangling ref</span>
                                </em>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
                {r.signedPayloadJws ? (
                  <details>
                    <summary>
                      <span lang="zh">ORCID-signed JWS — 第三方可独立验证</span>
                      <span aria-hidden="true"> · </span>
                      <span lang="en">ORCID-signed JWS (independently verifiable)</span>
                    </summary>
                    <pre>{r.signedPayloadJws}</pre>
                    <p>
                      <small>
                        <span lang="zh">用 ORCID 公开 JWKS 验证：</span>
                        <span aria-hidden="true"> · </span>
                        <span lang="en">Verify with ORCID JWKS:</span>{' '}
                        <a
                          href="https://orcid.org/oauth/jwks"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          https://orcid.org/oauth/jwks
                        </a>
                      </small>
                    </p>
                  </details>
                ) : null}
                {r.withdrawnAt && r.withdrawnReason ? (
                  <p>
                    <small>
                      <span lang="zh">撤回理由</span>
                      <span aria-hidden="true"> · </span>
                      <span lang="en">withdraw reason</span>:{' '}
                      <em>{r.withdrawnReason}</em>
                    </small>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
