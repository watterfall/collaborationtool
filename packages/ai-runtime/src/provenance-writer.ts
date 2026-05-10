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
 *
 * Phase 4 W7.4: now a thin wrapper over `persistProposalBatch([input])`.
 * Plugin authors keep using this single-input API; the coordinator
 * dispatch loop uses `persistProposalBatch` directly to amortise
 * transaction overhead across step-boundary flushes.
 */
export async function persistProposal(
  db: DbExecutor,
  input: PersistProposalInput,
): Promise<PersistProposalResult> {
  const [result] = await persistProposalBatch(db, [input]);
  if (!result) {
    // unreachable — batch always returns inputs.length results.
    throw new Error('persistProposal: batch returned empty');
  }
  return result;
}

/**
 * Phase 4 W7.4 ADR-0008 §2 / role-architecture §D6: persist N proposals
 * in a single transaction.
 *
 * Background: each reviewer-agent run produces 10-20 contributions.
 * Wrapping every single proposal in its own transaction (5 SQL each)
 * blows up to 50-100 SQL per reviewer; coordinator-driven dispatch
 * loops compound this to 250+ SQL per goal. We batch:
 *
 *   - prompt_template: dedup by promptTemplateId (multiple proposals
 *     from the same skill collapse to a single INSERT)
 *   - provenance: one INSERT … VALUES (…), (…), … — N rows
 *   - revision: one INSERT … VALUES (…), (…), … — N rows
 *
 * All three statements share one transaction, so partial failure
 * rolls everything back. Result array is aligned 1:1 with `inputs`
 * so callers can correlate revisionId / provenanceId by index.
 */
export async function persistProposalBatch(
  db: DbExecutor,
  inputs: PersistProposalInput[],
): Promise<PersistProposalResult[]> {
  if (inputs.length === 0) return [];

  // Pre-compute ids + row payloads OUTSIDE the tx so each retry
  // (Drizzle may retry on serialisation failure) reuses the same uuids.
  const prepared = inputs.map((input) => {
    const provenanceId = uuidv7() as ProvenanceId;
    const revisionId = uuidv7() as RevisionId;
    return { input, provenanceId, revisionId };
  });

  // Dedup prompt_template rows by id; multiple inputs sharing the same
  // skill (e.g. 5 reviewer proposals from the same prompt) collapse to
  // a single INSERT row.
  const promptTemplateById = new Map<
    string,
    typeof schema.promptTemplate.$inferInsert
  >();
  for (const { input } of prepared) {
    if (promptTemplateById.has(input.skill.promptTemplateId)) continue;
    promptTemplateById.set(input.skill.promptTemplateId, {
      id: input.skill.promptTemplateId,
      skillId: input.skill.skillId,
      version: input.skill.promptHash.slice(0, 12),
      hash: `sha256:${input.skill.promptHash}`,
      body: input.skill.bodyMarkdown,
    });
  }
  const promptTemplateRows = Array.from(promptTemplateById.values());

  const provenanceRows: Array<typeof schema.provenance.$inferInsert> = [];
  const revisionRows: Array<typeof schema.revision.$inferInsert> = [];
  for (const { input, provenanceId, revisionId } of prepared) {
    // Drizzle 0.45 + postgres-js: pass `null` for empty jsonb arrays so
    // postgres-js doesn't mis-serialise `[]` as a Postgres array literal.
    const toolCallsJsonb =
      input.proposal.toolCalls.length > 0
        ? (input.proposal.toolCalls as unknown as Record<string, unknown>[])
        : null;

    provenanceRows.push({
      id: provenanceId,
      actorPrincipalId: input.proposal.agentContext.agentId
        ? (`agent:${input.proposal.agentContext.agentId}` as PrincipalId)
        : ('service:agent-runtime' as PrincipalId),
      actorKind: 'agent',
      agentContext: input.proposal.agentContext as unknown as Record<
        string,
        unknown
      >,
      inputBlockIds: null,
      inputDocumentIds: [input.documentId],
      triggeredAt: new Date(input.proposal.startedAt),
      toolCalls: toolCallsJsonb,
      approvalChain: null,
    });

    revisionRows.push({
      id: revisionId,
      documentId: input.documentId,
      proposedBy: `agent:${input.proposal.agentContext.agentId}` as PrincipalId,
      status: 'proposed',
      pmStepsBinary: input.pmStepsBinary ?? new Uint8Array(),
      yjsUpdateBinary: input.yjsUpdateBinary ?? new Uint8Array(),
      baseStateVector: input.baseStateVector ?? new Uint8Array(),
      rationale: input.rationale ?? input.proposal.proposalRationale,
      // D14 proposalMetadata kept on the revision row so approval UI
      // can render before/after fragments without deserialising PM
      // steps.
      proposalMetadata: {
        revisedFragments: input.proposal.revisedFragments,
        uncertainties: input.proposal.uncertainties,
      } as unknown as Record<string, unknown>,
      provenanceId,
    });
  }

  await runInTransaction(db, async (tx) => {
    // ----- prompt_template (deduped by id) -----
    if (promptTemplateRows.length > 0) {
      await tx
        .insert(schema.promptTemplate)
        .values(promptTemplateRows)
        .onConflictDoNothing({ target: schema.promptTemplate.id });
    }
    // ----- provenance (multi-row INSERT) -----
    await tx.insert(schema.provenance).values(provenanceRows);
    // ----- revision (multi-row INSERT) -----
    await tx.insert(schema.revision).values(revisionRows);
  });

  return prepared.map(({ input, provenanceId, revisionId }) => ({
    revisionId,
    provenanceId,
    promptTemplateId: input.skill.promptTemplateId,
  }));
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

/**
 * Reject a revision. Sets status='rejected' and appends to the
 * provenance.approval_chain so the audit trail shows who declined the
 * proposal.
 */
export interface RejectRevisionInput {
  revisionId: RevisionId;
  reviewerPrincipalId: PrincipalId;
  notes?: string;
}

export interface RejectRevisionResult {
  revisionId: RevisionId;
}

export async function rejectRevision(
  db: DbExecutor,
  input: RejectRevisionInput,
): Promise<RejectRevisionResult> {
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
    if (revision.status === 'accepted' || revision.status === 'rejected') {
      throw new Error(
        `revision ${input.revisionId} already ${revision.status}; cannot reject again`,
      );
    }

    await tx
      .update(schema.revision)
      .set({
        status: 'rejected',
        decidedAt: new Date(),
        decidedBy: input.reviewerPrincipalId,
      })
      .where(eq(schema.revision.id, input.revisionId));

    if (revision.provenanceId) {
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
        decision: 'reject',
        ...(input.notes ? { notes: input.notes } : {}),
      });
      await tx
        .update(schema.provenance)
        .set({ approvalChain: existing })
        .where(eq(schema.provenance.id, revision.provenanceId));
    }

    return { revisionId: input.revisionId };
  });
}

