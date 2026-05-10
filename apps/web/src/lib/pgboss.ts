// Producer-only pgboss client for apps/web (Phase 2.5 ADR-0008).
//
// The web process never WORKS jobs (apps/agent-worker does that). It
// only ENQUEUES via `boss.send(queue, data)`. We keep a singleton
// instance and `start()` it on first use; Next.js hot-reload tolerates
// this since pg-boss reuses the same PG schema.

import PgBoss from 'pg-boss';

import { env } from './env';

let cached: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

async function getBoss(): Promise<PgBoss> {
  if (cached) return cached;
  if (starting) return starting;
  starting = (async () => {
    const boss = new PgBoss({
      connectionString: env.databaseUrl,
      schema: 'pgboss',
    });
    await boss.start();
    cached = boss;
    return boss;
  })();
  return starting;
}

/** Enqueue a job. Returns the pgboss-assigned id (we ignore it; the
 * caller's `agentJob.id` is the user-facing identity). */
export async function enqueueAgentJob(
  queue: 'reviewer' | 'researcher',
  data: { jobId: string; input: Record<string, unknown> },
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(queue, data);
}

/** Graceful shutdown — primarily for Next.js dev hot-reload. */
export async function stopBoss(): Promise<void> {
  if (cached) {
    await cached.stop({ wait: true, graceful: true });
    cached = null;
  }
}
