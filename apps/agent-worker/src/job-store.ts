// Phase 2 W2 ADR-0008 §2.1: PG operations on agent_job + agent_job_event.
//
// The worker process uses these to:
//   - INSERT a queued agent_job row when the HTTP handler calls
//     submitJob (the HTTP route lives in apps/web)
//   - mark the row 'running' / 'done' / 'error' / 'cancelled' from the
//     pgboss handler
//   - APPEND each progress event to agent_job_event so /api/agent/job/
//     <id>/stream?cursor=<eventId> can resume
//
// Pure SQL ops; no pgboss / no LLM. Tests can run against a real PG in
// integration; type-only verification covers everything else.

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { schema, type DbExecutor } from '@collaborationtool/drizzle';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import type { AgentJobKind, AgentJobStatus, JobEventPayload } from './job-types';

export interface CreateJobRow {
  kind: AgentJobKind;
  documentId: DocumentId;
  triggeringPrincipalId: PrincipalId;
  agentPrincipalId: PrincipalId;
  inputPayload: Record<string, unknown>;
}

/** Insert a fresh job row in 'queued' status. Returns the new id. */
export async function createJob(
  db: DbExecutor,
  input: CreateJobRow,
): Promise<string> {
  const id = uuidv7();
  await db.insert(schema.agentJob).values({
    id,
    kind: input.kind,
    documentId: input.documentId,
    triggeringPrincipalId: input.triggeringPrincipalId,
    agentPrincipalId: input.agentPrincipalId,
    status: 'queued',
    progressFraction: '0',
    inputPayload: input.inputPayload as unknown as Record<string, unknown>,
  });
  return id;
}

/** Move a job to 'running' and stamp started_at. */
export async function markRunning(db: DbExecutor, jobId: string): Promise<void> {
  await db
    .update(schema.agentJob)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(schema.agentJob.id, jobId));
}

export interface FinishJobInput {
  jobId: string;
  outputRevisionIds: string[];
  outputThreadIds: string[];
  costTokenInput: number;
  costTokenOutput: number;
  costUsdMilli: number;
}

/** Move a job to 'done' and stamp finished_at + outputs + cost. */
export async function markDone(
  db: DbExecutor,
  input: FinishJobInput,
): Promise<void> {
  await db
    .update(schema.agentJob)
    .set({
      status: 'done',
      finishedAt: new Date(),
      progressFraction: '1',
      outputRevisionIds: input.outputRevisionIds,
      outputThreadIds: input.outputThreadIds,
      costTokenInput: input.costTokenInput,
      costTokenOutput: input.costTokenOutput,
      costUsdMilli: input.costUsdMilli,
    })
    .where(eq(schema.agentJob.id, input.jobId));
}

/** Move a job to 'error' and capture the failure shape. */
export async function markError(
  db: DbExecutor,
  jobId: string,
  errorClass: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(schema.agentJob)
    .set({
      status: 'error',
      finishedAt: new Date(),
      errorClass,
      errorMessage,
    })
    .where(eq(schema.agentJob.id, jobId));
}

/** Update progress without changing status. Worker calls this from
 * inside the agent loop (e.g. after each MCP tool call). */
export async function updateProgress(
  db: DbExecutor,
  jobId: string,
  fraction: number,
  message: string,
): Promise<void> {
  if (fraction < 0 || fraction > 1) {
    throw new Error(`updateProgress: fraction ${fraction} out of [0,1]`);
  }
  await db
    .update(schema.agentJob)
    .set({ progressFraction: String(fraction), progressMessage: message })
    .where(eq(schema.agentJob.id, jobId));
}

/** Append an event to the SSE backlog. id auto-assigned by bigserial.
 * The /api/agent/job/<id>/stream consumer echoes the latest id as
 * Last-Event-Id so re-connect can pass cursor=<id>. */
export async function appendEvent(
  db: DbExecutor,
  jobId: string,
  payload: JobEventPayload,
): Promise<void> {
  await db.insert(schema.agentJobEvent).values({
    jobId,
    eventKind: payload.kind,
    payload: payload as unknown as Record<string, unknown>,
  });
}

/** Read events after `cursor` (exclusive) for SSE re-connect. */
export async function readEventsAfter(
  db: DbExecutor,
  jobId: string,
  cursor: number,
): Promise<Array<{ id: number; eventKind: string; payload: unknown }>> {
  // Drizzle 0.45 doesn't yet have full typed >; use sql helper lazily.
  // For now, two-pass: select all then filter in memory (acceptable for
  // job-event volumes < 1k per job).
  const rows = await db
    .select({
      id: schema.agentJobEvent.id,
      eventKind: schema.agentJobEvent.eventKind,
      payload: schema.agentJobEvent.payload,
    })
    .from(schema.agentJobEvent)
    .where(eq(schema.agentJobEvent.jobId, jobId));
  return rows
    .filter((r) => r.id > cursor)
    .sort((a, b) => a.id - b.id);
}

/** Status-only view for /api/agent/job/<id> polling clients. */
export async function readJobStatus(
  db: DbExecutor,
  jobId: string,
): Promise<{
  id: string;
  status: AgentJobStatus;
  progressFraction: number;
  progressMessage: string | null;
  outputRevisionIds: string[];
  outputThreadIds: string[];
  costUsdMilli: number;
  errorMessage: string | null;
} | null> {
  const rows = await db
    .select()
    .from(schema.agentJob)
    .where(eq(schema.agentJob.id, jobId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    status: r.status as AgentJobStatus,
    progressFraction: Number(r.progressFraction),
    progressMessage: r.progressMessage,
    outputRevisionIds: r.outputRevisionIds,
    outputThreadIds: r.outputThreadIds,
    costUsdMilli: r.costUsdMilli,
    errorMessage: r.errorMessage,
  };
}
