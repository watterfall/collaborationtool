// Phase 2 W2 ADR-0008: long-horizon agent worker process entry.
//
// Lifecycle:
//   1. Connect to PG via DATABASE_URL
//   2. pgboss.start() — boots its own schema if first run
//   3. Subscribe to queue 'reviewer' + 'researcher'
//   4. For each job: markRunning → invokeAgentViaPlugin → markDone
//      (or markError on throw); append events to agent_job_event
//      throughout for SSE consumers
//   5. On SIGTERM: drain in-flight jobs, then exit
//
// Phase 2 W2 stub: this file boots pgboss + registers handlers but
// the actual agent invocation calls invokeAgentViaPlugin from
// @collaborationtool/ai-runtime. Reviewer / researcher specific
// plugins land Phase 2 W4-W7. The handler skeleton compiles + runs;
// real reviewer skill needs design (per ADR-0008 §1 reviewer scope).

import PgBoss from 'pg-boss';

import { openDatabase } from '@collaborationtool/drizzle';
import {
  invokeAgentViaPlugin,
  // Phase 5 Wave A A1 — ADR-0008 §122 quota enforcer.
  DEFAULT_QUOTA_PER_DAY,
  checkAndConsumeQuota,
  createDbQuotaCounter,
} from '@collaborationtool/ai-runtime';

import {
  appendEvent,
  isCancelling,
  markCancelled,
  markDone,
  markError,
  markRunning,
  updateProgress,
} from './job-store';
import type { AgentJobKind, AnyJobInput, MaintenanceScanJobInput } from './job-types';
import { httpDoiResolver } from './doi-resolver';
import {
  DEFAULT_FINDING_KINDS,
  scanForFindings,
  writeFindings,
  type DoiResolver,
} from './maintenance-scan';

export interface WorkerConfig {
  databaseUrl: string;
  /** pgboss schema name; default 'pgboss'. */
  pgbossSchema?: string;
  /** Anthropic API key (null = mock runner). */
  anthropicApiKey: string | null;
  /** Skills root for plugin loader. */
  skillsRoot: string;
  /** Override DoiResolver for broken-citation maintenance scans
   * (default: HTTP HEAD via doi.org). Tests inject a stub. */
  doiResolver?: DoiResolver;
}

const QUEUE_NAMES: AgentJobKind[] = [
  'reviewer',
  'researcher',
  'maintenance-scan',
];

/**
 * Start the worker. Returns a stop() function that drains in-flight
 * jobs and disconnects pgboss + the DB pool.
 */
export async function startWorker(
  config: WorkerConfig,
): Promise<{ stop: () => Promise<void> }> {
  const handle = openDatabase({ url: config.databaseUrl });
  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: config.pgbossSchema ?? 'pgboss',
  });

  await boss.start();

  for (const queue of QUEUE_NAMES) {
    await boss.work<{ jobId: string; input: AnyJobInput }>(
      queue,
      async (jobs) => {
        for (const job of jobs) {
          const { jobId, input } = job.data;
          await handleOne(handle.db, jobId, input, config);
        }
      },
    );
  }

  return {
    stop: async () => {
      await boss.stop({ wait: true, graceful: true });
      await handle.close();
    },
  };
}