/**
 * Reviewer counter-proposal — supersede the original revision (status =
 * 'superseded') and create a new revision authored by the reviewer with
 * the modified rationale + revisedFragments. Provenance.actor for the
 * new row is the reviewer (kind='user'), not the original agent.
 *
 * Phase 1 simplification: the reviewer doesn't get to edit PM steps
 * directly — they edit the proposal_metadata.revisedFragments.
 * D15 / Phase 2 will let them edit the PM tree.
 */
export interface ModifyRevisionInput {
  originalRevisionId: RevisionId;
  reviewerPrincipalId: PrincipalId;
  /** New rationale text. */
  rationale: string;
  /** New fragments — `revisedFragments[]`. */
  revisedFragments: Array<{
    originalText: string;
    replacementText: string;
  }>;
  notes?: string;
}

export interface ModifyRevisionResult {
  originalRevisionId: RevisionId;
  newRevisionId: RevisionId;
  newProvenanceId: ProvenanceId;
}

export async function supersedeRevisionWithModified(
  db: DbExecutor,
  input: ModifyRevisionInput,
): Promise<ModifyRevisionResult> {
  return await runInTransaction(db, async (tx) => {
    const rev = await tx
      .select()
      .from(schema.revision)
      .where(eq(schema.revision.id, input.originalRevisionId))
      .limit(1);
    if (rev.length === 0) {
      throw new Error(`revision not found: ${input.originalRevisionId}`);
    }
    const original = rev[0]!;
    if (original.status !== 'proposed' && original.status !== 'draft') {
      throw new Error(
        `revision ${input.originalRevisionId} status=${original.status} — cannot supersede`,
      );
    }

    // ----- mark original superseded -----
    await tx
      .update(schema.revision)
      .set({
        status: 'superseded',
        decidedAt: new Date(),
        decidedBy: input.reviewerPrincipalId,
      })
      .where(eq(schema.revision.id, input.originalRevisionId));

    // ----- new provenance row (reviewer is the actor) -----
    const newProvenanceId = uuidv7() as ProvenanceId;
    await tx.insert(schema.provenance).values({
      id: newProvenanceId,
      actorPrincipalId: input.reviewerPrincipalId,
      actorKind: 'user',
      agentContext: null,
      inputBlockIds: null,
      inputDocumentIds: [original.documentId],
      triggeredAt: new Date(),
      toolCalls: null,
      approvalChain: [
        {
          approverPrincipalId: input.reviewerPrincipalId,
          approvedAt: new Date().toISOString(),
          decision: 'modify',
          ...(input.notes ? { notes: input.notes } : {}),
          supersedesRevisionId: input.originalRevisionId,
        },
      ] as unknown as Record<string, unknown>[],
    });

    // ----- new revision row -----
    const newRevisionId = uuidv7() as RevisionId;
    await tx.insert(schema.revision).values({
      id: newRevisionId,
      documentId: original.documentId,
      proposedBy: input.reviewerPrincipalId,
      status: 'proposed',
      // Phase 1: re-use the original PM step bytes — D15 lets the reviewer
      // edit them. The metadata on this row is the modified intent.
      pmStepsBinary: original.pmStepsBinary,
      yjsUpdateBinary: original.yjsUpdateBinary,
      baseStateVector: original.baseStateVector,
      rationale: input.rationale,
      proposalMetadata: {
        revisedFragments: input.revisedFragments,
        uncertainties: [],
      } as unknown as Record<string, unknown>,
      provenanceId: newProvenanceId,
    });

    // Also append the modify decision to the ORIGINAL provenance's chain
    // so audit shows the supersede pointer.
    if (original.provenanceId) {
      const originalProv = await tx
        .select({ approvalChain: schema.provenance.approvalChain })
        .from(schema.provenance)
        .where(eq(schema.provenance.id, original.provenanceId))
        .limit(1);
      const originalChain =
        (originalProv[0]?.approvalChain as Array<Record<string, unknown>>) ?? [];
      originalChain.push({
        approverPrincipalId: input.reviewerPrincipalId,
        approvedAt: new Date().toISOString(),
        decision: 'modify',
        supersededByRevisionId: newRevisionId,
        ...(input.notes ? { notes: input.notes } : {}),
      });
      await tx
        .update(schema.provenance)
        .set({ approvalChain: originalChain })
        .where(eq(schema.provenance.id, original.provenanceId));
    }

    return {
      originalRevisionId: input.originalRevisionId,
      newRevisionId,
      newProvenanceId,
    };
  });
}

