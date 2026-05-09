// Provenance writer — turns an AgentProposal into PG rows:
//   1. ensure prompt_template row exists (by promptTemplateId)
//   2. insert provenance row (actor + tool calls + agentContext)
//   3. insert revision row (status='proposed', provenanceId set)
//
// All three writes happen inside a single transaction so callers either
// see all of them or none. The Revision's PM steps + Yjs binary are
// computed by D14 approval flow; Phase 1 D13 leaves them as empty
// Uint8Arrays — the proposal is at the rationale + revisedFragments
// level, not yet a Y.Doc step. D14 wraps `acceptRevision` to materialise
// PM steps from the user's apply action.

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { schema, type DbExecutor } from '@collaborationtool/drizzle';
import type {
  ContributionId,
  PrincipalId,
  ProvenanceId,
  RevisionId,
} from '@collaborationtool/schema';

import type { AgentProposal } from './types';
import type { SkillMeta } from './skills-loader';

export interface PersistProposalInput {
  proposal: AgentProposal;
  /** The skill body to store in prompt_template (immutable). */
  skill: SkillMeta;
  /** Document the proposal targets. */
  documentId: string;
  /** Phase 1 D13: empty Uint8Array placeholders; D14 fills these from PM. */
  pmStepsBinary?: Uint8Array;
  yjsUpdateBinary?: Uint8Array;
  baseStateVector?: Uint8Array;
  /** Optional rationale override. Defaults to proposal.proposalRationale. */
  rationale?: string;
}

export interface PersistProposalResult {
  revisionId: RevisionId;
  provenanceId: ProvenanceId;
  promptTemplateId: string;
}

/**
 * Persist a proposal into PG. Idempotent on prompt_template
 * (skill_id, version) — re-running with the same skill body inserts
 * once. Always creates a new revision + provenance row.
 *
 * Wraps everything in a tx so we don't get half-written agent runs.
 */
export async function persistProposal(
  db: DbExecutor,
  input: PersistProposalInput,
): Promise<PersistProposalResult> {
  return await runInTransaction(db, async (tx) => {
    // ----- prompt_template -----
    await ensurePromptTemplate(tx, input.skill);

    // ----- provenance -----
    const provenanceId = uuidv7() as ProvenanceId;
    // Drizzle 0.45 + postgres-js: pass `null` for empty jsonb arrays so
    // postgres-js doesn't mis-serialise `[]` as a Postgres array literal.
    // Phase 1.5: switch to `sql\`${...}::jsonb\`` if Drizzle / postgres-js
    // fix the upstream coercion.
    const toolCallsJsonb =
      input.proposal.toolCalls.length > 0
        ? (input.proposal.toolCalls as unknown as Record<string, unknown>[])
        : null;

    await tx.insert(schema.provenance).values({
      id: provenanceId,
      actorPrincipalId: input.proposal.agentContext.agentId
        ? `agent:${input.proposal.agentContext.agentId}` as PrincipalId
        : ('service:agent-runtime' as PrincipalId),
      actorKind: 'agent',
      agentContext: input.proposal.agentContext as unknown as Record<string, unknown>,
      inputBlockIds: null,
      inputDocumentIds: [input.documentId],
      triggeredAt: new Date(input.proposal.startedAt),
      toolCalls: toolCallsJsonb,
      approvalChain: null,
    });

    // ----- revision -----
    const revisionId = uuidv7() as RevisionId;
    await tx.insert(schema.revision).values({
      id: revisionId,
      documentId: input.documentId,
      proposedBy: `agent:${input.proposal.agentContext.agentId}` as PrincipalId,
      status: 'proposed',
      pmStepsBinary: input.pmStepsBinary ?? new Uint8Array(),
      yjsUpdateBinary: input.yjsUpdateBinary ?? new Uint8Array(),
      baseStateVector: input.baseStateVector ?? new Uint8Array(),
      rationale: input.rationale ?? input.proposal.proposalRationale,
      provenanceId,
    });

    return {
      revisionId,
      provenanceId,
      promptTemplateId: input.skill.promptTemplateId,
    };
  });
}

