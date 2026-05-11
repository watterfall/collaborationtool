// Phase 5 Wave A A4 — agent-job tree endpoint backing AgentTimeline.
//
// GET /api/agent/job/<jobId>/tree
//   → 200 {
//       root: { job, events[], children[] } | null,
//       orphans: TimelineJobRow[]
//     }
//   → 401 { error: 'unauthenticated' }
//   → 404 { error: 'job-not-found' }
//
// Returns the requested job + every descendant (jobs whose
// `parent_job_id` chains back to this root) + all `agent_job_event`
// rows bucketed by jobId. Pure tree assembly lives in
// `apps/web/src/lib/agent-timeline.ts:buildTimelineTree`.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, inArray } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  buildTimelineTree,
  type TimelineEventRow,
  type TimelineJobRow,
} from '@/lib/agent-timeline';

const MAX_DESCENDANT_FAN_OUT = 1024;

export async function GET(
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

  const db = getDb();

  // 1) Root row — confirm it exists before doing BFS.
  const rootRows = await db
    .select({
      id: schema.agentJob.id,
      kind: schema.agentJob.kind,
      status: schema.agentJob.status,
      parentJobId: schema.agentJob.parentJobId,
      progressFraction: schema.agentJob.progressFraction,
      progressMessage: schema.agentJob.progressMessage,
      startedAt: schema.agentJob.startedAt,
      finishedAt: schema.agentJob.finishedAt,
      errorClass: schema.agentJob.errorClass,
      errorMessage: schema.agentJob.errorMessage,
      costUsdMilli: schema.agentJob.costUsdMilli,
      triggeringPrincipalId: schema.agentJob.triggeringPrincipalId,
    })
    .from(schema.agentJob)
    .where(eq(schema.agentJob.id, jobId))
    .limit(1);
  if (rootRows.length === 0) {
    return NextResponse.json({ error: 'job-not-found' }, { status: 404 });
  }

  // 2) BFS expand children layer by layer via parent_job_id. We cap
  //    fan-out so a runaway coordinator can't OOM the request.
  const allRows: typeof rootRows = [...rootRows];
  let frontier: string[] = [jobId];
  while (frontier.length > 0 && allRows.length < MAX_DESCENDANT_FAN_OUT) {
    const childRows = await db
      .select({
        id: schema.agentJob.id,
        kind: schema.agentJob.kind,
        status: schema.agentJob.status,
        parentJobId: schema.agentJob.parentJobId,
        progressFraction: schema.agentJob.progressFraction,
        progressMessage: schema.agentJob.progressMessage,
        startedAt: schema.agentJob.startedAt,
        finishedAt: schema.agentJob.finishedAt,
        errorClass: schema.agentJob.errorClass,
        errorMessage: schema.agentJob.errorMessage,
        costUsdMilli: schema.agentJob.costUsdMilli,
        triggeringPrincipalId: schema.agentJob.triggeringPrincipalId,
      })
      .from(schema.agentJob)
      .where(inArray(schema.agentJob.parentJobId, frontier));
    if (childRows.length === 0) break;
    allRows.push(...childRows);
    frontier = childRows.map((r) => r.id);
  }

  // 3) Events for every job in the tree.
  const allJobIds = allRows.map((r) => r.id);
  const eventRows =
    allJobIds.length > 0
      ? await db
          .select({
            id: schema.agentJobEvent.id,
            jobId: schema.agentJobEvent.jobId,
            eventKind: schema.agentJobEvent.eventKind,
            payload: schema.agentJobEvent.payload,
            createdAt: schema.agentJobEvent.createdAt,
          })
          .from(schema.agentJobEvent)
          .where(inArray(schema.agentJobEvent.jobId, allJobIds))
      : [];

  const jobs: TimelineJobRow[] = allRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    parentJobId: r.parentJobId,
    progressFraction: Number(r.progressFraction),
    progressMessage: r.progressMessage,
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
    errorClass: r.errorClass,
    errorMessage: r.errorMessage,
    costUsdMilli: r.costUsdMilli,
    triggeringPrincipalId: r.triggeringPrincipalId,
  }));
  const events: TimelineEventRow[] = eventRows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    eventKind: r.eventKind,
    payload: r.payload as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
  }));

  const tree = buildTimelineTree({ jobs, events, rootJobId: jobId });
  return NextResponse.json(tree);
}
