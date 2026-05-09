// Snapshot worker integration test — runs against live Postgres.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '@collaborationtool/drizzle';

import { findCandidates, runOnce, snapshotOne } from '../src/snapshot';

const DATABASE_URL = process.env['DATABASE_URL'];
const SHOULD_SKIP = !DATABASE_URL;

if (SHOULD_SKIP) {
  describe('snapshot worker (integration)', { skip: true }, () => {
    it('skipped (no DATABASE_URL)', () => {});
  });
} else {
  describe('snapshot worker (integration)', () => {
    let handle!: ReturnType<typeof openDatabase>;
    let ownerPrincipalId!: string;

    before(async () => {
      handle = openDatabase({ url: DATABASE_URL });

      // Reuse demo user if seeded; otherwise create one for the test.
      const seeded = 'user:00000000-0000-7000-8000-000000000001';
      const rows = await handle.db
        .select({ id: schema.principal.id })
        .from(schema.principal)
        .where(eq(schema.principal.id, seeded));
      if (rows.length > 0) {
        ownerPrincipalId = seeded;
      } else {
        ownerPrincipalId = `user:${uuidv7()}`;
        await handle.db.insert(schema.principal).values({
          id: ownerPrincipalId,
          kind: 'user',
          displayName: 'Snapshot Test',
          userId: `u-${uuidv7()}`,
        });
      }
    });

    after(async () => {
      await handle.close();
    });

    function freshSlug(prefix: string, id: string): string {
      return `${prefix}-${id.replace(/-/g, '').slice(0, 24)}`;
    }

    // ---------- findCandidates ----------

    it('findCandidates picks up never-snapshotted docs', async () => {
      const docId = uuidv7();
      await handle.db.insert(schema.document).values({
        id: docId,
        ownerPrincipalId,
        primaryLanguage: 'en',
        slug: freshSlug('snap-fresh', docId),
      });

      const candidates = await findCandidates(handle.db, 60_000);
      assert.ok(candidates.some((c) => c.documentId === docId));
    });

    it('findCandidates skips docs whose snapshot is recent + up-to-date', async () => {
      const docId = uuidv7();
      const now = new Date();
      await handle.db.insert(schema.document).values({
        id: docId,
        ownerPrincipalId,
        primaryLanguage: 'en',
        slug: freshSlug('snap-recent', docId),
        updatedAt: now,
        lastSnapshotAt: new Date(now.getTime() + 1000), // ahead — pretend just snapshotted
      });

      const candidates = await findCandidates(handle.db, 60 * 60 * 1000);
      assert.ok(!candidates.some((c) => c.documentId === docId));
    });

    // ---------- snapshotOne ----------

    it('snapshotOne writes bytea + bumps last_snapshot_at when source returns bytes', async () => {
      const docId = uuidv7();
      await handle.db.insert(schema.document).values({
        id: docId,
        ownerPrincipalId,
        primaryLanguage: 'en',
        slug: freshSlug('snap-write', docId),
      });

      const fakeBinary = new Uint8Array([0xab, 0xcd, 0xef, 0x01, 0x02]);
      const result = await snapshotOne(handle.db, docId, {
        fetchYjsBinary: async () => fakeBinary,
      });
      assert.equal(result.status, 'snapshotted');

      const rows = await handle.db
        .select({
          binary: schema.document.yjsDocBinary,
          lastSnapshotAt: schema.document.lastSnapshotAt,
        })
        .from(schema.document)
        .where(eq(schema.document.id, docId));
      assert.equal(rows.length, 1);
      assert.deepEqual(Array.from(rows[0]!.binary!), Array.from(fakeBinary));
      assert.ok(rows[0]!.lastSnapshotAt instanceof Date);
    });

    it('snapshotOne returns no-source when fetcher returns null', async () => {
      const docId = uuidv7();
      await handle.db.insert(schema.document).values({
        id: docId,
        ownerPrincipalId,
        primaryLanguage: 'en',
        slug: freshSlug('snap-none', docId),
      });

      const result = await snapshotOne(handle.db, docId, {
        fetchYjsBinary: async () => null,
      });
      assert.equal(result.status, 'no-source');

      // last_snapshot_at NOT bumped.
      const rows = await handle.db
        .select({ lastSnapshotAt: schema.document.lastSnapshotAt })
        .from(schema.document)
        .where(eq(schema.document.id, docId));
      assert.equal(rows[0]!.lastSnapshotAt, null);
    });

    // ---------- runOnce ----------

    it('runOnce respects maxPerTick', async () => {
      // Insert 3 fresh candidates.
      const ids = [uuidv7(), uuidv7(), uuidv7()];
      for (const id of ids) {
        await handle.db.insert(schema.document).values({
          id,
          ownerPrincipalId,
          primaryLanguage: 'en',
          slug: freshSlug('snap-cap', id),
        });
      }

      let calls = 0;
      const result = await runOnce(handle.db, {
        staleAfterMs: 60_000,
        maxPerTick: 2,
        fetchYjsBinary: async () => {
          calls += 1;
          return new Uint8Array([1]);
        },
      });

      assert.ok(result.candidates >= 3);
      assert.equal(result.results.length, 2);
      assert.equal(calls, 2);
    });
  });
}
