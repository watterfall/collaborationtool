// Phase 5 Wave B B3 — POST /api/claim/[claimId]/review (submit) +
//                      GET  /api/claim/[claimId]/review (list).
//
// ADR-0016 §2.3 endpoints 1 + 2.
//
// Submit:
//   capability: claim.review:create
//   body: { verdict, bodyMarkdown, evidenceRefs?, isAiVerdict? }
//   → 201 { reviewId, provenanceId }
//   invariants enforced by validateSubmitClaimReview (lib/claim-review.ts)
//
// List:
//   capability: claim.review:read
//   → 200 { reviews: [...], aggregate: { endorses, challenges, refines, ... } }

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext } from '@collaborationtool/permissions';
import {
  newProvenanceId,
  newClaimLinkId, // uuidv7 — reused for claim_review.id
} from '@collaborationtool/editor-core';

import { auth } from '@/lib/auth';
import {
  aggregateLineage,
  validateSubmitClaimReview,
  type ClaimReviewVerdict,
} from '@/lib/claim-review';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

interface SubmitBody {
  verdict?: unknown;
  bodyMarkdown?: unknown;
  evidenceRefs?: unknown;
  isAiVerdict?: unknown;
}

export async function POST(
  request: Request,
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

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();

  // Load claim → document for capability scope.
  const claimRows = await db
    .select({
      id: schema.claim.id,
      documentOriginId: schema.claim.documentOriginId,
    })
    .from(schema.claim)
    .where(eq(schema.claim.id, claimId))
    .limit(1);
  const claim = claimRows[0];
  if (!claim) {
    return NextResponse.json({ error: 'claim-not-found' }, { status: 404 });
  }
  if (!claim.documentOriginId) {
    return NextResponse.json(
      { error: 'claim-not-anchored', detail: 'claim has no document_origin_id' },
      { status: 409 },
    );
  }

  const principalContext = await loadPrincipalContext(
    db,
    principalId,
    claim.documentOriginId,
  );
  if (!principalContext) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }
  if (!principalContext.documentCapabilities.has('claim.review:create')) {
    return NextResponse.json(
      { error: 'capability-denied', verb: 'claim.review:create' },
      { status: 403 },
    );
  }

  // Submit-time: reviewer_orcid_id + signed_payload_jws stay null.
  // The sign endpoint (POST /api/claim/<id>/review/<id>/sign) fills
  // them after the OIDC dance — per ADR-0016 §2.3 sign-and-submit are
  // two separate POSTs so the OAuth roundtrip doesn't block submit.
  const validation = validateSubmitClaimReview({
    verdict: (typeof body.verdict === 'string'
      ? body.verdict
      : '') as ClaimReviewVerdict,
    bodyMarkdown: typeof body.bodyMarkdown === 'string' ? body.bodyMarkdown : '',
    evidenceRefs: Array.isArray(body.evidenceRefs)
      ? (body.evidenceRefs as unknown[]).filter(
          (x): x is string => typeof x === 'string',
        )
      : [],
    isAiVerdict: body.isAiVerdict === true,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400 },
    );
  }

  const reviewId = newClaimLinkId();
  const provenanceId = newProvenanceId();
  const now = new Date();

  // Provenance row (required FK). actor=agent for AI verdict; user otherwise.
  await db.insert(schema.provenance).values({
    id: provenanceId,
    actorPrincipalId: principalId,
    actorKind: validation.payload.isAiVerdict ? 'agent' : 'user',
    triggeredAt: now,
    inputBlockIds: null,
    inputDocumentIds: [claim.documentOriginId],
    toolCalls: null,
    approvalChain: null,
  });

  await db.insert(schema.claimReview).values({
    id: reviewId,
    claimId,
    reviewerPrincipalId: principalId,
    reviewerOrcidId: validation.payload.reviewerOrcidId,
    isAiVerdict: validation.payload.isAiVerdict,
    verdict: validation.payload.verdict,
    bodyMarkdown: validation.payload.bodyMarkdown,
    evidenceRefs: validation.payload.evidenceRefs,
    signedPayloadJws: validation.payload.signedPayloadJws,
    provenanceId,
    submittedAt: now,
  });

  return NextResponse.json(
    { reviewId, provenanceId },
    { status: 201 },
  );
}

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
      documentOriginId: schema.claim.documentOriginId,
    })
    .from(schema.claim)
    .where(eq(schema.claim.id, claimId))
    .limit(1);
  const claim = claimRows[0];
  if (!claim) {
    return NextResponse.json({ error: 'claim-not-found' }, { status: 404 });
  }
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

  const rows = await db
    .select()
    .from(schema.claimReview)
    .where(eq(schema.claimReview.claimId, claimId));

  const aggregate = aggregateLineage(
    rows.map((r) => ({
      id: r.id,
      verdict: r.verdict as ClaimReviewVerdict,
      reviewerOrcidId: r.reviewerOrcidId,
      orcidSignedAt: r.orcidSignedAt,
      signedPayloadJws: r.signedPayloadJws,
      isAiVerdict: r.isAiVerdict,
      withdrawnAt: r.withdrawnAt,
    })),
  );

  return NextResponse.json({
    reviews: rows.map((r) => ({
      id: r.id,
      claimId: r.claimId,
      reviewerPrincipalId: r.reviewerPrincipalId,
      reviewerOrcidId: r.reviewerOrcidId,
      isAiVerdict: r.isAiVerdict,
      verdict: r.verdict,
      bodyMarkdown: r.bodyMarkdown,
      evidenceRefs: r.evidenceRefs,
      signedPayloadJws: r.signedPayloadJws,
      orcidSignedAt: r.orcidSignedAt,
      submittedAt: r.submittedAt,
      withdrawnAt: r.withdrawnAt,
      withdrawnReason: r.withdrawnReason,
    })),
    aggregate,
  });
}
