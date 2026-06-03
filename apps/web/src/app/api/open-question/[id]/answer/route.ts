// POST /api/open-question/[id]/answer
//
// Authenticated stranger reply for public questions. The response is
// persisted as open_peer_review(target_kind='question') and chained into
// the open-content Merkle log in the same transaction.

import { contentHashHex } from '@collaborationtool/open-content';
import { desc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import {
  buildOpenQuestionAnswerContent,
  validateOpenQuestionAnswer,
} from '@/lib/open-content-feed';
import { resolveReviewSignatureInput } from '@/lib/claim-review';
import { getDb } from '@/lib/db';
import { getOrcidIdentityForUser } from '@/lib/orcid-lookup';
import { getPrincipalIdForUser } from '@/lib/principal';
import { validatePublish } from '@/lib/publish';

interface AnswerBody {
  verdict?: unknown;
  bodyMd?: unknown;
  evidenceRefs?: unknown;
  signedPayloadJws?: unknown;
  orcidIdToken?: unknown;
  orcidIdParam?: unknown;
}

const ORCID_ID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { id: questionId } = await ctx.params;
  if (!questionId) {
    return NextResponse.json({ error: 'missing-question-id' }, { status: 400 });
  }

  let body: AnswerBody;
  try {
    body = (await request.json()) as AnswerBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const linkedIdentity = await getOrcidIdentityForUser(session.user.id);
  const clientOrcidId =
    typeof body.orcidIdParam === 'string' ? body.orcidIdParam.trim() : null;
  if (clientOrcidId && !ORCID_ID_RE.test(clientOrcidId)) {
    return NextResponse.json({ error: 'invalid-orcid-id' }, { status: 400 });
  }

  const signatureInput = resolveReviewSignatureInput({
    linkedIdentity,
    clientOrcidId,
    clientSignedPayloadJws:
      typeof body.orcidIdToken === 'string'
        ? body.orcidIdToken
        : typeof body.signedPayloadJws === 'string'
          ? body.signedPayloadJws
          : '',
  });

  const db = getDb();
  const questionRows = await db
    .select({
      id: schema.openQuestion.id,
      status: schema.openQuestion.status,
      askerPrincipalId: schema.openQuestion.askerPrincipalId,
    })
    .from(schema.openQuestion)
    .where(eq(schema.openQuestion.id, questionId))
    .limit(1);
  const questionRow = questionRows[0] ?? null;

  const precondition = validateOpenQuestionAnswer({
    questionId,
    questionRow,
    reviewerPrincipalId: principalId,
    reviewerOrcidId: signatureInput.callerOrcidId ?? '',
  });
  if (!precondition.ok) {
    const status =
      precondition.reason === 'question-not-found'
        ? 404
        : precondition.reason === 'reviewer-no-orcid'
          ? 412
          : 409;
    return NextResponse.json({ error: precondition.reason }, { status });
  }

  const contentDraft = buildOpenQuestionAnswerContent({
    questionId,
    reviewerOrcidId: signatureInput.callerOrcidId,
    verdict: body.verdict,
    bodyMd: body.bodyMd,
    evidenceRefs: body.evidenceRefs,
  });
  if (!contentDraft.ok) {
    return NextResponse.json(
      { error: 'invalid-answer', detail: contentDraft.reason },
      { status: 400 },
    );
  }

  const prevRows = await db
    .select({ id: schema.provenanceMerkleLog.id })
    .from(schema.provenanceMerkleLog)
    .orderBy(desc(schema.provenanceMerkleLog.entrySeq))
    .limit(1);
  const prevMerkleEntryId = prevRows[0]?.id ?? null;
  const reviewId = uuidv7();
  const merkleEntryId = uuidv7();

  const validation = validatePublish({
    kind: 'open_peer_review',
    entityId: reviewId,
    content: contentDraft.content,
    contentHashHex: contentHashHex(contentDraft.content),
    signedJws: signatureInput.signedPayloadJws,
    signerPrincipalId: principalId,
    prevMerkleEntryId,
    merkleEntryId,
    signatureVerifier: () => {
      console.warn(
        '[open-question-answer] signature verifier in dev fallback — strict ORCID/JWS verification is a follow-up gate',
      );
      return true;
    },
  });
  if (!validation.ok) {
    const status =
      validation.reason === 'empty-signed-jws'
        ? 412
        : validation.reason === 'signature-verify-failed'
          ? 403
          : 400;
    return NextResponse.json({ error: validation.reason }, { status });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.provenanceMerkleLog).values({
        id: validation.payload.merkleEntry.id,
        prevEntryId: validation.payload.merkleEntry.prevEntryId,
        entityKind: validation.payload.merkleEntry.entityKind,
        entityId: validation.payload.merkleEntry.entityId,
        contentHash: Buffer.from(validation.payload.merkleEntry.contentHash),
        signedJws: validation.payload.merkleEntry.signedJws,
        signerPrincipalId: validation.payload.merkleEntry.signerPrincipalId,
      });

      await tx.insert(schema.openPeerReview).values({
        id: reviewId,
        reviewerPrincipalId: principalId,
        reviewerOrcidId: contentDraft.content.reviewerOrcidId,
        targetKind: 'question',
        targetId: questionId,
        verdict: contentDraft.content.verdict,
        bodyMd: contentDraft.content.bodyMd,
        evidenceRefs: contentDraft.content.evidenceRefs,
        signedPayloadJws: validation.payload.signedJws,
        merkleLogEntryId: validation.payload.merkleEntry.id,
      });
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json(
      { error: 'db-write-failed', detail },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      reviewId,
      questionId,
      reviewerOrcidId: contentDraft.content.reviewerOrcidId,
      verdict: contentDraft.content.verdict,
      merkleLogEntryId: validation.payload.merkleEntry.id,
    },
    { status: 201 },
  );
}
