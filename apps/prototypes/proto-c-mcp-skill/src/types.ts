// Local types for the proto-c demo. These are intentionally narrower than
// the full ADR-0001 entity shapes; the goal is to demonstrate the
// commit-boundary Provenance round-trip without the full Postgres schema.

import type {
  AgentExecutionContext,
  ApprovalRecord,
  BlockId,
  CitationId,
  DocumentId,
  PrincipalId,
  ProvenanceId,
  RevisionId,
  ToolCallRecord,
} from '@collaborationtool/schema';

export interface InputPassage {
  documentId: DocumentId;
  blockId: BlockId;
  prose: string;                    // raw text shown to the agent
  flaggedDoiCandidates: string[];   // DOIs the user wants verified
}

export interface ProposedRevisedFragment {
  originalText: string;
  replacementText: string;
  citationId: CitationId;
  citationCslJson: Record<string, unknown>;
}

export interface AgentProposal {
  proposalRationale: string;
  revisedFragments: ProposedRevisedFragment[];
  uncertainties: string[];
  // populated by runner during execution
  toolCalls: ToolCallRecord[];
  agentContext: AgentExecutionContext;
}

export interface CommitResult {
  revisionId: RevisionId;
  provenanceId: ProvenanceId;
  approval: ApprovalRecord;
  contributionId: string;
  contributorPrincipalId: PrincipalId;
}
