// Custom migration runner — reads `migrations/*.sql` in name order and
// applies any not yet recorded in `_drizzle_migrations`.
//
// Drizzle Kit can also generate + run migrations; we keep this runner
// because 0001_initial.sql contains hand-written DEFERRABLE FKs and CHECK
// constraints that don't round-trip cleanly through drizzle-kit's
// snapshot diff. Future migrations can use either system — they share
// the `_drizzle_migrations` ledger table.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');

async function listMigrations(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

export async function runMigrations(databaseUrl: string): Promise<{
  applied: string[];
  alreadyAppliedCount: number;
}> {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    onnotice: () => {
      /* suppress NOTICE chatter (e.g. CREATE TABLE IF NOT EXISTS on re-runs) */
    },
  });
  const applied: string[] = [];
  let alreadyAppliedCount = 0;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "_drizzle_migrations" (
        "name" text PRIMARY KEY NOT NULL,
        "applied_at" timestamptz NOT NULL DEFAULT now()
      )
    `;

    const recorded = await sql<Array<{ name: string }>>`
      SELECT "name" FROM "_drizzle_migrations"
    `;
    const appliedSet = new Set(recorded.map((r) => r.name));

    const files = await listMigrations();

    for (const file of files) {
      if (appliedSet.has(file)) {
        alreadyAppliedCount += 1;
        continue;
      }
      const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      await sql.begin(async (tx) => {
        // postgres.js tagged template will not run multiple statements in
        // one call; use `unsafe` (a deliberately escape-hatch API) for SQL
        // files. Safe because input is local trusted file content.
        await tx.unsafe(body);
        await tx`
          INSERT INTO "_drizzle_migrations" ("name") VALUES (${file})
        `;
      });
      applied.push(file);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  return { applied, alreadyAppliedCount };
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url =
    process.env['DATABASE_URL'] ??
    'postgres://collab:collab@localhost:5432/collaborationtool';

  runMigrations(url)
    .then(({ applied, alreadyAppliedCount }) => {
      if (applied.length === 0) {
        console.log(
          `[migrate] no new migrations (already applied: ${alreadyAppliedCount})`,
        );
      } else {
        console.log(
          `[migrate] applied ${applied.length} migration(s): ${applied.join(', ')}`,
        );
      }
    })
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
