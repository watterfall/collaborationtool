// Postgres client + Drizzle wrapper. Single place that knows about the
// connection string and pooling. Application code imports `db` and the
// schema namespace, never raw SQL.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Database = ReturnType<typeof openDatabase>['db'];

export interface OpenDatabaseOptions {
  url?: string;
  max?: number;
  idleTimeout?: number;
  prepare?: boolean;
}

export function openDatabase(options: OpenDatabaseOptions = {}): {
  db: ReturnType<typeof drizzle<typeof schema>>;
  client: ReturnType<typeof postgres>;
  close: () => Promise<void>;
} {
  const url =
    options.url ??
    process.env['DATABASE_URL'] ??
    'postgres://collab:collab@localhost:5432/collaborationtool';

  const client = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeout ?? 30,
    prepare: options.prepare ?? true,
  });

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

export { schema };
