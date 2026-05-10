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
import { invokeAgentViaPlugin } from '@collaborationtool/ai-runtime';

import {
  appendEvent,
  markDone,
  markError,
  markRunning,
  updateProgress,
} from './job-store';
import type { AgentJobKind, AnyJobInput } from './job-types';

export interface WorkerConfig {
  databaseUrl: string;
  /** pgboss schema name; default 'pgboss'. */
  pgbossSchema?: string;
  /** Anthropic API key (null = mock runner). */
  anthropicApiKey: string | null;
  /** Skills root for plugin loader. */
  skillsRoot: string;
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
  await markRunning(db, jobId);
  await appendEvent(db, jobId, {
    kind: 'progress',
    fraction: 0.05,
    message: `dispatching ${input.kind} agent`,
  });

  try {
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
