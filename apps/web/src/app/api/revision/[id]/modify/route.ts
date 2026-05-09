// POST /api/revision/<id>/modify
//
// Body: { rationale: string, revisedFragments: [{ originalText, replacementText }], notes?: string }
//
// Supersede the original revision and create a new one authored by the
// reviewer with their counter-proposal. Capability: `block.review` (or
// `block.commit`).

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { schema } from '@collaborationtool/drizzle';
import {
  hasCapability,
  loadPrincipalContext,
} from '@collaborationtool/permissions';
import { supersedeRevisionWithModified } from '@collaborationtool/ai-runtime';
import type { PrincipalId, RevisionId } from '@collaborationtool/schema';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

interface ModifyBody {
  rationale?: unknown;
  revisedFragments?: unknown;
  notes?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: revisionId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  let body: ModifyBody;
  try {
    body = (await request.json()) as ModifyBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (typeof body.rationale !== 'string' || !Array.isArray(body.revisedFragments)) {
    return NextResponse.json(
      { error: 'missing-rationale-or-fragments' },
      { status: 400 },
    );
  }
  const fragments: Array<{ originalText: string; replacementText: string }> = [];
  for (const f of body.revisedFragments as unknown[]) {
    if (
      f &&
      typeof f === 'object' &&
      typeof (f as { originalText?: unknown }).originalText === 'string' &&
      typeof (f as { replacementText?: unknown }).replacementText === 'string'
    ) {
      fragments.push({
        originalText: (f as { originalText: string }).originalText,
        replacementText: (f as { replacementText: string }).replacementText,
      });
    }
  }
  if (fragments.length === 0) {
    return NextResponse.json(
      { error: 'no-valid-fragments' },
      { status: 400 },
    );
  }

  const db = getDb();
  const revRows = await db
    .select({ documentId: schema.revision.documentId })
    .from(schema.revision)
    .where(eq(schema.revision.id, revisionId))
    .limit(1);
  if (revRows.length === 0) {
    return NextResponse.json({ error: 'revision-not-found' }, { status: 404 });
  }
  const documentId = revRows[0]!.documentId;

  const ctx = await loadPrincipalContext(db, principalId, documentId);
  const canReview =
    !!ctx &&
    (hasCapability(ctx, {
      verb: 'block.review',
      resourceType: 'document',
      resourceId: documentId,
    }) ||
      hasCapability(ctx, {
        verb: 'block.commit',
        resourceType: 'document',
        resourceId: documentId,
      }));
  if (!canReview) {
    return NextResponse.json(
      { error: 'no-review-capability' },
      { status: 403 },
    );
  }

  try {
    const result = await supersedeRevisionWithModified(db, {
      originalRevisionId: revisionId as RevisionId,
      reviewerPrincipalId: principalId as PrincipalId,
      rationale: body.rationale,
      revisedFragments: fragments,
      ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
    });
    return NextResponse.json({
      originalRevisionId: result.originalRevisionId,
      newRevisionId: result.newRevisionId,
      newProvenanceId: result.newProvenanceId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'modify-failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 409 },
    );
  }
}
