// Phase 2.5 ADR-0008 §2.1: agent-job status polling endpoint.
//
// GET /api/agent/job/<jobId>
//   → { id, status, progressFraction, progressMessage,
//       outputRevisionIds, outputThreadIds, costUsdMilli, errorMessage }

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

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
  const rows = await db
    .select()
    .from(schema.agentJob)
    .where(eq(schema.agentJob.id, jobId))
    .limit(1);
  const job = rows[0];
  if (!job) {
    return NextResponse.json({ error: 'job-not-found' }, { status: 404 });
  }

  // No fine-grained ACL for now: the user who triggered or anyone with
  // doc access can poll. Phase 3 may tighten if jobs leak insight.

  return NextResponse.json({
    id: job.id,
    kind: job.kind,
    status: job.status,
    progressFraction: Number(job.progressFraction),
    progressMessage: job.progressMessage,
    outputRevisionIds: job.outputRevisionIds,
    outputThreadIds: job.outputThreadIds,
    costUsdMilli: job.costUsdMilli,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  });
}
