// Provenance is the source-chain for every Contribution. Written at
// commit boundary, NOT per keystroke. In-flight state lives in
// Y.Map('provenance:in-flight') and is moved here on commit.

import type {
  AgentId, BlockId, DocumentId, IsoDateTime,
  PrincipalId, ProvenanceId,
} from './_shared';

export type ActorKind = 'user' | 'agent' | 'service' | 'shared-link';

/** Phase 5 Wave A A3 — single retry attempt the runner had to make
 * before producing the final completion. ADR-0008 §2.5 caps the
 * exponential-backoff retries at 3 inside a single tool-call; this
 * record explains *why* each retry happened (rate-limit / 5xx /
 * malformed tool call) so the timeline view can surface it. */
export interface RetryRecord {
  attempt: number;                                  // 1-based
  errorClass: string;                               // 'rate-limit' | '5xx' | 'tool-call-malformed' | ...
  errorMessage?: string;
  delayedMs: number;                                // backoff applied before this retry
  occurredAt: IsoDateTime;
}

export interface AgentExecutionContext {
  agentId: AgentId;
  modelId: string;                                 // 'claude-opus-4-7' / 'claude-sonnet-4-6' / ...
  modelProvider: 'anthropic' | 'openai' | 'local-ollama' | string;
  promptTemplateId: string;                        // skill SKILL.md hash or prompt registry id
  promptHash: string;                              // sha256 of fully-rendered prompt (NOT the prompt itself)
  inputSkillIds: string[];                         // which skills were loaded
  temperature?: number;
  maxTokens?: number;
  // Phase 5 Wave A A3 — execution telemetry consumed by maintenance
  // dashboard + AgentTimeline. All optional so existing mock / Phase 1-4
  // runners (which never measured these) keep round-tripping cleanly;
  // populate from the LLM response.usage block when available.
  /** Number of coordinator-loop iterations actually executed
   * (1 = single-shot; >1 = multi-step plan). */
  actualIterations?: number;
  /** Total input tokens billed for this provenance row. */
  promptTokens?: number;
  /** Total completion tokens billed. */
  completionTokens?: number;
  /** Each retry the runner attempted; empty / undefined when the
   * happy-path succeeded on the first try. */
  retries?: RetryRecord[];
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
