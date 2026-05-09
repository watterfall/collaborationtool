// Integration test for principal-bridge.ts. Talks to live Postgres.
// Skips when DATABASE_URL is unset.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '@collaborationtool/drizzle';

import {
  createOrgPrincipal,
  createUserPrincipal,
  findPrincipalIdByOrgId,
  findPrincipalIdByUserId,
  revokeOrgPrincipal,
  revokeUserPrincipal,
} from '../src/principal-bridge';

const DATABASE_URL = process.env['DATABASE_URL'];
const SHOULD_SKIP = !DATABASE_URL;

if (SHOULD_SKIP) {
  describe('principal-bridge (integration)', { skip: true }, () => {
    it('skipped (no DATABASE_URL)', () => {});
  });
} else {
  describe('principal-bridge (integration)', () => {
    let handle!: ReturnType<typeof openDatabase>;

    before(() => {
      handle = openDatabase({ url: DATABASE_URL });
    });

    after(async () => {
      await handle.close();
    });

    // ---------- createUserPrincipal ----------

    it('createUserPrincipal inserts a principal with prefix-encoded id', async () => {
      const userId = `u-${uuidv7()}`;
      const result = await createUserPrincipal(handle.db, {
        userId,
        displayName: 'Alice 张',
      });
      assert.equal(result.created, true);
      assert.match(result.principalId, /^user:[0-9a-f-]+$/);

      const rows = await handle.db
        .select()
        .from(schema.principal)
        .where(eq(schema.principal.id, result.principalId));
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.kind, 'user');
      assert.equal(rows[0]!.userId, userId);
      assert.equal(rows[0]!.displayName, 'Alice 张');
      assert.equal(rows[0]!.revokedAt, null);
    });

    it('createUserPrincipal is idempotent (returns existing on duplicate userId)', async () => {
      const userId = `u-${uuidv7()}`;
      const first = await createUserPrincipal(handle.db, {
        userId,
        displayName: 'Bob',
      });
      assert.equal(first.created, true);

      const second = await createUserPrincipal(handle.db, {
        userId,
        displayName: 'Bob (different display)',
      });
      assert.equal(second.created, false);
      assert.equal(second.principalId, first.principalId);
    });

    // ---------- createOrgPrincipal ----------

    it('createOrgPrincipal inserts an org principal', async () => {
      const orgId = `o-${uuidv7()}`;
      const result = await createOrgPrincipal(handle.db, {
        orgId,
        displayName: 'Acme Lab',
      });
      assert.equal(result.created, true);
      assert.match(result.principalId, /^org:[0-9a-f-]+$/);

      const rows = await handle.db
        .select()
        .from(schema.principal)
        .where(eq(schema.principal.id, result.principalId));
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.kind, 'org');
      assert.equal(rows[0]!.orgId, orgId);
      assert.equal(rows[0]!.displayName, 'Acme Lab');
    });

    it('createOrgPrincipal is idempotent', async () => {
      const orgId = `o-${uuidv7()}`;
      const first = await createOrgPrincipal(handle.db, {
        orgId,
        displayName: 'Org A',
      });
      const second = await createOrgPrincipal(handle.db, {
        orgId,
        displayName: 'Org A v2',
      });
      assert.equal(second.created, false);
      assert.equal(second.principalId, first.principalId);
    });

    // ---------- find ----------

    it('findPrincipalIdByUserId returns the correct id or null', async () => {
      const userId = `u-${uuidv7()}`;
      const created = await createUserPrincipal(handle.db, {
        userId,
        displayName: 'Carol',
      });
      const found = await findPrincipalIdByUserId(handle.db, userId);
      assert.equal(found, created.principalId);

      const missing = await findPrincipalIdByUserId(handle.db, 'no-such-user');
      assert.equal(missing, null);
    });

    it('findPrincipalIdByOrgId returns the correct id or null', async () => {
      const orgId = `o-${uuidv7()}`;
      const created = await createOrgPrincipal(handle.db, {
        orgId,
        displayName: 'Team B',
      });
      const found = await findPrincipalIdByOrgId(handle.db, orgId);
      assert.equal(found, created.principalId);

      const missing = await findPrincipalIdByOrgId(handle.db, 'no-such-org');
      assert.equal(missing, null);
    });

    // ---------- revoke ----------

    it('revokeUserPrincipal sets revokedAt (no DELETE — historical truth)', async () => {
      const userId = `u-${uuidv7()}`;
      const created = await createUserPrincipal(handle.db, {
        userId,
        displayName: 'Dan',
      });

      const before = new Date();
      const revoked = await revokeUserPrincipal(handle.db, userId);
      assert.equal(revoked.revoked, true);

      const rows = await handle.db
        .select()
        .from(schema.principal)
        .where(eq(schema.principal.id, created.principalId));
      assert.equal(rows.length, 1);
      assert.ok(rows[0]!.revokedAt instanceof Date);
      assert.ok(rows[0]!.revokedAt!.getTime() >= before.getTime() - 1000);
    });

    it('revokeUserPrincipal returns revoked=false when user not found', async () => {
      const r = await revokeUserPrincipal(handle.db, 'no-such-user');
      assert.equal(r.revoked, false);
    });

    it('revokeOrgPrincipal mirrors revokeUserPrincipal', async () => {
      const orgId = `o-${uuidv7()}`;
      const created = await createOrgPrincipal(handle.db, {
        orgId,
        displayName: 'Org C',
      });

      const r = await revokeOrgPrincipal(handle.db, orgId);
      assert.equal(r.revoked, true);

      const rows = await handle.db
        .select({ revokedAt: schema.principal.revokedAt })
        .from(schema.principal)
        .where(eq(schema.principal.id, created.principalId));
      assert.ok(rows[0]!.revokedAt instanceof Date);
    });

    // ---------- transactional usage ----------

    it('bridge functions compose inside a transaction (typical signup flow)', async () => {
      const userId = `u-${uuidv7()}`;
      const orgId = `o-${uuidv7()}`;

      const result = await handle.db.transaction(async (tx) => {
        const u = await createUserPrincipal(tx, {
          userId,
          displayName: 'Eve',
        });
        const o = await createOrgPrincipal(tx, {
          orgId,
          displayName: "Eve's Lab",
        });
        return { user: u, org: o };
      });

      assert.ok(result.user.created);
      assert.ok(result.org.created);

      // Both rows visible after tx commit.
      const ids = [result.user.principalId, result.org.principalId];
      for (const id of ids) {
        const rows = await handle.db
          .select()
          .from(schema.principal)
          .where(eq(schema.principal.id, id));
        assert.equal(rows.length, 1);
      }
    });

    it('transactional rollback un-creates the principal', async () => {
      const userId = `u-${uuidv7()}`;
      await assert.rejects(
        handle.db.transaction(async (tx) => {
          await createUserPrincipal(tx, {
            userId,
            displayName: 'Frank',
          });
          throw new Error('rollback');
        }),
        /rollback/,
      );

      const found = await findPrincipalIdByUserId(handle.db, userId);
      assert.equal(found, null);
    });
  });
}
