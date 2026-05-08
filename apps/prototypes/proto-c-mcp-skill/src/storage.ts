// SQLite-backed storage for Provenance, Revision, Contribution rows.
// Schema is intentionally close to what Phase 1 Postgres + Drizzle ORM
// would generate, so the migration is straightforward (TEXT → TEXT/JSONB,
// INTEGER → BIGINT, BLOB → BYTEA).

import Database from 'better-sqlite3';
import { v7 as uuidv7 } from 'uuid';
import type {
  AgentExecutionContext,
  ApprovalRecord,
  BlockId,
  ContributionId,
  DocumentId,
  PrincipalId,
  Provenance,
  ProvenanceId,
  Revision,
  RevisionId,
  RevisionStatus,
  ToolCallRecord,
} from '@collaborationtool/schema';

export interface Storage {
  insertRevision(input: NewRevisionInput): RevisionId;
  insertProvenance(input: NewProvenanceInput): ProvenanceId;
  acceptRevisionToContribution(input: AcceptInput): { contributionId: ContributionId };
  loadProvenance(id: ProvenanceId): Provenance | null;
  loadRevision(id: RevisionId): Revision | null;
  loadContribution(id: ContributionId): { row: Record<string, unknown> } | null;
  close(): void;
}

export interface NewRevisionInput {
  documentId: DocumentId;
  proposedBy: PrincipalId;
  pmStepsBinary: Uint8Array;
  yjsUpdateBinary: Uint8Array;
  baseStateVector: Uint8Array;
  rationale?: string;
  provenanceId?: ProvenanceId;
}

export interface NewProvenanceInput {
  actorPrincipalId: PrincipalId;
  actorKind: 'user' | 'agent' | 'service' | 'shared-link';
  agentContext?: AgentExecutionContext;
  inputBlockIds?: BlockId[];
  inputDocumentIds?: DocumentId[];
  toolCalls?: ToolCallRecord[];
  approvalChain?: ApprovalRecord[];
}

export interface AcceptInput {
  revisionId: RevisionId;
  reviewerPrincipalId: PrincipalId;
  approvalNotes?: string;
}

