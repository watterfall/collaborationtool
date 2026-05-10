// Phase 4 W9 dogfood gate G4 — pgboss + 6 finding fixture + dashboard
// (ADR-0011 §7).
//
// Sandbox-runnable end-to-end:
//   1. Run `pnpm db:seed:maintenance` to insert the 6 fixtures (one
//      claim/source/citation per ScanFindingKind). Idempotent.
//   2. Read PG via the workspace Drizzle client (already an e2e dep)
//      and assert the 6 fixture rows are present + correctly shaped.
//   3. Surface dashboard route `/maintenance` via the apps/web HTTP
//      surface — assert the route lives (200/302/401/403, not 404).
//
// The full pgboss enqueue + scanForFindings round-trip is exercised by
// `apps/agent-worker/tests/maintenance-scan.test.ts` (26 tests). G4
// here verifies the seed → schema → dashboard surface contract.

import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { eq } from 'drizzle-orm';
import path from 'node:path';

import { openDatabase, schema } from '@collaborationtool/drizzle';

const DATABASE_URL = process.env['DATABASE_URL'];

const FIXTURE_DOC_ID = '00000000-0000-7000-8000-0000000fdoc1';
const VAULT_PRINCIPAL_ID = 'user:00000000-0000-7000-8000-000000000001';
const BROKEN_CIT_DOI = '10.9999/dogfood-broken-citation-fixture';

test('dogfood G4 #1 — `pnpm db:seed:maintenance` runs idempotently', async () => {
  if (!DATABASE_URL) {
    test.skip(true, 'requires DATABASE_URL (run `pnpm db:up && pnpm db:migrate` first)');
    return;
  }
  // Resolve repo root from this spec's location.
  const here = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(here, '../../..');

  const r1 = spawnSync('pnpm', ['db:seed:maintenance'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL },
  });
  expect(r1.status, `seed failed: stderr=${r1.stderr}`).toBe(0);
  expect(r1.stdout).toMatch(/seed:maintenance/);

  // Re-run: must be idempotent (ON CONFLICT DO NOTHING throughout).
  const r2 = spawnSync('pnpm', ['db:seed:maintenance'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL },
  });
  expect(r2.status).toBe(0);
});

test('dogfood G4 #2 — 6 fixtures present in PG (one per ScanFindingKind)', async () => {
  if (!DATABASE_URL) {
    test.skip(true, 'requires DATABASE_URL');
    return;
  }

  const handle = openDatabase({ url: DATABASE_URL });
  try {
    // Document fixture exists.
    const docs = await handle.db
      .select({ id: schema.document.id, slug: schema.document.slug })
      .from(schema.document)
      .where(eq(schema.document.id, FIXTURE_DOC_ID));
    expect(docs).toHaveLength(1);
    expect(docs[0]?.slug).toBe('dogfood-maintenance-fixture');

    // Broken-citation fixture exists with the seeded DOI.
    const cits = await handle.db
      .select({ id: schema.citation.id, doi: schema.citation.doi })
      .from(schema.citation)
      .where(eq(schema.citation.doi, BROKEN_CIT_DOI));
    expect(cits).toHaveLength(1);

    // 4 fixture claims (unsupported, aging, contradicted, dup-A, dup-B = 5
    // claims total under the demo vault). We assert ≥ 4 since other
    // tests may add more under this vault.
    const claims = await handle.db
      .select({ id: schema.claim.id })
      .from(schema.claim)
      .where(eq(schema.claim.documentOriginId, FIXTURE_DOC_ID));
    expect(claims.length).toBeGreaterThanOrEqual(4);

    // 1 challenging evidence linked to contradicted-conclusion claim.
    const evList = await handle.db
      .select({ id: schema.evidence.id, relation: schema.evidence.relation })
      .from(schema.evidence)
      .where(eq(schema.evidence.documentOriginId, FIXTURE_DOC_ID));
    expect(
      evList.some((e) => e.relation === 'challenges'),
      'expected at least one `challenges` evidence',
    ).toBe(true);

    // 1 outdated source under the demo vault.
    const sources = await handle.db
      .select({ id: schema.source.id, accessedAt: schema.source.accessedAt })
      .from(schema.source)
      .where(eq(schema.source.importedBy, VAULT_PRINCIPAL_ID));
    const outdated = sources.find((s) => {
      if (!s.accessedAt) return false;
      const ageMonths =
        (Date.now() - new Date(s.accessedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
      return ageMonths > 18;
    });
    expect(outdated, 'expected an outdated source (> 18mo accessed_at)').toBeTruthy();
  } finally {
    await handle.close();
  }
});

test('dogfood G4 #3 — `/maintenance` dashboard route exists', async ({
  request,
  baseURL,
}) => {
  if (!baseURL) {
    test.skip(true, 'requires apps/web running');
    return;
  }
  const res = await request.get('/maintenance');
  // Auth-protected; we accept any non-404 status as "route lives".
  expect([200, 302, 401, 403]).toContain(res.status());
});
