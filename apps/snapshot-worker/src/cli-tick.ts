// One-shot CLI: run a single snapshot tick and exit. Useful for
// `pnpm snapshot:tick` in dev to verify the worker picks up dirty docs
// without running the daemon.

import { openDatabase } from '@collaborationtool/drizzle';

import { loadEnv } from './env';
import { runOnce } from './snapshot';

async function main(): Promise<void> {
  const env = loadEnv();
  const dbHandle = openDatabase({ url: env.databaseUrl, max: 2 });
  try {
    const result = await runOnce(dbHandle.db, {
      staleAfterMs: env.staleAfterMs,
      maxPerTick: env.maxPerTick,
      fetchYjsBinary: async () => null,
    });
    console.log(
      JSON.stringify(
        {
          candidates: result.candidates,
          snapshotted: result.results.filter((r) => r.status === 'snapshotted').length,
          noSource: result.results.filter((r) => r.status === 'no-source').length,
          results: result.results,
        },
        null,
        2,
      ),
    );
  } finally {
    await dbHandle.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
