// Round-trip tests for every table in the Phase 1 schema.
//
// Each test:
//   1. inserts a fixture row through Drizzle
//   2. selects it back
//   3. asserts the round-trip is byte-identical for binary fields and
//      structurally equal for jsonb / arrays
//
// Requires DATABASE_URL pointing to a fresh Postgres (e.g. the
// docker-compose Postgres 16). When DATABASE_URL is unset every test
// short-circuits with a skip notice — CI will run them with the env var
// configured by GitHub Actions service container.

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';

import { eq, sql as rawSql } from 'drizzle-orm';

import { openDatabase, schema } from '../src/client';
import { runMigrations } from '../src/migrate';
import { seed } from '../src/seed';
import {
  DATABASE_URL,
  SHOULD_SKIP,
  agentPrincipalId,
  newId,
  setupFreshSchema,
  userPrincipalId,
} from './helpers';

if (SHOULD_SKIP) {
  describe('Drizzle round-trip', { skip: true }, () => {
    it('skipped (no DATABASE_URL)', () => {});
  });
} else {
  describe('Drizzle round-trip', () => {
    let dbHandle!: ReturnType<typeof openDatabase>;
    let demoUserPrincipalId!: string;
    let servicePrincipalId!: string;

    before(async () => {
      await setupFreshSchema();
      const seeded = await seed(DATABASE_URL);
      demoUserPrincipalId = seeded.demoUserPrincipalId;
      servicePrincipalId = seeded.servicePrincipalId;
      dbHandle = openDatabase({ url: DATABASE_URL });
    });

    after(async () => {
      await dbHandle.close();
    });

    // ---------- migrations idempotent ----------

    it('migrate runner is idempotent', async () => {
      assert.ok(DATABASE_URL);
      const second = await runMigrations(DATABASE_URL);
      assert.equal(second.applied.length, 0);
      assert.ok(second.alreadyAppliedCount >= 1);
    });

    // ---------- seed values ----------

    it('seed creates the expected service + demo user + citation agent', async () => {
      const principals = await dbHandle.db.select().from(schema.principal);
      const ids = principals.map((p) => p.id).sort();
      assert.ok(ids.includes('service:platform'));
      assert.ok(ids.some((id) => id.startsWith('user:')));
      assert.ok(ids.some((id) => id.startsWith('agent:')));

      const agents = await dbHandle.db.select().from(schema.agent);
      assert.equal(agents.length, 1);
      assert.equal(agents[0]!.kind, 'citation');
      assert.equal(agents[0]!.runtime, 'server');
      assert.deepEqual(agents[0]!.defaultSkillIds, ['citation-lookup']);
    });

    // ---------- principal CHECK constraints ----------

    it('principal id prefix CHECK rejects mismatched kind', async () => {
      await assert.rejects(
        dbHandle.db.insert(schema.principal).values({
          // kind=user but id missing 'user:' prefix
          id: 'agent:bogus-prefix',
          kind: 'user',
          displayName: 'Bad',
          userId: 'u-bogus',
        }),
        /principal_id_prefix_matches_kind/,
      );
    });

    it('principal kind=user requires user_id and rejects extras', async () => {
      await assert.rejects(
        dbHandle.db.insert(schema.principal).values({
          id: userPrincipalId(),
          kind: 'user',
          displayName: 'Bad',
          // missing userId
        }),
        /principal_kind_link_consistency/,
      );
    });

    // ---------- citation (jsonb round-trip) ----------

    it('citation jsonb (csl_json + external_ids) round-trips', async () => {
      const id = newId();
      const csl = {
        type: 'article-journal',
        title: '中文论文 with English term',
        author: [{ family: '张', given: '三' }],
        DOI: '10.1234/example',
      };
      const externalIds = {
        crossref: '10.1234/example',
        orcid: ['0000-0000-0000-0001'],
      };
      await dbHandle.db.insert(schema.citation).values({
        id,
        kind: 'literature',
        cslJson: csl,
        doi: '10.1234/example',
        externalIds,
        createdBy: demoUserPrincipalId,
      });

      const rows = await dbHandle.db
        .select()
        .from(schema.citation)
        .where(eq(schema.citation.id, id));
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0]!.cslJson, csl);
      assert.deepEqual(rows[0]!.externalIds, externalIds);
      assert.equal(rows[0]!.kind, 'literature');
    });

    // ---------- provenance (jsonb + text[] + agent CHECK) ----------

    it('provenance with agentContext round-trips and preserves toolCalls order', async () => {
      const id = newId();
      const agentCtx = {
        agentId: '00000000-0000-7000-8000-00000000a001',
        modelId: 'claude-sonnet-4-6',
        modelProvider: 'anthropic',
        promptTemplateId: 'citation-lookup@seed-v1',
        promptHash: 'sha256:abc',
        inputSkillIds: ['citation-lookup'],
      };
      const tools = [
        {
          toolName: 'crossref.lookup_doi',
          mcpServerId: 'crossref-mock',
          argumentsHash: 'sha256:01',
          succeeded: true,
          durationMs: 12,
        },
        {
          toolName: 'crossref.lookup_doi',
          mcpServerId: 'crossref-mock',
          argumentsHash: 'sha256:02',
          succeeded: false,
          durationMs: 8,
        },
      ];
      await dbHandle.db.insert(schema.provenance).values({
        id,
        actorPrincipalId: agentPrincipalId(agentCtx.agentId),
        actorKind: 'agent',
        agentContext: agentCtx,
        inputBlockIds: ['blk-1', 'blk-2'],
        toolCalls: tools,
      });

      const rows = await dbHandle.db
        .select()
        .from(schema.provenance)
        .where(eq(schema.provenance.id, id));
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0]!.agentContext, agentCtx);
      assert.deepEqual(rows[0]!.toolCalls, tools);
      assert.deepEqual(rows[0]!.inputBlockIds, ['blk-1', 'blk-2']);
    });

    it('provenance CHECK forbids actor_kind=agent without agent_context', async () => {
      await assert.rejects(
        dbHandle.db.insert(schema.provenance).values({
          id: newId(),
          actorPrincipalId: agentPrincipalId('00000000-0000-7000-8000-00000000a001'),
          actorKind: 'agent',
          // missing agentContext
        }),
        /provenance_agent_requires_context/,
      );
    });

    // ---------- bytea (PM steps + Yjs binary) ----------

    it('revision bytea fields preserve byte sequence', async () => {
      // Need an actor principal that exists; reuse demo user.
      const documentId = newId();
      await dbHandle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: demoUserPrincipalId,
        primaryLanguage: 'en',
        slug: `doc-${documentId.replace(/-/g, "").slice(0, 24)}`,
      });

      const pmSteps = new Uint8Array([0x01, 0x02, 0xff, 0xfe, 0x00, 0x42]);
      const yjsUpdate = new Uint8Array([0xa1, 0xb2, 0xc3, 0xd4]);
      const stateVector = new Uint8Array([0x10, 0x20, 0x30]);

      const revisionId = newId();
      await dbHandle.db.insert(schema.revision).values({
        id: revisionId,
        documentId,
        proposedBy: demoUserPrincipalId,
        status: 'proposed',
        pmStepsBinary: pmSteps,
        yjsUpdateBinary: yjsUpdate,
        baseStateVector: stateVector,
      });

      const rows = await dbHandle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, revisionId));
      assert.equal(rows.length, 1);
      assert.deepEqual(Array.from(rows[0]!.pmStepsBinary), Array.from(pmSteps));
      assert.deepEqual(
        Array.from(rows[0]!.yjsUpdateBinary),
        Array.from(yjsUpdate),
      );
      assert.deepEqual(
        Array.from(rows[0]!.baseStateVector),
        Array.from(stateVector),
      );
    });

    // ---------- contribution + provenance + revision deferred FK cycle ----------

    it('contribution / revision / provenance can be inserted in one tx (deferred FKs)', async () => {
      const documentId = newId();
      await dbHandle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: demoUserPrincipalId,
        primaryLanguage: 'zh-Hans',
        slug: `cycle-${documentId.replace(/-/g, "").slice(0, 24)}`,
      });

      const provenanceId = newId();
      const revisionId = newId();
      const contributionId = newId();

      await dbHandle.db.transaction(async (tx) => {
        // Provenance first (no cycle dependency).
        await tx.insert(schema.provenance).values({
          id: provenanceId,
          actorPrincipalId: demoUserPrincipalId,
          actorKind: 'user',
        });
        // Revision references contribution (deferred), and provenance (immediate).
        await tx.insert(schema.revision).values({
          id: revisionId,
          documentId,
          proposedBy: demoUserPrincipalId,
          status: 'accepted',
          pmStepsBinary: new Uint8Array([1, 2, 3]),
          yjsUpdateBinary: new Uint8Array([4, 5, 6]),
          baseStateVector: new Uint8Array([7]),
          provenanceId,
          contributionId,
        });
        // Contribution references revision (deferred) + provenance (immediate).
        await tx.insert(schema.contribution).values({
          id: contributionId,
          documentId,
          fromRevisionId: revisionId,
          contributorPrincipalId: demoUserPrincipalId,
          pmStepsBinary: new Uint8Array([1, 2, 3]),
          yjsUpdateBinary: new Uint8Array([4, 5, 6]),
          affectedBlockIds: ['blk-a', 'blk-b'],
          provenanceId,
        });
      });

      const rev = await dbHandle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, revisionId));
      const contrib = await dbHandle.db
        .select()
        .from(schema.contribution)
        .where(eq(schema.contribution.id, contributionId));
      assert.equal(rev[0]!.contributionId, contributionId);
      assert.equal(contrib[0]!.fromRevisionId, revisionId);
      assert.deepEqual(contrib[0]!.affectedBlockIds, ['blk-a', 'blk-b']);
    });

    // ---------- contribution provenance NOT NULL ----------

    it('contribution.provenance_id is NOT NULL — bare commit rejected', async () => {
      const documentId = newId();
      await dbHandle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: demoUserPrincipalId,
        primaryLanguage: 'en',
        slug: `nopv-${documentId.replace(/-/g, "").slice(0, 24)}`,
      });

      await assert.rejects(
        // @ts-expect-error -- intentionally omitting provenanceId to assert NOT NULL
        dbHandle.db.insert(schema.contribution).values({
          id: newId(),
          documentId,
          contributorPrincipalId: demoUserPrincipalId,
          pmStepsBinary: new Uint8Array(),
          yjsUpdateBinary: new Uint8Array(),
        }),
        /provenance_id/,
      );
    });

    // ---------- capability_grant CHECK ----------

    it('capability_grant: global grants must have null resource_id', async () => {
      // valid global grant
      await dbHandle.db.insert(schema.capabilityGrant).values({
        id: newId(),
        principalId: demoUserPrincipalId,
        resourceType: 'global',
        verb: 'document.create',
        grantedBy: servicePrincipalId,
      });

      // invalid: global with resource_id
      await assert.rejects(
        dbHandle.db.insert(schema.capabilityGrant).values({
          id: newId(),
          principalId: demoUserPrincipalId,
          resourceType: 'global',
          resourceId: 'something',
          verb: 'document.create',
          grantedBy: servicePrincipalId,
        }),
        /capability_grant_resource_id_consistency/,
      );

      // invalid: non-global without resource_id
      await assert.rejects(
        dbHandle.db.insert(schema.capabilityGrant).values({
          id: newId(),
          principalId: demoUserPrincipalId,
          resourceType: 'document',
          verb: 'document.read',
          grantedBy: servicePrincipalId,
        }),
        /capability_grant_resource_id_consistency/,
      );
    });

    // ---------- annotation thread + comment chain ----------

    it('annotation_comment requires existing contribution (deferred FK)', async () => {
      const documentId = newId();
      await dbHandle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: demoUserPrincipalId,
        primaryLanguage: 'en',
        slug: `ann-${documentId.replace(/-/g, "").slice(0, 24)}`,
      });

      const threadId = newId();
      const commentId = newId();
      const provenanceId = newId();
      const contributionId = newId();

      await dbHandle.db.transaction(async (tx) => {
        await tx.insert(schema.annotationThread).values({
          id: threadId,
          documentId,
          anchorId: 'anchor-001',
          kind: 'comment',
          status: 'open',
          createdBy: demoUserPrincipalId,
        });
        // Comment references contribution that doesn't exist yet (deferred OK).
        await tx.insert(schema.annotationComment).values({
          id: commentId,
          threadId,
          authorPrincipalId: demoUserPrincipalId,
          bodyMarkdown: '看起来不错 / Looks good.',
          contributionId,
        });
        // Now insert provenance + contribution to close the deferred FK.
        await tx.insert(schema.provenance).values({
          id: provenanceId,
          actorPrincipalId: demoUserPrincipalId,
          actorKind: 'user',
        });
        await tx.insert(schema.contribution).values({
          id: contributionId,
          documentId,
          contributorPrincipalId: demoUserPrincipalId,
          pmStepsBinary: new Uint8Array(),
          yjsUpdateBinary: new Uint8Array(),
          provenanceId,
        });
      });

      const rows = await dbHandle.db
        .select()
        .from(schema.annotationComment)
        .where(eq(schema.annotationComment.id, commentId));
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.bodyMarkdown, '看起来不错 / Looks good.');
    });

    // ---------- document_acl materialized view ----------

    it('document_acl composite primary key + capability_verbs[]', async () => {
      const documentId = newId();
      await dbHandle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: demoUserPrincipalId,
        primaryLanguage: 'en',
        slug: `acl-${documentId.replace(/-/g, "").slice(0, 24)}`,
      });

      const verbs = [
        'document.read',
        'block.read',
        'block.propose',
        'annotation.create',
      ];
      await dbHandle.db.insert(schema.documentAcl).values({
        documentId,
        principalId: demoUserPrincipalId,
        roleId: 'paper-reviewer',
        capabilityVerbs: verbs,
      });

      const rows = await dbHandle.db
        .select()
        .from(schema.documentAcl)
        .where(eq(schema.documentAcl.documentId, documentId));
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0]!.capabilityVerbs, verbs);

      // composite PK rejects duplicate
      await assert.rejects(
        dbHandle.db.insert(schema.documentAcl).values({
          documentId,
          principalId: demoUserPrincipalId,
          roleId: 'paper-author',
          capabilityVerbs: ['document.read'],
        }),
        /document_acl_pkey/i,
      );
    });

    // ---------- prompt_template uniqueness ----------

    it('prompt_template (skill_id, version) is unique', async () => {
      await dbHandle.db.insert(schema.promptTemplate).values({
        id: 'inline-editor@v1',
        skillId: 'inline-editor',
        version: 'v1',
        hash: 'sha256:fixture',
        body: 'fixture body',
      });

      await assert.rejects(
        dbHandle.db.insert(schema.promptTemplate).values({
          id: 'inline-editor@v1-dupe',
          skillId: 'inline-editor',
          version: 'v1',
          hash: 'sha256:other',
          body: 'other',
        }),
        /prompt_template_skill_version_uniq/,
      );
    });

    // ---------- GIN index on contribution.affected_block_ids ----------

    it('contribution affected_block_ids is queryable via @> (GIN-backed)', async () => {
      const documentId = newId();
      await dbHandle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: demoUserPrincipalId,
        primaryLanguage: 'en',
        slug: `gin-${documentId.replace(/-/g, "").slice(0, 24)}`,
      });

      const provenanceId = newId();
      await dbHandle.db.insert(schema.provenance).values({
        id: provenanceId,
        actorPrincipalId: demoUserPrincipalId,
        actorKind: 'user',
      });

      const targetBlockId = `blk-target-${documentId.slice(0, 6)}`;
      const c1 = newId();
      const c2 = newId();
      await dbHandle.db.insert(schema.contribution).values([
        {
          id: c1,
          documentId,
          contributorPrincipalId: demoUserPrincipalId,
          pmStepsBinary: new Uint8Array(),
          yjsUpdateBinary: new Uint8Array(),
          affectedBlockIds: [targetBlockId, 'other-block'],
          provenanceId,
        },
        {
          id: c2,
          documentId,
          contributorPrincipalId: demoUserPrincipalId,
          pmStepsBinary: new Uint8Array(),
          yjsUpdateBinary: new Uint8Array(),
          affectedBlockIds: ['unrelated'],
          provenanceId,
        },
      ]);

      const matches = await dbHandle.client<Array<{ id: string }>>`
        SELECT id FROM contribution WHERE affected_block_ids @> ARRAY[${targetBlockId}]::text[]
      `;
      const matchedIds = matches.map((r) => r.id).sort();
      assert.deepEqual(matchedIds, [c1].sort());
    });

    // ---------- enum boundaries ----------

    it('enum types reject unknown variants', async () => {
      await assert.rejects(
        dbHandle.client.unsafe(`
          INSERT INTO principal (id, kind, display_name, user_id)
          VALUES ('user:bogus', 'admin', 'Bad', 'u-bogus')
        `),
        /invalid input value for enum/i,
      );
    });

    // ---------- timestamp precision ----------

    it('timestamps round-trip with timezone', async () => {
      // We just confirm now() default is set and selectable.
      const before = Date.now();
      const principalsAfter = await dbHandle.db
        .select({ createdAt: schema.principal.createdAt })
        .from(schema.principal)
        .limit(1);
      assert.ok(principalsAfter[0]?.createdAt instanceof Date);
      assert.ok(principalsAfter[0]!.createdAt.getTime() <= before + 1000);
    });

    // raw SQL escape hatch verified
    it('raw sql tag works for ad-hoc queries', async () => {
      const result = await dbHandle.db.execute(rawSql`SELECT 1 AS x`);
      assert.ok(Array.isArray(result));
    });
  });
}
