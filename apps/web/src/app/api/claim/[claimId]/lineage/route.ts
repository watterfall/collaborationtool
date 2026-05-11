// Phase 5 Wave B B6 (kickoff backend) — GET /api/claim/[claimId]/lineage
//
// ADR-0016 §2.3 endpoint 5 — public review DAG. Returns the claim +
// every claim_review row (including withdrawn) + the evidence rows
// each verdict references. Front-end Wave B6 will render this as a
// directed graph; the JSON shape is the data contract.
//
// Capability: claim.review:read. Commenter+ default holds it (ADR-0016
// §2.4); unauthenticated public access is left to Wave B6 dogfood
// gate criteria 4 (公共视图渲染 + 未登录用户访问) — when we
// implement that, this endpoint will be the data source whose
// session check moves to optional.

import { and, eq, inArray } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext } from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import {
  aggregateLineage,
  type ClaimReviewVerdict,
} from '@/lib/claim-review';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ claimId: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { claimId } = await ctx.params;
  if (!claimId) {
    return NextResponse.json({ error: 'missing-claim-id' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const claimRows = await db
    .select({
      id: schema.claim.id,
      text: schema.claim.text,
      claimType: schema.claim.claimType,
      status: schema.claim.status,
      confidence: schema.claim.confidence,
      documentOriginId: schema.claim.documentOriginId,
      createdAt: schema.claim.createdAt,
    })
    .from(schema.claim)
    .where(eq(schema.claim.id, claimId))
    .limit(1);
  const claim = claimRows[0];
  if (!claim) {
    return NextResponse.json({ error: 'claim-not-found' }, { status: 404 });
  }

  // claim.review:read scope. claim with no document_origin_id is an
  // orphan global claim — permit reads (no scoped owner to check
  // against). Otherwise verify per-doc capability.
  if (claim.documentOriginId) {
    const principalContext = await loadPrincipalContext(
      db,
      principalId,
      claim.documentOriginId,
    );
    if (!principalContext) {
      return NextResponse.json({ error: 'no-access' }, { status: 403 });
    }
    if (!principalContext.documentCapabilities.has('claim.review:read')) {
      return NextResponse.json(
        { error: 'capability-denied', verb: 'claim.review:read' },
        { status: 403 },
      );
    }
  }

  const reviews = await db
    .select()
    .from(schema.claimReview)
    .where(eq(schema.claimReview.claimId, claimId));

  // Collect every evidence_refs id and load referenced evidence rows.
  const allEvidenceIds = Array.from(
    new Set(
      reviews
        .flatMap((r) => r.evidenceRefs)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  const evidenceChain =
    allEvidenceIds.length > 0
      ? await db
          .select()
          .from(schema.evidence)
          .where(inArray(schema.evidence.id, allEvidenceIds))
      : [];

  const aggregate = aggregateLineage(
    reviews.map((r) => ({
      id: r.id,
      verdict: r.verdict as ClaimReviewVerdict,
      reviewerOrcidId: r.reviewerOrcidId,
      isAiVerdict: r.isAiVerdict,
      withdrawnAt: r.withdrawnAt,
    })),
  );

  return NextResponse.json({
    claim: {
      id: claim.id,
      text: claim.text,
      claimType: claim.claimType,
      status: claim.status,
      confidence: claim.confidence,
      documentOriginId: claim.documentOriginId,
      createdAt: claim.createdAt,
    },
    reviewDag: reviews
      .slice()
      .sort(
        (a, b) =>
          a.submittedAt.getTime() - b.submittedAt.getTime(),
      )
      .map((r) => ({
        id: r.id,
        verdict: r.verdict,
        reviewerPrincipalId: r.reviewerPrincipalId,
        reviewerOrcidId: r.reviewerOrcidId,
        isAiVerdict: r.isAiVerdict,
        bodyMarkdown: r.bodyMarkdown,
        evidenceRefs: r.evidenceRefs,
        orcidSignedAt: r.orcidSignedAt,
        submittedAt: r.submittedAt,
        withdrawnAt: r.withdrawnAt,
        withdrawnReason: r.withdrawnReason,
      })),
    evidenceChain,
    aggregate,
  });
}

// `and` import kept for symmetry with sibling routes (filtering by
// claim + review id in withdraw / sign). Drop when unused.
void and;
