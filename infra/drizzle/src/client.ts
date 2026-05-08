// Postgres client + Drizzle wrapper. Single place that knows about the
// connection string and pooling. Application code imports `db` and the
// schema namespace, never raw SQL.

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as authSchema from './auth-schema';
import * as schema from './schema';

const fullSchema = { ...schema, ...authSchema };
type FullSchema = typeof fullSchema;

/**
 * The top-level Drizzle handle returned by `openDatabase`. Carries the
 * postgres-js client (`$client`) for ad-hoc raw queries.
 */
export type Database = ReturnType<typeof openDatabase>['db'];

/**
 * A type that BOTH the top-level `Database` and any `PgTransaction`
 * satisfy. Use this in helper / bridge functions that should compose
 * inside a transaction. ADR-0001 §2.5 commit boundary insertion paths
 * almost always run inside a tx.
 *
 * The schema generics are widened with `any` because we don't want
 * helper functions to over-specify which schema slice they need — the
 * runtime only cares that you can call `.select / .insert / .update /
 * .transaction` against any pgTable. Phase 1.5 may tighten this with
 * scoped `DbExecutor<Pick<FullSchema, ...>>` if helpers leak access to
 * tables they shouldn't touch.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbExecutor = PgDatabase<PostgresJsQueryResultHKT, any, any>;

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

  const db = drizzle(client, { schema: fullSchema });

  return {
    db,
    client,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

export { schema, authSchema };
