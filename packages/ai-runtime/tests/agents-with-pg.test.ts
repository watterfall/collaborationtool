// Integration test for the public agent helpers (invokeCitationAgent /
// invokeInlineEditorAgent). Goes through the runner → persistProposal →
// PG path so we confirm the full Provenance + Revision row materialises.
//
// Skipped without DATABASE_URL.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '@collaborationtool/drizzle';
import {
  CAPABILITY_SET,
  DEFAULT_ROLE_BUNDLES,
  materialiseRoleBundle,
  type Capability,
  type PrincipalContext,
} from '@collaborationtool/permissions';
import type { PrincipalId } from '@collaborationtool/schema';

import {
  acceptRevisionToContribution,
  invokeCitationAgent,
  invokeInlineEditorAgent,
} from '../src/index';

const DATABASE_URL = process.env['DATABASE_URL'];
const SHOULD_SKIP = !DATABASE_URL;
const SKILLS_ROOT = path.resolve(process.cwd(), '..', '..', 'skills');

if (SHOULD_SKIP) {
  describe('ai-runtime agents (integration)', { skip: true }, () => {
    it('skipped (no DATABASE_URL)', () => {});
  });
} else {
  describe('ai-runtime agents (integration)', () => {
    let handle!: ReturnType<typeof openDatabase>;
    let documentId!: string;
    let userPrincipalId!: PrincipalId;
    let userCtx!: PrincipalContext;

    before(async () => {
      handle = openDatabase({ url: DATABASE_URL });

      // Ensure both seeded agent principals exist (the seed script may
      // not have been run before the test). Idempotent via ON CONFLICT.
      const CITATION_AGENT_ID = '00000000-0000-7000-8000-00000000a001';
      const INLINE_EDITOR_AGENT_ID = '00000000-0000-7000-8000-00000000b001';
      await handle.db
        .insert(schema.principal)
        .values([
          {
            id: `agent:${CITATION_AGENT_ID}`,
            kind: 'agent',
            displayName: 'Citation Lookup Agent',
            agentId: CITATION_AGENT_ID,
          },
          {
            id: `agent:${INLINE_EDITOR_AGENT_ID}`,
            kind: 'agent',
            displayName: 'Inline Editor Agent',
            agentId: INLINE_EDITOR_AGENT_ID,
          },
        ])
        .onConflictDoNothing({ target: schema.principal.id });

      // User principal + document + ACL with paper-author bundle (which
      // includes both agent.invoke verbs).
      userPrincipalId = `user:${uuidv7()}` as PrincipalId;
      const userId = `u-${uuidv7()}`;
      await handle.db.insert(schema.principal).values({
        id: userPrincipalId,
        kind: 'user',
        displayName: 'Agent Test',
        userId,
      });

      documentId = uuidv7();
      await handle.db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: userPrincipalId,
        primaryLanguage: 'zh-Hans',
        slug: `agent-test-${documentId.replace(/-/g, '').slice(0, 24)}`,
      });

      await materialiseRoleBundle(handle.db, {
        documentId,
        principalId: userPrincipalId,
        roleId: 'paper-author',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
      });

      userCtx = {
        principalId: userPrincipalId,
        documentCapabilities: new Set(
          DEFAULT_ROLE_BUNDLES['paper-author'].filter((v): v is Capability =>
            CAPABILITY_SET.has(v as Capability),
          ),
        ),
        globalCapabilities: new Set(),
        expiresAt: null,
      };
    });

    after(async () => {
      await handle.close();
    });

    // ---------- citation agent ----------

    it('invokeCitationAgent: PG provenance + revision rows materialise', async () => {
      const result = await invokeCitationAgent(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-1',
          passage: 'See DOI 10.1145/3531146.3533104 for the foundation models survey.',
          flaggedDoiCandidates: ['10.1145/3531146.3533104'],
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );

      assert.ok(result.persisted);
      assert.match(result.persisted!.revisionId, /[0-9a-f-]{30,}/);

      // Check provenance row
      const provRows = await handle.db
        .select()
        .from(schema.provenance)
        .where(eq(schema.provenance.id, result.persisted!.provenanceId));
      assert.equal(provRows.length, 1);
      const prov = provRows[0]!;
      assert.equal(prov.actorKind, 'agent');
      assert.ok(prov.agentContext);
      assert.equal(
        (prov.agentContext as Record<string, unknown>)['modelId'],
        'mock:no-llm',
      );
      assert.ok(Array.isArray(prov.toolCalls));
      assert.ok((prov.toolCalls as unknown[]).length >= 1);
      assert.deepEqual(prov.inputDocumentIds, [documentId]);

      // Check revision row
      const revRows = await handle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, result.persisted!.revisionId));
      assert.equal(revRows.length, 1);
      assert.equal(revRows[0]!.status, 'proposed');
      assert.equal(revRows[0]!.provenanceId, result.persisted!.provenanceId);

      // Check prompt_template upserted
      const templateRows = await handle.db
        .select()
        .from(schema.promptTemplate)
        .where(eq(schema.promptTemplate.id, result.persisted!.promptTemplateId));
      assert.equal(templateRows.length, 1);
      assert.match(templateRows[0]!.hash, /^sha256:[0-9a-f]{64}$/);
    });

    it('invokeCitationAgent: rejects when capability missing', async () => {
      const noCapCtx: PrincipalContext = {
        principalId: userPrincipalId,
        documentCapabilities: new Set([
          'document.read' as Capability,
          'block.read' as Capability,
        ]),
        globalCapabilities: new Set(),
        expiresAt: null,
      };
      await assert.rejects(
        () =>
          invokeCitationAgent(
            {
              principalContext: noCapCtx,
              documentId,
              blockId: 'blk-1',
              passage: 'plain',
              flaggedDoiCandidates: [],
              skillsRoot: SKILLS_ROOT,
            },
            { db: handle.db, persistToDb: false },
          ),
        /agent\.invoke:citation/,
      );
    });

    // ---------- inline editor agent ----------

    it('invokeInlineEditorAgent: PG provenance + revision rows materialise', async () => {
      const result = await invokeInlineEditorAgent(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-1',
          passage: '我们用 GPT 写论文。',
          userInstruction: 'make this more formal',
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );
      assert.ok(result.persisted);
      const provRows = await handle.db
        .select()
        .from(schema.provenance)
        .where(eq(schema.provenance.id, result.persisted!.provenanceId));
      assert.equal(provRows.length, 1);
      assert.equal(provRows[0]!.actorKind, 'agent');

      const revRows = await handle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, result.persisted!.revisionId));
      assert.equal(revRows.length, 1);
      assert.match(revRows[0]!.rationale ?? '', /Mock inline-editor/);
    });

    // ---------- D14 preview: acceptRevisionToContribution ----------

    it('acceptRevisionToContribution: promotes proposed → accepted with provenance approvalChain', async () => {
      const invokeResult = await invokeCitationAgent(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-2',
          passage: 'plain',
          flaggedDoiCandidates: ['10.1145/3531146.3533104'],
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );
      const accepted = await acceptRevisionToContribution(handle.db, {
        revisionId: invokeResult.persisted!.revisionId,
        reviewerPrincipalId: userPrincipalId,
        notes: 'looks good',
      });
      assert.match(accepted.contributionId, /[0-9a-f-]+/);

      const revAfter = await handle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, invokeResult.persisted!.revisionId));
      assert.equal(revAfter[0]!.status, 'accepted');
      assert.equal(revAfter[0]!.contributionId, accepted.contributionId);

      const contribRows = await handle.db
        .select()
        .from(schema.contribution)
        .where(eq(schema.contribution.id, accepted.contributionId));
      assert.equal(contribRows.length, 1);
      assert.equal(contribRows[0]!.documentId, documentId);

      const provRows = await handle.db
        .select()
        .from(schema.provenance)
        .where(eq(schema.provenance.id, invokeResult.persisted!.provenanceId));
      const chain =
        (provRows[0]!.approvalChain as Array<Record<string, unknown>>) ?? [];
      assert.equal(chain.length, 1);
      assert.equal(chain[0]!['decision'], 'accept');
      assert.equal(chain[0]!['notes'], 'looks good');
    });
  });
}
