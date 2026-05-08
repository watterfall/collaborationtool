// Drizzle Kit config — used by `drizzle-kit generate` to diff src/schema.ts
// against migrations/ and produce new SQL.
//
// Phase 1 NOTE: we currently maintain `migrations/0001_initial.sql` by hand
// to keep CHECK constraints and DEFERRABLE FK declarations explicit.
// Future migrations can be auto-generated; the journal in
// `migrations/meta/_journal.json` is updated either by drizzle-kit or by
// our custom migrate.ts runner (whichever is used).

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://collab:collab@localhost:5432/collaborationtool',
  },
  strict: true,
  verbose: true,
});
