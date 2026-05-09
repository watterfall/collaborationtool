// Integration test for the public agent helpers. Citation goes through
// the Phase 2 W3 plugin path (`invokeAgentViaPlugin` + plugins/
// citation-agent); inline-editor still goes through hardcoded
// `invokeInlineEditorAgent` (W4-W5 follow-up per ADR-0010 §2.1).
// Both confirm the full runner → persistProposal → PG path
// materialises Provenance + Revision rows.
//
// Skipped without DATABASE_URL.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema, type DbExecutor } from '@collaborationtool/drizzle';
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
  crossrefMockTransport,
  invokeAgentViaPlugin,
  invokeInlineEditorAgent,
  listPendingRevisions,
  rejectRevision,
  supersedeRevisionWithModified,
  type InvokeAgentViaPluginResult,
} from '../src/index';

const DATABASE_URL = process.env['DATABASE_URL'];
const SHOULD_SKIP = !DATABASE_URL;
const SKILLS_ROOT = path.resolve(process.cwd(), '..', '..', 'skills');
const CITATION_PLUGIN_ROOT = path.resolve(
  process.cwd(),
  '..',
  '..',
  'plugins',
  'citation-agent',
);

/** Citation-shaped wrapper around invokeAgentViaPlugin. Tests still
 * read citation-agent semantics; the plugin loader path is exercised
 * uniformly. */
