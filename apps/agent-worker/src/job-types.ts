// Phase 2 W2 ADR-0008 §2.1: agent_job kind + payload contracts.
//
// pgboss queues jobs by string name; we dispatch on `kind` here. The
// shape of `input` is reviewer- vs researcher-specific. Both ultimately
// call `invokeAgentViaPlugin(...)` from @collaborationtool/ai-runtime
// inside the worker process.

import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

export type AgentJobKind = 'reviewer' | 'researcher';

/** Reviewer agent — reads the entire document, emits a list of
 * proposed revisions + reviewer-note threads. */
export interface ReviewerJobInput {
  kind: 'reviewer';
  documentId: DocumentId;
  triggeringPrincipalId: PrincipalId;
  /** When set, the reviewer focuses on the listed block ids only.
   * Empty array = whole-doc review. */
  focusBlockIds?: string[];
  /** Plugin path for the reviewer agent (Phase 2 W7 will add a
   * registry; for now caller resolves). */
  pluginPath: string;
  /** Skill the reviewer loads. */
  skillId: string;
}

/** Researcher agent — gathers source candidates for a question and
 * proposes them as Citation rows + evidence drafts. */
export interface ResearcherJobInput {
  kind: 'researcher';
  documentId: DocumentId;
  triggeringPrincipalId: PrincipalId;
  query: string;
  /** Optional list of MCP server ids to use (e.g.
   * `['crossref', 'semantic-scholar']`). */
  allowedMcpServerIds: string[];
  pluginPath: string;
  skillId: string;
}

export type AnyJobInput = ReviewerJobInput | ResearcherJobInput;

/** SSE event payloads written to `agent_job_event.payload`. */
export type JobEventPayload =
  | { kind: 'progress'; fraction: number; message: string }
  | { kind: 'partial'; revisionId?: string; threadId?: string; note: string }
  | {
      kind: 'done';
      outputRevisionIds: string[];
      outputThreadIds: string[];
      cost: { inputTokens: number; outputTokens: number; usdMilli: number };
    }
  | { kind: 'error'; errorClass: string; errorMessage: string };

/** Job lifecycle states (mirror of `agent_job_status` PG enum). */
export type AgentJobStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled';
