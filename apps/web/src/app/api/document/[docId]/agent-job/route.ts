// Phase 2.5 ADR-0008 §2.1: agent-job submission endpoint.
//
// POST /api/document/<docId>/agent-job
//   body: { kind: 'reviewer' | 'researcher', input?: { ... } }
//   → 201 { jobId, statusUrl, streamUrl }
//
// Capability gate: caller needs `agent.invoke:<kind>` on the document
// (e.g. `agent.invoke:reviewer` for reviewer; `agent.invoke:researcher`
// for researcher). The plugin manifest's required_capabilities are
// also re-checked by the worker before invoking.

import { resolve as pathResolve } from 'node:path';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';
import { findAgentByKind, resolvePluginAbsolutePath } from '@collaborationtool/ai-runtime';
import {
  loadPrincipalContext,
  type Capability,
} from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { enqueueAgentJob } from '@/lib/pgboss';
import { getPrincipalIdForUser } from '@/lib/principal';

interface SubmitBody {
  kind?: unknown;
  input?: unknown;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { docId } = await ctx.params;
  if (!docId) {
    return NextResponse.json({ error: 'missing-doc-id' }, { status: 400 });
  }
  const documentId = docId as DocumentId;

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const kind = body.kind;
  if (kind !== 'reviewer' && kind !== 'researcher') {
    return NextResponse.json(
      { error: 'unsupported-kind', supported: ['reviewer', 'researcher'] },
      { status: 400 },
    );
  }

  const principalId = (await getPrincipalIdForUser(session.user.id)) as
    | PrincipalId
    | null;
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const principalContext = await loadPrincipalContext(db, principalId, documentId);
  if (!principalContext) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }
  const verb: Capability = `agent.invoke:${kind}` as Capability;
  if (!principalContext.documentCapabilities.has(verb)) {
    return NextResponse.json(
      { error: 'capability-denied', verb },
      { status: 403 },
    );
  }

  // Resolve agent plugin from registry.
  const repoRoot = pathResolve(process.cwd(), '..', '..');
  const plugin = await findAgentByKind(repoRoot, kind);
  if (!plugin) {
    return NextResponse.json(
      { error: 'plugin-not-registered', kind },
      { status: 500 },
    );
  }
  const pluginPath = resolvePluginAbsolutePath(repoRoot, plugin);

  // Resolve agent_principal_id (the agent's own principal). For Phase
  // 2.5 stub we use a deterministic UUID per kind; Phase 3 reads from
  // the `agent` PG table.
  const agentPrincipalId = `agent:${plugin.id}` as PrincipalId;

  const jobId = uuidv7();

  // 1. Insert agent_job row (status='queued').
  await db.insert(schema.agentJob).values({
    id: jobId,
    kind,
    documentId,
    triggeringPrincipalId: principalId,
    agentPrincipalId,
    status: 'queued',
    progressFraction: '0',
    inputPayload: {
      pluginPath,
      skillId: plugin.skillId,
      ...(typeof body.input === 'object' && body.input !== null ? body.input : {}),
    },
  });

  // 2. Enqueue via pgboss for the worker to pick up.
  try {
    await enqueueAgentJob(kind, {
      jobId,
      input: {
        kind,
        documentId,
        triggeringPrincipalId: principalId,
        pluginPath,
        skillId: plugin.skillId ?? '',
        ...(typeof body.input === 'object' && body.input !== null
          ? (body.input as Record<string, unknown>)
          : {}),
      },
    });
  } catch (err) {
    // Roll back the agent_job row on enqueue failure.
    await db.delete(schema.agentJob).where(eq(schema.agentJob.id, jobId));
    return NextResponse.json(
      {
        error: 'enqueue-failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      jobId,
      statusUrl: `/api/agent/job/${jobId}`,
      streamUrl: `/api/agent/job/${jobId}/stream`,
    },
    { status: 201 },
  );
}
