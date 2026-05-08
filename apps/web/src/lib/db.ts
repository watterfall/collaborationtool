// Server-only Drizzle handle. Module-scoped so Next.js dev hot-reload
// doesn't open a new connection per request — Next preserves module
// state across hot reloads in dev.

import { openDatabase, type Database } from '@collaborationtool/drizzle';

import { env } from './env';

let cached:
  | {
      db: Database;
      close: () => Promise<void>;
    }
  | null = null;

export function getDb(): Database {
  if (!cached) {
    const handle = openDatabase({ url: env.databaseUrl });
    cached = handle;
  }
  return cached.db;
}

// For graceful shutdown / tests.
export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}