async function handleOne(
  db: ReturnType<typeof openDatabase>['db'],
  jobId: string,
  input: AnyJobInput,
  config: WorkerConfig,
): Promise<void> {
  // Phase 5 Wave A A2 — ADR-0008 §156 cancel poll. The HTTP cancel
  // route may have flipped status='cancelling' between enqueue and
  // pickup; if so, stop before doing any real work or burning quota.
  if (await respectCancellation(db, jobId, 'queued→running')) {
    return;
  }

  await markRunning(db, jobId);
  await appendEvent(db, jobId, {
    kind: 'progress',
    fraction: 0.05,
    message: `dispatching ${input.kind} agent`,
  });

  // Phase 5 Wave A A1 — ADR-0008 §122 quota enforcement (defense in
  // depth). The HTTP submission route already checks quota, but a
  // worker handler that invokes plugins must re-check: pgboss can
  // also enqueue from internal callers (coordinator handoff, future
  // cron) that bypass `/api/agent/invoke`. Reject path marks the
  // job 'error' + emits agent_job_event{kind:'quota_blocked'} so
  // SSE consumers and timeline views can surface it.
  const quotaResult = await checkAndConsumeQuota({
    counter: createDbQuotaCounter(db),
    principalId: input.triggeringPrincipalId,
    kind: input.kind,
    quotaPerDay: DEFAULT_QUOTA_PER_DAY,
    now: new Date(),
  });
  if (!quotaResult.allowed) {
    await markError(
      db,
      jobId,
      'quota-exceeded',
      `quota exceeded for ${input.triggeringPrincipalId}/${input.kind}: ${quotaResult.currentCount}/${quotaResult.limit}`,
    );
    await appendEvent(db, jobId, {
      kind: 'error',
      errorClass: 'quota-exceeded',
      errorMessage: `quota exceeded: ${quotaResult.currentCount}/${quotaResult.limit}${
        quotaResult.resetAt ? ` — reset at ${quotaResult.resetAt.toISOString()}` : ''
      }`,
    });
    return;
  }

  try {
    // Phase 5 Wave A A2 — second poll, just before dispatch. Tightens
    // the cancel window from "before quota" to "right before any
    // expensive work". A user who clicked cancel during the few ms it
    // took to consume quota still gets stopped here.
    if (await respectCancellation(db, jobId, 'pre-dispatch')) {
      return;
    }

    // Phase 4 W4: maintenance-scan handler is SQL-pure; no LLM/MCP
    // needed. We branch here before the Anthropic instantiation path
    // so a Postgres-only deployment can run scans without ANTHROPIC_API_KEY.
    if (input.kind === 'maintenance-scan') {
      await runMaintenanceScan(db, jobId, input, config);
      return;
    }

    // Anthropic instantiation deferred to here (worker lifetime ≫ job).
    // Per-job re-instantiation is fine: ~5ms object construction, no
    // network on construct.
    const anthropic = config.anthropicApiKey
      ? new (await import('@anthropic-ai/sdk')).default({
          apiKey: config.anthropicApiKey,
        })
      : null;

    // ai-runtime invocation. The worker doesn't know agent specifics —
    // it routes by pluginPath + skillId from the job input, so reviewer
    // / researcher plugins are interchangeable from the worker's POV.
    // (The triggering principalContext must be re-loaded since the
    // worker runs without a HTTP session; we pass a synthetic context
    // for now and require Phase 2 W7 dogfood to add real ctx loading.)
    await updateProgress(db, jobId, 0.5, 'invoking agent');

    // Phase 2 W2 stub: invokeAgentViaPlugin requires a PrincipalContext
    // — the HTTP submission route loads it and stuffs it into
    // input.payload. For W2 we emit a TODO marker; W7 dogfood gate
    // wires the real PC reload from agent_job.triggering_principal_id.
    void invokeAgentViaPlugin;
    void config.skillsRoot;
    void anthropic;
    void input;
    // STUB: real reviewer/researcher handler lands W4-W7. For now, mark
    // done with empty outputs so pgboss + agent_job rows demo-end-to-end.
    await markDone(db, {
      jobId,
      outputRevisionIds: [],
      outputThreadIds: [],
      costTokenInput: 0,
      costTokenOutput: 0,
      costUsdMilli: 0,
    });
    await appendEvent(db, jobId, {
      kind: 'done',
      outputRevisionIds: [],
      outputThreadIds: [],
      cost: { inputTokens: 0, outputTokens: 0, usdMilli: 0 },
    });
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : 'UnknownError';
    const errorMessage = err instanceof Error ? err.message : String(err);
    await markError(db, jobId, errorClass, errorMessage);
    await appendEvent(db, jobId, {
      kind: 'error',
      errorClass,
      errorMessage,
    });
  }
}