export function openStorage(filePath: string): Storage {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_DDL);

  const insertRev = db.prepare(`
    INSERT INTO revision (
      id, document_id, proposed_by, status,
      pm_steps_binary, yjs_update_binary, base_state_vector,
      rationale, provenance_id, created_at
    ) VALUES (
      @id, @documentId, @proposedBy, @status,
      @pmStepsBinary, @yjsUpdateBinary, @baseStateVector,
      @rationale, @provenanceId, @createdAt
    )
  `);
  const insertProv = db.prepare(`
    INSERT INTO provenance (
      id, actor_principal_id, actor_kind, agent_context_json,
      input_block_ids_json, input_document_ids_json,
      triggered_at, tool_calls_json, approval_chain_json
    ) VALUES (
      @id, @actorPrincipalId, @actorKind, @agentContextJson,
      @inputBlockIdsJson, @inputDocumentIdsJson,
      @triggeredAt, @toolCallsJson, @approvalChainJson
    )
  `);
  const insertContrib = db.prepare(`
    INSERT INTO contribution (
      id, document_id, parent_contribution_id, from_revision_id,
      contributor_principal_id, pm_steps_binary, yjs_update_binary,
      affected_block_ids_json, committed_at, provenance_id
    ) VALUES (
      @id, @documentId, @parentContributionId, @fromRevisionId,
      @contributorPrincipalId, @pmStepsBinary, @yjsUpdateBinary,
      @affectedBlockIdsJson, @committedAt, @provenanceId
    )
  `);
  const updateRev = db.prepare(`
    UPDATE revision
    SET status = @status, decided_at = @decidedAt, decided_by = @decidedBy,
        contribution_id = @contributionId
    WHERE id = @id
  `);
  const selectRev = db.prepare(`SELECT * FROM revision WHERE id = ?`);
  const selectProv = db.prepare(`SELECT * FROM provenance WHERE id = ?`);
  const selectContrib = db.prepare(`SELECT * FROM contribution WHERE id = ?`);

  return {
    insertRevision(input) {
      const id = uuidv7();
      const now = new Date().toISOString();
      const status: RevisionStatus = 'proposed';
      insertRev.run({
        id,
        documentId: input.documentId,
        proposedBy: input.proposedBy,
        status,
        pmStepsBinary: Buffer.from(input.pmStepsBinary),
        yjsUpdateBinary: Buffer.from(input.yjsUpdateBinary),
        baseStateVector: Buffer.from(input.baseStateVector),
        rationale: input.rationale ?? null,
        provenanceId: input.provenanceId ?? null,
        createdAt: now,
      });
      return id;
    },

    insertProvenance(input) {
      const id = uuidv7();
      const now = new Date().toISOString();
      insertProv.run({
        id,
        actorPrincipalId: input.actorPrincipalId,
        actorKind: input.actorKind,
        agentContextJson: input.agentContext ? JSON.stringify(input.agentContext) : null,
        inputBlockIdsJson: input.inputBlockIds ? JSON.stringify(input.inputBlockIds) : null,
        inputDocumentIdsJson: input.inputDocumentIds ? JSON.stringify(input.inputDocumentIds) : null,
        triggeredAt: now,
        toolCallsJson: input.toolCalls ? JSON.stringify(input.toolCalls) : null,
        approvalChainJson: input.approvalChain ? JSON.stringify(input.approvalChain) : null,
      });
      return id;
    },

    acceptRevisionToContribution(input) {
      const rev = selectRev.get(input.revisionId) as Record<string, unknown> | undefined;
      if (!rev) throw new Error(`Unknown revision ${input.revisionId}`);
      const contributionId = uuidv7();
      const now = new Date().toISOString();
      const pmStepsBinary = rev['pm_steps_binary'] as Buffer;
      const yjsUpdateBinary = rev['yjs_update_binary'] as Buffer;

      insertContrib.run({
        id: contributionId,
        documentId: rev['document_id'] as string,
        parentContributionId: null,
        fromRevisionId: rev['id'] as string,
        contributorPrincipalId: rev['proposed_by'] as string,
        pmStepsBinary,
        yjsUpdateBinary,
        affectedBlockIdsJson: JSON.stringify([]),
        committedAt: now,
        provenanceId: rev['provenance_id'] as string,
      });

      updateRev.run({
        id: input.revisionId,
        status: 'accepted',
        decidedAt: now,
        decidedBy: input.reviewerPrincipalId,
        contributionId,
      });

      return { contributionId };
    },

    loadProvenance(id) {
      const row = selectProv.get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      const out: Provenance = {
        id: row['id'] as string,
        actorPrincipalId: row['actor_principal_id'] as string,
        actorKind: row['actor_kind'] as 'user' | 'agent' | 'service' | 'shared-link',
        agentContext: row['agent_context_json']
          ? (JSON.parse(row['agent_context_json'] as string) as AgentExecutionContext)
          : undefined,
        inputBlockIds: row['input_block_ids_json']
          ? (JSON.parse(row['input_block_ids_json'] as string) as string[])
          : undefined,
        inputDocumentIds: row['input_document_ids_json']
          ? (JSON.parse(row['input_document_ids_json'] as string) as string[])
          : undefined,
        triggeredAt: row['triggered_at'] as string,
        toolCalls: row['tool_calls_json']
          ? (JSON.parse(row['tool_calls_json'] as string) as ToolCallRecord[])
          : undefined,
        approvalChain: row['approval_chain_json']
          ? (JSON.parse(row['approval_chain_json'] as string) as ApprovalRecord[])
          : undefined,
      };
      return out;
    },

    loadRevision(id) {
      const row = selectRev.get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: row['id'] as string,
        documentId: row['document_id'] as string,
        proposedBy: row['proposed_by'] as string,
        status: row['status'] as RevisionStatus,
        pmStepsBinary: new Uint8Array(row['pm_steps_binary'] as Buffer),
        yjsUpdateBinary: new Uint8Array(row['yjs_update_binary'] as Buffer),
        baseStateVector: new Uint8Array(row['base_state_vector'] as Buffer),
        rationale: (row['rationale'] as string) ?? undefined,
        provenanceId: (row['provenance_id'] as string) ?? undefined,
        createdAt: row['created_at'] as string,
        decidedAt: (row['decided_at'] as string) ?? undefined,
        decidedBy: (row['decided_by'] as string) ?? undefined,
        contributionId: (row['contribution_id'] as string) ?? undefined,
      };
    },

    loadContribution(id) {
      const row = selectContrib.get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      return { row };
    },

    close() {
      db.close();
    },
  };
}

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS revision (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  status TEXT NOT NULL,
  pm_steps_binary BLOB NOT NULL,
  yjs_update_binary BLOB NOT NULL,
  base_state_vector BLOB NOT NULL,
  rationale TEXT,
  provenance_id TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  contribution_id TEXT
);

CREATE TABLE IF NOT EXISTS provenance (
  id TEXT PRIMARY KEY,
  actor_principal_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  agent_context_json TEXT,
  input_block_ids_json TEXT,
  input_document_ids_json TEXT,
  triggered_at TEXT NOT NULL,
  tool_calls_json TEXT,
  approval_chain_json TEXT
);

CREATE TABLE IF NOT EXISTS contribution (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  parent_contribution_id TEXT,
  from_revision_id TEXT,
  contributor_principal_id TEXT NOT NULL,
  pm_steps_binary BLOB NOT NULL,
  yjs_update_binary BLOB NOT NULL,
  affected_block_ids_json TEXT NOT NULL,
  committed_at TEXT NOT NULL,
  provenance_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_document ON revision(document_id);
CREATE INDEX IF NOT EXISTS idx_provenance_actor ON provenance(actor_principal_id);
CREATE INDEX IF NOT EXISTS idx_contribution_document ON contribution(document_id);
`;
