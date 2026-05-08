// Test helpers — shared setup/teardown for round-trip tests.

import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '../src/client';
import { runMigrations } from '../src/migrate';

export const DATABASE_URL = process.env['DATABASE_URL'];
export const SHOULD_SKIP = !DATABASE_URL;

if (SHOULD_SKIP) {
  // node:test honours t.skip(); we set a flag and tests early-return.
  console.warn(
    '[tests] DATABASE_URL not set — skipping Drizzle round-trip tests. ' +
      'Run `cd infra/docker && docker compose up -d` and `export DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool` to enable.',
  );
}

export async function setupFreshSchema(): Promise<void> {
  if (!DATABASE_URL) return;
  const { client, close } = openDatabase({ url: DATABASE_URL, max: 1 });
  try {
    // Drop everything we own — tests run in a dedicated DB anyway, but
    // this lets repeated test runs start clean.
    await client.unsafe(`
      DROP TABLE IF EXISTS "_drizzle_migrations" CASCADE;
      DROP TABLE IF EXISTS "annotation_comment" CASCADE;
      DROP TABLE IF EXISTS "annotation_thread" CASCADE;
      DROP TABLE IF EXISTS "block_metadata" CASCADE;
      DROP TABLE IF EXISTS "capability_grant" CASCADE;
      DROP TABLE IF EXISTS "citation" CASCADE;
      DROP TABLE IF EXISTS "contribution" CASCADE;
      DROP TABLE IF EXISTS "document_acl" CASCADE;
      DROP TABLE IF EXISTS "document" CASCADE;
      DROP TABLE IF EXISTS "prompt_template" CASCADE;
      DROP TABLE IF EXISTS "provenance" CASCADE;
      DROP TABLE IF EXISTS "revision" CASCADE;
      DROP TABLE IF EXISTS "agent" CASCADE;
      DROP TABLE IF EXISTS "principal" CASCADE;
      DROP TYPE IF EXISTS "principal_kind" CASCADE;
      DROP TYPE IF EXISTS "agent_kind" CASCADE;
      DROP TYPE IF EXISTS "agent_runtime" CASCADE;
      DROP TYPE IF EXISTS "bilingual_mode" CASCADE;
      DROP TYPE IF EXISTS "citation_kind" CASCADE;
      DROP TYPE IF EXISTS "annotation_kind" CASCADE;
      DROP TYPE IF EXISTS "annotation_status" CASCADE;
      DROP TYPE IF EXISTS "revision_status" CASCADE;
      DROP TYPE IF EXISTS "actor_kind" CASCADE;
      DROP TYPE IF EXISTS "capability_resource_type" CASCADE;
    `);
  } finally {
    await close();
  }
  await runMigrations(DATABASE_URL);
}

export function newId(): string {
  return uuidv7();
}

export function userPrincipalId(): string {
  return `user:${uuidv7()}`;
}

export function agentPrincipalId(agentId: string): string {
  return `agent:${agentId}`;
}

export { openDatabase, schema };
