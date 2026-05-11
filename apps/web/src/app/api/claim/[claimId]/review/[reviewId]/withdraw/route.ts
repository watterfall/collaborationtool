// Phase 5 Wave B B3 — POST /api/claim/[claimId]/review/[reviewId]/withdraw
//
// ADR-0016 §2.3 endpoint 4. Withdraw is mark-only (withdrawnAt +
// withdrawnReason); the row stays so the public lineage view can still
// render historical context with a "withdrawn" badge.
//
// Capability: reviewer's own row only — service layer checks
// row.reviewer_principal_id === caller. There's no admin override in
// Phase 5; Wave D may add one if dogfood surfaces a need.

import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { validateWithdraw } from '@/lib/claim-review';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

interface WithdrawBody {
  reason?: unknown;
}

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

  let body: WithdrawBody;
  try {
    body = (await request.json()) as WithdrawBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();

  const rows = await db
    .select({
      id: schema.claimReview.id,
      reviewerPrincipalId: schema.claimReview.reviewerPrincipalId,
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

  const reason = typeof body.reason === 'string' ? body.reason : '';
  const validation = validateWithdraw({
    row,
    callerPrincipalId: principalId,
    reason,
  });
  if (!validation.ok) {
    const status =
      validation.reason === 'unauthorized'
        ? 403
        : validation.reason === 'empty-reason'
          ? 400
          : 409;
    return NextResponse.json({ error: validation.reason }, { status });
  }

  await db
    .update(schema.claimReview)
    .set({
      withdrawnAt: validation.update.withdrawnAt,
      withdrawnReason: validation.update.withdrawnReason,
    })
    .where(eq(schema.claimReview.id, reviewId));

  return NextResponse.json({
    withdrawnAt: validation.update.withdrawnAt.toISOString(),
    withdrawnReason: validation.update.withdrawnReason,
  });
}
