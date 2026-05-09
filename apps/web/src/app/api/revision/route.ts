// GET /api/revision?docId=<id>
//
// Returns pending (proposed/draft) revisions for a document. Requires
// `block.review` capability — readers can't see drafts, writers and
// reviewers can.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import {
  loadPrincipalContext,
  hasCapability,
} from '@collaborationtool/permissions';
import { listPendingRevisions } from '@collaborationtool/ai-runtime';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const documentId = url.searchParams.get('docId');
  if (!documentId) {
    return NextResponse.json({ error: 'missing-doc-id' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const ctx = await loadPrincipalContext(db, principalId, documentId);
  if (!ctx) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }
  // `block.review` lets a principal see + decide on others' proposals.
  // `block.commit` (writers) implicitly includes review power.
  const canReview =
    hasCapability(ctx, {
      verb: 'block.review',
      resourceType: 'document',
      resourceId: documentId,
    }) ||
    hasCapability(ctx, {
      verb: 'block.commit',
      resourceType: 'document',
      resourceId: documentId,
    });
  if (!canReview) {
    return NextResponse.json(
      { error: 'no-review-capability' },
      { status: 403 },
    );
  }

  const pending = await listPendingRevisions(db, { documentId });
  return NextResponse.json({
    revisions: pending.map((r) => ({
      id: r.id,
      proposedBy: r.proposedBy,
      status: r.status,
      rationale: r.rationale,
      proposalMetadata: r.proposalMetadata,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
