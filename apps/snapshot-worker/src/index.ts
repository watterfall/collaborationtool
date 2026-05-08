// Snapshot worker entry — long-running process. Polls every
// `SNAPSHOT_INTERVAL_MS` and snapshots docs that have been written since
// their last snapshot.
//
// Phase 1 D10: the actual fetch from y-sweet / gateway state HTTP isn't
// wired yet (D11). The worker still runs the loop and writes
// `last_snapshot_at` even when the source returns null, so we have the
// scheduling + DB plumbing working from D10.

import { openDatabase } from '@collaborationtool/drizzle';

import { loadEnv } from './env';
import { runOnce } from './snapshot';

async function main(): Promise<void> {
  const env = loadEnv();
  const dbHandle = openDatabase({ url: env.databaseUrl, max: 2 });

  let stopping = false;
  process.on('SIGINT', () => {
    console.log('[snapshot-worker] SIGINT received — draining…');
    stopping = true;
  });
  process.on('SIGTERM', () => {
    console.log('[snapshot-worker] SIGTERM received — draining…');
    stopping = true;
  });

  console.log(
    `[snapshot-worker] booting; interval=${env.intervalMs}ms stale=${env.staleAfterMs}ms`,
  );

  // D11 will replace this stub with a real source — gateway state HTTP
  // or y-sweet S3 bytes. For Phase 1 D10 it always returns null (no
  // change recorded), which keeps the schedule loop testable.
  async function fetchYjsBinary(_documentId: string): Promise<Uint8Array | null> {
    void _documentId;
    return null;
  }

  while (!stopping) {
    const start = Date.now();
    try {
      const result = await runOnce(dbHandle.db, {
        staleAfterMs: env.staleAfterMs,
        maxPerTick: env.maxPerTick,
        fetchYjsBinary,
      });
      console.log(
        `[snapshot-worker] tick: candidates=${result.candidates} ` +
          `snapshotted=${result.results.filter((r) => r.status === 'snapshotted').length} ` +
          `no-source=${result.results.filter((r) => r.status === 'no-source').length}`,
      );
    } catch (err) {
      console.error('[snapshot-worker] tick failed:', err);
    }

    const elapsed = Date.now() - start;
    const wait = Math.max(0, env.intervalMs - elapsed);
    await new Promise<void>((r) => setTimeout(r, wait));
  }

  await dbHandle.close();
  console.log('[snapshot-worker] drained; exiting');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[snapshot-worker] fatal:', err);
    process.exit(1);
  });
}

export { runOnce, snapshotOne, findCandidates } from './snapshot';
export { loadEnv } from './env';
