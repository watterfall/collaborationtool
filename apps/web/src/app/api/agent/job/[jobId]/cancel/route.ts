// Phase 5 Wave A A2 — ADR-0008 §93 agent-job cancel endpoint.
//
// POST /api/agent/job/<jobId>/cancel
//   → 200 { status: 'cancelling', applyCancelling: boolean }   (success / idempotent)
//   → 401 { error: 'unauthenticated' }
//   → 403 { error: 'unauthorized' }                            (caller != triggering principal)
//   → 404 { error: 'job-not-found' }
//   → 409 { error: 'terminal-state', currentStatus }            (done | error | cancelled)
//
// Semantics:
//   - queued | running  → flip status to 'cancelling'; worker polls
//     `isCancelling` at each tool-call boundary (ADR-0008 §156) and
//     graceful-shutdowns to 'cancelled' with a 'cancelled' SSE event.
//   - cancelling        → no-op (idempotent), HTTP 200 with applyCancelling=false.
//   - done | error | cancelled → 409.
//
// State-machine + ownership live in `apps/web/src/lib/agent-job-cancel.ts`
// (pure validator, mirror of `lib/maintenance.ts` pattern).

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { captureEvent, anonDistinctId } from '@/lib/observability';
import { getPrincipalIdForUser } from '@/lib/principal';
import { validateCancel, type AgentJobStatus } from '@/lib/agent-job-cancel';

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { jobId } = await ctx.params;
  if (!jobId) {
    return NextResponse.json({ error: 'missing-job-id' }, { status: 400 });
  }

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.agentJob.id,
      status: schema.agentJob.status,
      triggeringPrincipalId: schema.agentJob.triggeringPrincipalId,
    })
    .from(schema.agentJob)
    .where(eq(schema.agentJob.id, jobId))
    .limit(1);
  const row = rows[0];

  const validation = validateCancel({
    job: row
      ? {
          id: row.id,
          status: row.status as AgentJobStatus,
          triggeringPrincipalId: row.triggeringPrincipalId,
        }
      : null,
    callerPrincipalId: principalId,
  });

  if (!validation.ok) {
    const status =
      validation.reason === 'not-found'
        ? 404
        : validation.reason === 'unauthorized'
          ? 403
          : 409;
    captureEvent({
      event: 'agent.job.cancel.rejected',
      distinctId: anonDistinctId(principalId),
      properties: {
        jobId,
        reason: validation.reason,
        currentStatus: 'currentStatus' in validation ? validation.currentStatus : undefined,
      },
    });
    return NextResponse.json(
      {
        error: validation.reason,
        ...('currentStatus' in validation
          ? { currentStatus: validation.currentStatus }
          : {}),
      },
      { status },
    );
  }

  if (validation.applyCancelling) {
    await db
      .update(schema.agentJob)
      .set({ status: 'cancelling' })
      .where(eq(schema.agentJob.id, jobId));
  }

  captureEvent({
    event: 'agent.job.cancel.requested',
    distinctId: anonDistinctId(principalId),
    properties: {
      jobId,
      applyCancelling: validation.applyCancelling,
    },
  });

  return NextResponse.json({
    status: validation.effectiveStatus,
    applyCancelling: validation.applyCancelling,
  });
}
