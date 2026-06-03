// Phase 5 Wave B B3 — POST /api/claim/[claimId]/review/[reviewId]/sign
//
// ADR-0016 §2.3 endpoint 3. Two-step sign keeps the OIDC dance out of
// the submit hot path: client gets an ORCID id_token (JWT, RS256) via
// the existing better-auth genericOAuth flow (ADR-0015 §2.1), then
// POSTs it here. We persist it as the detached JWS payload + stamp
// orcid_signed_at; downstream tools verify via public ORCID JWKS
// independent of this platform (ADR-0015 §2.2 + ADR-0016 §2.9.3).
//
// Phase 5 NOTE: we treat the client-supplied id_token AS the JWS
// payload (it already is a JWT — header.payload.signature). Real
// verify-on-write against ORCID JWKS is Wave B dogfood gate criterion
// 3; until then we accept-and-mark `signature_verified_at` null.
//
// Body: { orcidIdToken: string, orcidIdParam?: string }
//
// `orcidIdParam` is the ORCID iD the client believes it has linked
// (Phase 5 stub — once `principal.orcid_id` column lands per ADR-0015,
// the route loads it from there and ignores client-supplied value).

import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import {
  resolveReviewSignatureInput,
  validateApplySignature,
} from '@/lib/claim-review';
import { getDb } from '@/lib/db';
import { getOrcidIdentityForUser } from '@/lib/orcid-lookup';
import { getPrincipalIdForUser } from '@/lib/principal';

interface SignBody {
  orcidIdToken?: unknown;
  orcidIdParam?: unknown;
}

const ORCID_ID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ claimId: string; reviewId: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { claimId, reviewId } = await ctx.params;
  if (!claimId || !reviewId) {
    return NextResponse.json({ error: 'missing-id' }, { status: 400 });
  }

  let body: SignBody;
  try {
    body = (await request.json()) as SignBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const orcidIdToken =
    typeof body.orcidIdToken === 'string' ? body.orcidIdToken : '';
  const orcidIdParam =
    typeof body.orcidIdParam === 'string' ? body.orcidIdParam : null;
  if (orcidIdParam && !ORCID_ID_RE.test(orcidIdParam)) {
    return NextResponse.json({ error: 'invalid-orcid-id' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }
  const linkedIdentity = await getOrcidIdentityForUser(session.user.id);
  const signatureInput = resolveReviewSignatureInput({
    linkedIdentity,
    clientOrcidId: orcidIdParam,
    clientSignedPayloadJws: orcidIdToken,
  });

  const db = getDb();

  const rows = await db
    .select({
      id: schema.claimReview.id,
      claimId: schema.claimReview.claimId,
      reviewerPrincipalId: schema.claimReview.reviewerPrincipalId,
      isAiVerdict: schema.claimReview.isAiVerdict,
      signedPayloadJws: schema.claimReview.signedPayloadJws,
      withdrawnAt: schema.claimReview.withdrawnAt,
    })
    .from(schema.claimReview)
    .where(
      and(
        eq(schema.claimReview.id, reviewId),
        eq(schema.claimReview.claimId, claimId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const validation = validateApplySignature({
    row,
    callerPrincipalId: principalId,
    callerOrcidId: signatureInput.callerOrcidId,
    signedPayloadJws: signatureInput.signedPayloadJws,
    signatureAlgorithm: 'RS256',
  });
  if (!validation.ok) {
    const status =
      validation.reason === 'unauthorized'
        ? 403
        : validation.reason === 'no-orcid-linked'
          ? 412
          : validation.reason === 'empty-jws'
            ? 400
            : 409;
    return NextResponse.json({ error: validation.reason }, { status });
  }

  await db
    .update(schema.claimReview)
    .set({
      signedPayloadJws: validation.update.signedPayloadJws,
      orcidSignedAt: validation.update.orcidSignedAt,
      signatureAlgorithm: validation.update.signatureAlgorithm,
      reviewerOrcidId: validation.update.reviewerOrcidId,
    })
    .where(eq(schema.claimReview.id, reviewId));

  return NextResponse.json({
    signedPayloadJws: validation.update.signedPayloadJws,
    orcidSignedAt: validation.update.orcidSignedAt.toISOString(),
    reviewerOrcidId: validation.update.reviewerOrcidId,
  });
}
