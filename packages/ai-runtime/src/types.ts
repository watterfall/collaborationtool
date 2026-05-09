// Shared types for ai-runtime. All agent invocations produce one of
// these proposals, which the approval flow (D14) materialises into a
// Revision row + Provenance row.

import type {
  AgentExecutionContext,
  ApprovalRecord,
  BlockId,
  CitationId,
  DocumentId,
  IsoDateTime,
  PrincipalId,
  ProvenanceId,
  RevisionId,
  ToolCallRecord,
} from '@collaborationtool/schema';

import type { SkillMeta } from './skills-loader';

// ---------- Inputs ----------

export interface InputPassage {
  documentId: DocumentId;
  blockId: BlockId;
  /** The raw prose the agent will read (subject to `block.read` capability). */
  prose: string;
  /** Optional flagged DOIs for the citation skill — populated by frontend selection UX. */
  flaggedDoiCandidates?: string[];
  /** Phase 1.5: surrounding-block context window. */
  surroundingProse?: string;
}

export interface InvocationContext {
  /** Initiating principal — user or agent. Provenance.actorPrincipalId. */
  actorPrincipalId: PrincipalId;
  /** Document the agent is mutating. */
  documentId: DocumentId;
  /** Block the agent is rewriting (single-block scope in Phase 1). */
  blockId: BlockId;
  /** Optional human-supplied instruction (inline editor only). */
  userInstruction?: string;
}

// ---------- Outputs ----------

/** A proposed text replacement covering one fragment of the input. */
export interface ProposedRevisedFragment {
  originalText: string;
  replacementText: string;
  /** When relevant (citation skill). */
  citationId?: CitationId;
  citationCslJson?: Record<string, unknown>;
}

export interface AgentProposal {
  proposalRationale: string;
  revisedFragments: ProposedRevisedFragment[];
  uncertainties: string[];
  toolCalls: ToolCallRecord[];
  agentContext: AgentExecutionContext;
  /** When the agent started (server clock). */
  startedAt: IsoDateTime;
  /** When the agent emitted the proposal. */
  finishedAt: IsoDateTime;
}

// ---------- Persistence shapes ----------

export interface CommitResult {
  revisionId: RevisionId;
  provenanceId: ProvenanceId;
  approval?: ApprovalRecord;
}

// ---------- Re-exports for ergonomics ----------

export type { SkillMeta };