/**
 * List the pending (proposed/draft) revisions for a document, newest
 * first. Used by the approval-flow inbox UI.
 */
export interface ListPendingRevisionsInput {
  documentId: string;
  limit?: number;
}

export interface PendingRevisionRow {
  id: string;
  documentId: string;
  proposedBy: string;
  status: 'draft' | 'proposed';
  rationale: string | null;
  proposalMetadata: {
    revisedFragments?: Array<{
      originalText: string;
      replacementText: string;
      citationId?: string;
      citationCslJson?: Record<string, unknown>;
    }>;
    uncertainties?: string[];
  } | null;
  createdAt: Date;
}

export async function listPendingRevisions(
  db: DbExecutor,
  input: ListPendingRevisionsInput,
): Promise<PendingRevisionRow[]> {
  const rows = await db
    .select({
      id: schema.revision.id,
      documentId: schema.revision.documentId,
      proposedBy: schema.revision.proposedBy,
      status: schema.revision.status,
      rationale: schema.revision.rationale,
      proposalMetadata: schema.revision.proposalMetadata,
      createdAt: schema.revision.createdAt,
    })
    .from(schema.revision)
    .where(eq(schema.revision.documentId, input.documentId))
    .orderBy(schema.revision.createdAt)
    .limit(input.limit ?? 50);

  return rows
    .filter((r) => r.status === 'proposed' || r.status === 'draft')
    .reverse() // newest first
    .map((r) => ({
      id: r.id,
      documentId: r.documentId,
      proposedBy: r.proposedBy,
      status: r.status as 'draft' | 'proposed',
      rationale: r.rationale,
      proposalMetadata: r.proposalMetadata as PendingRevisionRow['proposalMetadata'],
      createdAt: r.createdAt,
    }));
}

// ---------- helpers ----------

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
