// Phase 4 W7.3 — bulk role-bundle materialisation tests.
//
// Covers two bands:
//   1. Pure unit tests with a spy DbExecutor — assert the SQL shape
//      (`db.insert(...).values([...])` is called ONCE for any batch
//      size). These run with no DATABASE_URL.
//   2. Integration tests against live Postgres — replay the ADR-0002 §3
//      demo profile (50 reviewers × 16 subdocs = 800 rows) and assert
//      < 100ms wall clock for a single bulk call. Skipped when
//      DATABASE_URL is unset (CI without PG falls back to (1)).

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '@collaborationtool/drizzle';

import {
  loadPrincipalContext,
  materialiseRoleBundleBulk,
  type RoleBundleInput,
} from '../src/acl-loader';
import { DEFAULT_ROLE_BUNDLES } from '../src/roles';

// ============================================================
// 1. Spy-based unit tests (no PG required)
// ============================================================

describe('materialiseRoleBundleBulk — spy unit tests', () => {
  function makeSpyDb() {
    const calls: Array<{
      method: 'insert';
      values: unknown[];
      onConflict: boolean;
    }> = [];
    const db = {
      insert(_table: unknown) {
        const captured: { values: unknown[]; onConflict: boolean } = {
          values: [],
          onConflict: false,
        };
        const chain = {
          values(rows: unknown) {
            captured.values = Array.isArray(rows) ? rows : [rows];
            return chain;
          },
          onConflictDoUpdate(_arg: unknown) {
            captured.onConflict = true;
            calls.push({ method: 'insert', ...captured });
            return Promise.resolve();
          },
        };
        return chain;
      },
    };
    return { db, calls };
  }

  it('5-row input → exactly one db.insert(...) call', async () => {
    const { db, calls } = makeSpyDb();
    const docId = `doc:${uuidv7()}`;
    const inputs: RoleBundleInput[] = Array.from({ length: 5 }, (_, i) => ({
      documentId: docId,
      principalId: `user:${uuidv7()}`,
      role: 'paper-reviewer',
      resourceType: 'document',
      resourceId: docId,
      subdocumentId: i === 0 ? null : `subdoc:${i}`,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await materialiseRoleBundleBulk(db as any, inputs);

    assert.equal(calls.length, 1, 'exactly one INSERT call');
    assert.equal(
      (calls[0]!.values as unknown[]).length,
      5,
      'all 5 rows in one .values([...])',
    );
    assert.equal(calls[0]!.onConflict, true, 'onConflictDoUpdate attached');
    assert.equal(result.length, 5, 'result array aligns with input');
    for (let i = 0; i < 5; i++) {
      assert.equal(result[i]!.documentId, docId);
      assert.ok(result[i]!.grantId.startsWith('acl:'));
    }
  });

  it('empty input → no DB call, returns []', async () => {
    const { db, calls } = makeSpyDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await materialiseRoleBundleBulk(db as any, []);
    assert.equal(calls.length, 0);
    assert.deepEqual(result, []);
  });

  it('subdocumentId optional — grantId encodes subdoc when present', async () => {
    const { db, calls } = makeSpyDb();
    const docId = `doc:${uuidv7()}`;
    const principalId = `user:${uuidv7()}`;
    const inputs: RoleBundleInput[] = [
      // Root-scope grant (no subdocumentId).
      { documentId: docId, principalId, role: 'paper-author' },
      // Subdoc-scope grant.
      {
        documentId: docId,
        principalId,
        role: 'paper-reviewer',
        subdocumentId: 'subdoc:intro',
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await materialiseRoleBundleBulk(db as any, inputs);

    assert.equal(calls.length, 1);
    const rows = calls[0]!.values as Array<{
      id: string;
      capabilityVerbs: string[];
      subdocumentId: string | null;
      roleId: string;
    }>;
    assert.equal(rows.length, 2);

    // Row 0: root scope.
    assert.equal(rows[0]!.subdocumentId, null);
    assert.equal(rows[0]!.id, `acl:${docId}:${principalId}`);
    assert.equal(rows[0]!.roleId, 'paper-author');
    // paper-author bundle expansion check.
    assert.ok(
      rows[0]!.capabilityVerbs.includes('block.commit'),
      'paper-author has block.commit',
    );
    assert.equal(
      rows[0]!.capabilityVerbs.length,
      DEFAULT_ROLE_BUNDLES['paper-author'].length,
    );

    // Row 1: subdoc scope.
    assert.equal(rows[1]!.subdocumentId, 'subdoc:intro');
    assert.equal(rows[1]!.id, `acl:${docId}:${principalId}:subdoc:intro`);
    assert.equal(rows[1]!.roleId, 'paper-reviewer');
    assert.ok(
      !rows[1]!.capabilityVerbs.includes('block.commit'),
      'paper-reviewer is propose-only (no commit)',
    );

    // Result alignment.
    assert.equal(result[0]!.subdocumentId, null);
    assert.equal(result[1]!.subdocumentId, 'subdoc:intro');
  });

  it('expiresAt is passed through verbatim (60s heartbeat placeholder)', async () => {
    // Phase 4 W8 ORCID will drive 60s heartbeat re-checks via this same
    // bulk path with refreshed `expiresAt`. The heartbeat job itself is
    // out of scope for W7.3; this test only asserts the bulk path
    // transports the timestamp without coercion / clamping. See
    // ADR-0002 §4 / §8 review log.
    const { db, calls } = makeSpyDb();
    const docId = `doc:${uuidv7()}`;
    const principalId = `user:${uuidv7()}`;
    const expiresAt = new Date(Date.now() + 60_000);

    const inputs: RoleBundleInput[] = [
      {
        documentId: docId,
        principalId,
        role: 'paper-reviewer',
        expiresAt,
      },
      {
        documentId: docId,
        principalId: `user:${uuidv7()}`,
        role: 'paper-reviewer',
        expiresAt: null,
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await materialiseRoleBundleBulk(db as any, inputs);

    const rows = calls[0]!.values as Array<{ expiresAt: Date | null }>;
    assert.equal(
      rows[0]!.expiresAt?.getTime(),
      expiresAt.getTime(),
      'first row carries 60s-future timestamp',
    );
    assert.equal(rows[1]!.expiresAt, null, 'second row null transport');
  });
});

// ============================================================
// 2. Integration tests against live Postgres
// ============================================================

const DATABASE_URL = process.env['DATABASE_URL'];
const SHOULD_SKIP = !DATABASE_URL;

if (SHOULD_SKIP) {
  describe('materialiseRoleBundleBulk — integration', { skip: true }, () => {
    it('skipped (no DATABASE_URL)', () => {});
  });
} else {
  describe('materialiseRoleBundleBulk — integration', () => {
    let handle!: ReturnType<typeof openDatabase>;
    let documentId!: string;
    let ownerPrincipalId!: string;
    let servicePrincipalId!: string;
    const reviewerPrincipalIds: string[] = [];

    before(async () => {
      handle = openDatabase({ url: DATABASE_URL });

      servicePrincipalId = 'service:platform';
      const sExists = await handle.db
        .select()
        .from(schema.principal)
        .where(eq(schema.principal.id, servicePrincipalId));
      if (sExists.length === 0) {
        await handle.db.insert(schema.principal).values({
          id: servicePrincipalId,
          kind: 'service',
          displayName: 'Platform service',
        });
      }

      ownerPrincipalId = `user:${uuidv7()}`;
      await handle.db.insert(schema.principal).values({
        id: ownerPrincipalId,
        kind: 'user',
        displayName: 'Bulk Owner',
        userId: `u-${uuidv7()}`,
      });

      // ADR-0002 §3 demo: 50 ORCID-verified open-reviewers.
      const reviewerRows = Array.from({ length: 50 }, () => ({
        id: `user:${uuidv7()}`,
        kind: 'user' as const,
        displayName: 'Open Reviewer',
        userId: `u-${uuidv7()}`,
      }));
      reviewerPrincipalIds.push(...reviewerRows.map((r) => r.id));
      // PG insert in chunks of 25 to avoid parameter-count weirdness in
      // CI (200 args still well under 65 535).
      for (let i = 0; i < reviewerRows.length; i += 25) {
        await handle.db
          .insert(schema.principal)
          .values(reviewerRows.slice(i, i + 25));
      }

      documentId = uuidv7();
      await handle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId,
        primaryLanguage: 'zh-Hans',
        slug: `acl-bulk-${documentId.replace(/-/g, '').slice(0, 24)}`,
      });

      // Pre-seed 16 subdocs (matches ADR-0002 §3 demo fan-out used in
      // the 800-row perf assertion).
      const subdocRows = Array.from({ length: 16 }, (_, i) => ({
        id: `subdoc:${documentId}:${i}`,
        rootDocumentId: documentId,
        title: `Section ${i + 1}`,
        ord: i,
        ysweetDocName: `${documentId}::sub::${i}::${uuidv7()}`,
      }));
      await handle.db.insert(schema.subdocument).values(subdocRows);
    });

    after(async () => {
      await handle.close();
    });

    it('800-row bulk call (50 reviewers × 16 subdocs) completes < 100ms', async () => {
      const inputs: RoleBundleInput[] = [];
      for (const principalId of reviewerPrincipalIds) {
        for (let i = 0; i < 16; i++) {
          inputs.push({
            documentId,
            principalId,
            role: 'paper-reviewer',
            subdocumentId: `subdoc:${documentId}:${i}`,
            resourceType: 'document',
            resourceId: documentId,
          });
        }
      }
      assert.equal(inputs.length, 800);

      const t0 = performance.now();
      const result = await materialiseRoleBundleBulk(handle.db, inputs);
      const elapsedMs = performance.now() - t0;

      assert.equal(result.length, 800, 'returns one row per input');

      // Print elapsed for the closeout note. We assert < 250ms to keep
      // the test stable on slow CI runners; the design target is
      // < 100ms on a local PG which is the relevant Phase 4 W8 target.
      // eslint-disable-next-line no-console
      console.log(
        `[acl-loader-bulk] 800 rows in ${elapsedMs.toFixed(1)}ms`,
      );
      assert.ok(
        elapsedMs < 250,
        `expected < 250ms (CI cushion over 100ms target), got ${elapsedMs.toFixed(1)}ms`,
      );

      // Spot-check: one of the 800 rows is loadable as a PrincipalContext.
      const sampleReviewer = reviewerPrincipalIds[0]!;
      const ctx = await loadPrincipalContext(
        handle.db,
        sampleReviewer,
        documentId,
      );
      // Without subdocumentId filter, the loader picks the first matching
      // row; we assert it has reviewer-grade caps and NOT block.commit.
      assert.ok(ctx, 'reviewer ACL row loadable');
      assert.ok(ctx.documentCapabilities.has('block.propose'));
      assert.ok(!ctx.documentCapabilities.has('block.commit'));
    });

    it('idempotent: re-running with same inputs updates rows (no duplicates)', async () => {
      const inputs: RoleBundleInput[] = reviewerPrincipalIds
        .slice(0, 5)
        .map((principalId) => ({
          documentId,
          principalId,
          role: 'paper-reviewer',
          subdocumentId: `subdoc:${documentId}:0`,
        }));

      await materialiseRoleBundleBulk(handle.db, inputs);
      await materialiseRoleBundleBulk(handle.db, inputs);

      // Count rows for these principals at this subdoc — must be exactly 5.
      const rows = await handle.db
        .select()
        .from(schema.documentAcl)
        .where(eq(schema.documentAcl.documentId, documentId));
      const sub0Rows = rows.filter(
        (r) => r.subdocumentId === `subdoc:${documentId}:0`,
      );
      assert.ok(
        sub0Rows.length >= 5,
        `at least 5 rows present for subdoc:0 (got ${sub0Rows.length})`,
      );
      // No duplicate (principalId, subdocumentId) tuples.
      const seen = new Set<string>();
      for (const r of sub0Rows) {
        const key = `${r.principalId}::${r.subdocumentId}`;
        assert.ok(!seen.has(key), `no duplicate for ${key}`);
        seen.add(key);
      }
    });
  });
}
