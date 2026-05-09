// Integration test for acl-loader.ts — talks to live Postgres via the
// shared Drizzle client. Skips when DATABASE_URL is unset.
//
// We seed the migrations + a minimal principal/document fixture, then
// materialise role bundles via the loader and assert checker behavior
// against the loaded contexts.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '@collaborationtool/drizzle';

import { hasCapability } from '../src/checker';
import {
  loadPrincipalContext,
  materialiseRoleBundle,
} from '../src/acl-loader';
import { DEFAULT_ROLE_BUNDLES } from '../src/roles';

const DATABASE_URL = process.env['DATABASE_URL'];
const SHOULD_SKIP = !DATABASE_URL;

if (SHOULD_SKIP) {
  describe('acl-loader (integration)', { skip: true }, () => {
    it('skipped (no DATABASE_URL)', () => {});
  });
} else {
  describe('acl-loader (integration)', () => {
    let handle!: ReturnType<typeof openDatabase>;
    let documentId!: string;
    let authorPrincipalId!: string;
    let reviewerPrincipalId!: string;
    let servicePrincipalId!: string;

    before(async () => {
      handle = openDatabase({ url: DATABASE_URL });

      // Reuse the seeded service principal as grantor + create
      // dedicated test principals.
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

      authorPrincipalId = `user:${uuidv7()}`;
      reviewerPrincipalId = `user:${uuidv7()}`;
      await handle.db.insert(schema.principal).values([
        {
          id: authorPrincipalId,
          kind: 'user',
          displayName: 'Author A',
          userId: `u-${uuidv7()}`,
        },
        {
          id: reviewerPrincipalId,
          kind: 'user',
          displayName: 'Reviewer C',
          userId: `u-${uuidv7()}`,
        },
      ]);

      documentId = uuidv7();
      await handle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: authorPrincipalId,
        primaryLanguage: 'zh-Hans',
        slug: `acl-loader-${documentId.replace(/-/g, "").slice(0, 24)}`,
      });
    });

    after(async () => {
      await handle.close();
    });

    it('loadPrincipalContext returns null when no ACL row exists', async () => {
      const ctx = await loadPrincipalContext(
        handle.db,
        reviewerPrincipalId,
        documentId,
      );
      assert.equal(ctx, null);
    });

    it('materialiseRoleBundle inserts an ACL row', async () => {
      await materialiseRoleBundle(handle.db, {
        documentId,
        principalId: authorPrincipalId,
        roleId: 'paper-author',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
      });

      const ctx = await loadPrincipalContext(
        handle.db,
        authorPrincipalId,
        documentId,
      );
      assert.ok(ctx);
      assert.ok(ctx.documentCapabilities.has('block.commit'));
      assert.ok(ctx.documentCapabilities.has('document.read'));

      // Smoke test the full pipeline: checker says yes.
      assert.ok(
        hasCapability(ctx, {
          verb: 'block.commit',
          resourceType: 'document',
          resourceId: documentId,
        }),
      );
    });

    it('materialiseRoleBundle is idempotent (upsert)', async () => {
      await materialiseRoleBundle(handle.db, {
        documentId,
        principalId: reviewerPrincipalId,
        roleId: 'paper-reviewer',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-reviewer'],
      });

      // Re-grant with a different role (e.g. promoting reviewer to author).
      await materialiseRoleBundle(handle.db, {
        documentId,
        principalId: reviewerPrincipalId,
        roleId: 'paper-author',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
      });

      const ctx = await loadPrincipalContext(
        handle.db,
        reviewerPrincipalId,
        documentId,
      );
      assert.ok(ctx);
      // Now has block.commit (was reviewer, became author).
      assert.ok(ctx.documentCapabilities.has('block.commit'));
    });

    it('expiresAt in the past makes the row invisible to the loader', async () => {
      const ephemeralPrincipalId = `user:${uuidv7()}`;
      await handle.db.insert(schema.principal).values({
        id: ephemeralPrincipalId,
        kind: 'user',
        displayName: 'Ephemeral',
        userId: `u-${uuidv7()}`,
      });

      await materialiseRoleBundle(handle.db, {
        documentId,
        principalId: ephemeralPrincipalId,
        roleId: 'paper-reviewer',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-reviewer'],
        expiresAt: new Date(Date.now() - 1000),
      });

      const ctx = await loadPrincipalContext(
        handle.db,
        ephemeralPrincipalId,
        documentId,
      );
      assert.equal(ctx, null);

      // ignoreExpiry bypass works (used by audit / debugging tools).
      const ctxBypass = await loadPrincipalContext(
        handle.db,
        ephemeralPrincipalId,
        documentId,
        { ignoreExpiry: true },
      );
      assert.ok(ctxBypass);
    });

    it('unknown capability strings (vocab drift) are filtered out', async () => {
      const principalId = `user:${uuidv7()}`;
      await handle.db.insert(schema.principal).values({
        id: principalId,
        kind: 'user',
        displayName: 'Drifted',
        userId: `u-${uuidv7()}`,
      });

      // Insert ACL row directly with a verb that's NOT in the current
      // vocabulary (simulating an old materialisation we haven't migrated).
      await handle.db.insert(schema.documentAcl).values({
        documentId,
        principalId,
        roleId: 'custom',
        capabilityVerbs: ['document.read', 'block.read', 'unknown.legacy-verb'],
      });

      const ctx = await loadPrincipalContext(handle.db, principalId, documentId);
      assert.ok(ctx);
      assert.equal(ctx.documentCapabilities.size, 2);
      assert.ok(ctx.documentCapabilities.has('document.read'));
      assert.ok(ctx.documentCapabilities.has('block.read'));
    });
  });
}