/**
 * D14 approval flow helper — promote a 'proposed' revision to a
 * Contribution (status='accepted'). Materialises a contribution row
 * + cascades the existing provenance.approvalChain.
 */
export interface AcceptRevisionInput {
  revisionId: RevisionId;
  reviewerPrincipalId: PrincipalId;
  /** Optional approval notes. */
  notes?: string;
}

export interface AcceptRevisionResult {
  contributionId: ContributionId;
}

export async function acceptRevisionToContribution(
  db: DbExecutor,
  input: AcceptRevisionInput,
): Promise<AcceptRevisionResult> {
  return await runInTransaction(db, async (tx) => {
    const rev = await tx
      .select()
      .from(schema.revision)
      .where(eq(schema.revision.id, input.revisionId))
      .limit(1);
    if (rev.length === 0) {
      throw new Error(`revision not found: ${input.revisionId}`);
    }
    const revision = rev[0]!;
    if (!revision.provenanceId) {
      throw new Error(`revision ${input.revisionId} has no provenance — cannot accept`);
    }

    const contributionId = uuidv7() as ContributionId;

    await tx.insert(schema.contribution).values({
      id: contributionId,
      documentId: revision.documentId,
      fromRevisionId: revision.id,
      contributorPrincipalId: revision.proposedBy,
      pmStepsBinary: revision.pmStepsBinary,
      yjsUpdateBinary: revision.yjsUpdateBinary,
      affectedBlockIds: [],
      provenanceId: revision.provenanceId,
    });

    await tx
      .update(schema.revision)
      .set({
        status: 'accepted',
        decidedAt: new Date(),
        decidedBy: input.reviewerPrincipalId,
        contributionId,
      })
      .where(eq(schema.revision.id, input.revisionId));

    // Append to provenance.approval_chain.
    const provRows = await tx
      .select({ approvalChain: schema.provenance.approvalChain })
      .from(schema.provenance)
      .where(eq(schema.provenance.id, revision.provenanceId))
      .limit(1);
    const existing =
      (provRows[0]?.approvalChain as Array<Record<string, unknown>>) ?? [];
    existing.push({
      approverPrincipalId: input.reviewerPrincipalId,
      approvedAt: new Date().toISOString(),
      decision: 'accept',
      ...(input.notes ? { notes: input.notes } : {}),
    });
    await tx
      .update(schema.provenance)
      .set({ approvalChain: existing })
      .where(eq(schema.provenance.id, revision.provenanceId));

    return { contributionId };
  });
}

// ---------- helpers ----------

async function ensurePromptTemplate(
  tx: DbExecutor,
  skill: SkillMeta,
): Promise<void> {
  await tx
    .insert(schema.promptTemplate)
    .values({
      id: skill.promptTemplateId,
      skillId: skill.skillId,
      version: skill.promptHash.slice(0, 12),
      hash: `sha256:${skill.promptHash}`,
      body: skill.bodyMarkdown,
    })
    .onConflictDoNothing({ target: schema.promptTemplate.id });
}

/**
 * Drizzle's `db.transaction` accepts a callback typed against the
 * top-level Database. We wrap so call sites can pass either a Database
 * or an existing PgTransaction (composability with D9 web routes).
 */
async function runInTransaction<T>(
  db: DbExecutor,
  fn: (tx: DbExecutor) => Promise<T>,
): Promise<T> {
  // The `transaction` method exists on PgDatabase + PgTransaction; on
  // the latter, calling .transaction creates a SAVEPOINT.
  // Cast through unknown because TS narrows DbExecutor's transaction
  // signature differently for the two cases.
  const txFn = (
    db as unknown as {
      transaction: <R>(cb: (tx: DbExecutor) => Promise<R>) => Promise<R>;
    }
  ).transaction;
  return (await txFn.call(db, fn)) as T;
}