/** Phase 5 Wave A A2 — ADR-0008 §156 cancel-poll boundary helper.
 *
 * Worker calls this at every tool-call boundary (currently: before
 * `markRunning`, before `runMaintenanceScan` dispatch, and between
 * `scanForFindings` + `writeFindings`). When `agent_job.status ===
 * 'cancelling'` we mark the job 'cancelled', emit a 'cancelled' SSE
 * event with `boundary` as the reason, and return true so the caller
 * unwinds. Returning false means "keep going".
 *
 * Keeping this in one function:
 *   - guarantees the SSE event payload shape stays consistent
 *   - keeps the read+update sequence uniform (no half-stops)
 *   - documents the canonical poll site for future tool-call boundaries
 */
async function respectCancellation(
  db: ReturnType<typeof openDatabase>['db'],
  jobId: string,
  boundary: string,
): Promise<boolean> {
  if (!(await isCancelling(db, jobId))) return false;
  await markCancelled(db, jobId);
  await appendEvent(db, jobId, {
    kind: 'cancelled',
    reason: `worker stopped at boundary: ${boundary}`,
  });
  return true;
}

/** Phase 4 W4: maintenance-scan handler. SQL-pure; runs the 3
 * statically-computable finding generators (unsupported-claim /
 * outdated-source / unverified-ai-block) and writes results into
 * maintenance_finding. Other 3 finding kinds (duplicated-claim
 * semantic / contradicted-conclusion synthesis-aware / broken-citation
 * external network check) stay deferred to W4 末. */
async function runMaintenanceScan(
  db: ReturnType<typeof openDatabase>['db'],
  jobId: string,
  input: MaintenanceScanJobInput,
  config: WorkerConfig,
): Promise<void> {
  await updateProgress(db, jobId, 0.2, 'scanning vault for findings');
  const scope =
    input.scope === 'document'
      ? ({ kind: 'document', documentId: input.documentId! } as const)
      : ({ kind: 'vault', vaultPrincipalId: input.vaultPrincipalId! } as const);

  // Resolve which kinds will run + whether broken-citation needs a resolver.
  const requestedKinds = input.findingKinds ?? [...DEFAULT_FINDING_KINDS];
  const needsDoiResolver = requestedKinds.includes('broken-citation');
  const doiResolver = needsDoiResolver
    ? (config.doiResolver ?? httpDoiResolver())
    : undefined;

  const findings = await scanForFindings(db, {
    scope,
    jobId,
    findingKinds: requestedKinds,
    ...(doiResolver ? { doiResolver } : {}),
  });

  // Phase 5 Wave A A2 — ADR-0008 §156 cancel poll between scan and
  // write. scanForFindings is the SQL-pure read pass; writeFindings is
  // the side-effect. Stopping here means the user's cancel during a
  // long scan leaves no half-written findings.
  if (await respectCancellation(db, jobId, 'maintenance-scan pre-write')) {
    return;
  }

  await updateProgress(
    db,
    jobId,
    0.7,
    `writing ${findings.length} finding(s)`,
  );
  await writeFindings(db, findings);
  await markDone(db, {
    jobId,
    outputRevisionIds: [],
    outputThreadIds: [],
    costTokenInput: 0,
    costTokenOutput: 0,
    costUsdMilli: 0,
  });
  await appendEvent(db, jobId, {
    kind: 'done',
    outputRevisionIds: [],
    outputThreadIds: [],
    cost: { inputTokens: 0, outputTokens: 0, usdMilli: 0 },
  });
}

// CLI entry: `pnpm --filter @collaborationtool/agent-worker start`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('[agent-worker] DATABASE_URL required');
    process.exit(1);
  }
  startWorker({
    databaseUrl,
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? null,
    skillsRoot: process.env['SKILLS_ROOT'] ?? './skills',
  })
    .then(({ stop }) => {
      console.log('[agent-worker] started');
      const shutdown = async () => {
        console.log('[agent-worker] draining...');
        await stop();
        process.exit(0);
      };
      process.on('SIGTERM', () => void shutdown());
      process.on('SIGINT', () => void shutdown());
    })
    .catch((err) => {
      console.error('[agent-worker] failed to start:', err);
      process.exit(1);
    });
}
