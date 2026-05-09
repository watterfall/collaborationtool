// POST /api/revision/<id>/accept
//
// Body: { notes?: string }
//
// Capability: `block.commit` on the revision's document. Reviewers
// (block.review only) can't accept — only writers / authors finalise.

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { schema } from '@collaborationtool/drizzle';
import {
  hasCapability,
  loadPrincipalContext,
} from '@collaborationtool/permissions';
import { acceptRevisionToContribution } from '@collaborationtool/ai-runtime';
import type { PrincipalId, RevisionId } from '@collaborationtool/schema';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

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

  let body: { notes?: unknown } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { notes?: unknown };
  } catch {
    /* allow empty body */
  }

  const db = getDb();

  // Lookup the revision to find the document for the capability check.
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
  if (
    !ctx ||
    !hasCapability(ctx, {
      verb: 'block.commit',
      resourceType: 'document',
      resourceId: documentId,
    })
  ) {
    return NextResponse.json(
      { error: 'no-commit-capability' },
      { status: 403 },
    );
  }

  try {
    const result = await acceptRevisionToContribution(db, {
      revisionId: revisionId as RevisionId,
      reviewerPrincipalId: principalId as PrincipalId,
      ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
    });
    return NextResponse.json({
      revisionId,
      contributionId: result.contributionId,
      status: 'accepted',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'accept-failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 409 },
    );
  }
}
