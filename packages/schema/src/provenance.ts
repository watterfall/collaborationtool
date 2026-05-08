// Provenance is the source-chain for every Contribution. Written at
// commit boundary, NOT per keystroke. In-flight state lives in
// Y.Map('provenance:in-flight') and is moved here on commit.

import type {
  AgentId, BlockId, DocumentId, IsoDateTime,
  PrincipalId, ProvenanceId,
} from './_shared';

export type ActorKind = 'user' | 'agent' | 'service' | 'shared-link';

export interface AgentExecutionContext {
  agentId: AgentId;
  modelId: string;                                 // 'claude-opus-4-7' / 'claude-sonnet-4-6' / ...
  modelProvider: 'anthropic' | 'openai' | 'local-ollama' | string;
  promptTemplateId: string;                        // skill SKILL.md hash or prompt registry id
  promptHash: string;                              // sha256 of fully-rendered prompt (NOT the prompt itself)
  inputSkillIds: string[];                         // which skills were loaded
  temperature?: number;
  maxTokens?: number;
}

export interface ToolCallRecord {
  toolName: string;                                // 'crossref.lookup_doi' / 'zotero.search' / ...
  mcpServerId: string;
  argumentsHash: string;                           // sha256
  resultSummary?: string;                          // brief; full result not stored
  succeeded: boolean;
  durationMs: number;
}

export interface ApprovalRecord {
  approverPrincipalId: PrincipalId;
  approvedAt: IsoDateTime;
  decision: 'accept' | 'reject' | 'modify';
  notes?: string;
}

export interface Provenance {
  id: ProvenanceId;                                // [PG]
  actorPrincipalId: PrincipalId;                   // [PG]
  actorKind: ActorKind;                            // [PG] cached for query
  agentContext?: AgentExecutionContext;            // [PG] JSONB; required when actorKind='agent'
  inputBlockIds?: BlockId[];                       // [PG] which blocks were the agent's source
  inputDocumentIds?: DocumentId[];                 // [PG] cross-doc context
  triggeredAt: IsoDateTime;                        // [PG]
  toolCalls?: ToolCallRecord[];                    // [PG] JSONB array
  approvalChain?: ApprovalRecord[];                // [PG] who reviewed/approved
}
