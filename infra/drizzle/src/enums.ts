// Postgres enum types — kept as a single shared file because some of
// these enums appear in 2+ tables (e.g. principal_kind in principal +
// agent.principal_kind cache).
//
// Adding a value to an existing enum requires `ALTER TYPE ... ADD VALUE`
// in a new migration, NOT editing this file in place — Drizzle Kit will
// detect and emit the proper SQL.

import { pgEnum } from 'drizzle-orm/pg-core';

// ---------- Principal & Agent ----------

// 'org' is added vs ADR-0002 §2.3 to support better-auth `organization`
// plugin bridging — see plan0/phase-1-execution-plan.md §九 Q7.
// Documented as a Phase 1 schema extension; ADR-0002 review log will be
// updated in D16.
export const principalKindEnum = pgEnum('principal_kind', [
  'user',
  'agent',
  'shared-link',
  'service',
  'org',
]);

// Phase 2 W2 ADR-0008: 'reviewer' / 'researcher' added via 0007 migration
// (ALTER TYPE ADD VALUE — already in 0001 enum literal here for new dbs).
export const agentKindEnum = pgEnum('agent_kind', [
  'editor',
  'reviewer',
  'citation',
  'researcher',
  'coordinator',
  'custom',
]);

// Phase 2 W2 ADR-0008: 'long-horizon' added via 0007 migration.
export const agentRuntimeEnum = pgEnum('agent_runtime', [
  'server',
  'client',
  'long-horizon',
]);

// Phase 2 W2 ADR-0008: agent_job lifecycle.
export const agentJobStatusEnum = pgEnum('agent_job_status', [
  'queued',
  'running',
  'done',
  'error',
  'cancelled',
]);

// ---------- Document ----------

export const bilingualModeEnum = pgEnum('bilingual_mode', [
  'mono',
  'parallel',
  'mixed',
]);

// ---------- Citation ----------

export const citationKindEnum = pgEnum('citation_kind', [
  'literature',
  'dataset',
  'software',
  'document',
  'web',
]);

// ---------- Annotation ----------

export const annotationKindEnum = pgEnum('annotation_kind', [
  'comment',
  'suggestion',
  'reviewer-note',
  'agent-flag',
  'task',
]);

export const annotationStatusEnum = pgEnum('annotation_status', [
  'open',
  'resolved',
  'archived',
]);

// ---------- Revision ----------

export const revisionStatusEnum = pgEnum('revision_status', [
  'draft',
  'proposed',
  'accepted',
  'rejected',
  'superseded',
]);

// ---------- Provenance ----------

export const actorKindEnum = pgEnum('actor_kind', [
  'user',
  'agent',
  'service',
  'shared-link',
]);

// ---------- Capability ----------

export const capabilityResourceTypeEnum = pgEnum('capability_resource_type', [
  'document',
  'block',
  'thread',
  'global',
]);

// ---------- MCP server registry (Phase 2 W1 ADR-0006) ----------

export const mcpTransportEnum = pgEnum('mcp_transport', [
  'stdio',
  'http',
  'http-sse',
]);

export const mcpOriginEnum = pgEnum('mcp_origin', ['built-in', 'user', 'team']);

export const mcpHealthStatusEnum = pgEnum('mcp_health_status', [
  'unknown',
  'healthy',
  'degraded',
  'failed',
]);

// ---------- Claim / Evidence knowledge object (Phase 2 W5 ADR-0011) ----------

export const claimTypeEnum = pgEnum('claim_type', ['main', 'counter', 'synthesis']);

export const claimStatusEnum = pgEnum('claim_status', [
  'ai-suggested',
  'human-reviewed',
  'approved',
  'deprecated',
  'superseded',
]);

export const claimConfidenceEnum = pgEnum('claim_confidence', [
  'low',
  'medium',
  'high',
]);

export const evidenceRelationEnum = pgEnum('evidence_relation', [
  'supports',
  'challenges',
  'qualifies',
]);

export const claimLinkTypeEnum = pgEnum('claim_link_type', [
  'derives-from',
  'synthesizes',
  'contradicts',
  'refines',
]);