async function invokeCitation(
  input: {
    principalContext: PrincipalContext;
    documentId: string;
    blockId: string;
    passage: string;
    flaggedDoiCandidates: string[];
    skillsRoot?: string;
  },
  options: { db: DbExecutor; persistToDb?: boolean },
): Promise<InvokeAgentViaPluginResult> {
  return invokeAgentViaPlugin(
    {
      pluginPath: CITATION_PLUGIN_ROOT,
      principalContext: input.principalContext,
      documentId: input.documentId,
      blockId: input.blockId,
      passage: input.passage,
      hints: { flaggedDoiCandidates: input.flaggedDoiCandidates },
      skillId: 'citation-lookup',
      skillsRoot: input.skillsRoot,
      mcpSpecs: [
        {
          id: 'crossref-mock',
          buildTransport: crossrefMockTransport().buildTransport,
        },
      ],
    },
    options,
  );
}

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
      const result = await invokeCitation(
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
          invokeCitation(
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
      const invokeResult = await invokeCitation(
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

    // ---------- D14: reject ----------

    it('rejectRevision: status → rejected + approval_chain appended', async () => {
      const invoke = await invokeCitation(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-3',
          passage: 'plain',
          flaggedDoiCandidates: ['10.9999/unknown.2024'],
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );
      const result = await rejectRevision(handle.db, {
        revisionId: invoke.persisted!.revisionId,
        reviewerPrincipalId: userPrincipalId,
        notes: 'wrong reference',
      });
      assert.equal(result.revisionId, invoke.persisted!.revisionId);

      const rev = await handle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, invoke.persisted!.revisionId));
      assert.equal(rev[0]!.status, 'rejected');
      assert.ok(rev[0]!.decidedAt);
      assert.equal(rev[0]!.decidedBy, userPrincipalId);

      const prov = await handle.db
        .select({ approvalChain: schema.provenance.approvalChain })
        .from(schema.provenance)
        .where(eq(schema.provenance.id, invoke.persisted!.provenanceId));
      const chain =
        (prov[0]!.approvalChain as Array<Record<string, unknown>>) ?? [];
      assert.equal(chain.length, 1);
      assert.equal(chain[0]!['decision'], 'reject');
      assert.equal(chain[0]!['notes'], 'wrong reference');
    });

    it('rejectRevision: refuses already-decided revisions', async () => {
      const invoke = await invokeCitation(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-4',
          passage: 'plain',
          flaggedDoiCandidates: [],
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );
      await acceptRevisionToContribution(handle.db, {
        revisionId: invoke.persisted!.revisionId,
        reviewerPrincipalId: userPrincipalId,
      });
      await assert.rejects(
        () =>
          rejectRevision(handle.db, {
            revisionId: invoke.persisted!.revisionId,
            reviewerPrincipalId: userPrincipalId,
          }),
        /already accepted/,
      );
    });

    // ---------- D14: modify (supersede) ----------

    it('supersedeRevisionWithModified: original → superseded + new revision proposed', async () => {
      const invoke = await invokeCitation(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-5',
          passage: 'plain',
          flaggedDoiCandidates: ['10.1145/3531146.3533104'],
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );

      const result = await supersedeRevisionWithModified(handle.db, {
        originalRevisionId: invoke.persisted!.revisionId,
        reviewerPrincipalId: userPrincipalId,
        rationale: 'I will tighten the wording',
        revisedFragments: [
          { originalText: 'See DOI', replacementText: 'cf. DOI' },
        ],
        notes: 'tightened',
      });

      // Original is superseded.
      const orig = await handle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, invoke.persisted!.revisionId));
      assert.equal(orig[0]!.status, 'superseded');
      assert.equal(orig[0]!.decidedBy, userPrincipalId);

      // New revision is proposed by the reviewer (kind='user'),
      // distinct from the original agent.
      const fresh = await handle.db
        .select()
        .from(schema.revision)
        .where(eq(schema.revision.id, result.newRevisionId));
      assert.equal(fresh[0]!.status, 'proposed');
      assert.equal(fresh[0]!.proposedBy, userPrincipalId);
      assert.equal(fresh[0]!.documentId, documentId);
      const meta = fresh[0]!.proposalMetadata as {
        revisedFragments: Array<{ originalText: string; replacementText: string }>;
      };
      assert.equal(meta.revisedFragments[0]!.originalText, 'See DOI');
      assert.equal(meta.revisedFragments[0]!.replacementText, 'cf. DOI');

      // Original provenance.approval_chain has a 'modify' entry
      // pointing at the new revision.
      const origProv = await handle.db
        .select({ approvalChain: schema.provenance.approvalChain })
        .from(schema.provenance)
        .where(eq(schema.provenance.id, invoke.persisted!.provenanceId));
      const origChain =
        (origProv[0]!.approvalChain as Array<Record<string, unknown>>) ?? [];
      assert.equal(origChain.length, 1);
      assert.equal(origChain[0]!['decision'], 'modify');
      assert.equal(
        origChain[0]!['supersededByRevisionId'],
        result.newRevisionId,
      );

      // New provenance is owned by the reviewer (actor_kind='user').
      const newProv = await handle.db
        .select()
        .from(schema.provenance)
        .where(eq(schema.provenance.id, result.newProvenanceId));
      assert.equal(newProv[0]!.actorKind, 'user');
      assert.equal(newProv[0]!.actorPrincipalId, userPrincipalId);
    });

    // ---------- D14: list pending ----------

    it('listPendingRevisions: returns proposed/draft, newest first, ignores accepted/rejected/superseded', async () => {
      // Create one proposed via citation invoke; accept it; create another
      // proposed; ensure list returns only the second.
      const a = await invokeCitation(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-6',
          passage: 'plain',
          flaggedDoiCandidates: [],
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );
      await acceptRevisionToContribution(handle.db, {
        revisionId: a.persisted!.revisionId,
        reviewerPrincipalId: userPrincipalId,
      });

      const b = await invokeCitation(
        {
          principalContext: userCtx,
          documentId,
          blockId: 'blk-7',
          passage: 'plain',
          flaggedDoiCandidates: ['10.1145/3531146.3533104'],
          skillsRoot: SKILLS_ROOT,
        },
        { db: handle.db },
      );

      const list = await listPendingRevisions(handle.db, { documentId });
      const ids = list.map((r) => r.id);
      assert.ok(ids.includes(b.persisted!.revisionId));
      assert.ok(!ids.includes(a.persisted!.revisionId));
      // Each row exposes proposalMetadata.
      const row = list.find((r) => r.id === b.persisted!.revisionId)!;
      assert.ok(row.proposalMetadata);
      assert.ok(Array.isArray(row.proposalMetadata!.revisedFragments));
    });
  });
}
