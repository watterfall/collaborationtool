// Drizzle schema — single source of truth for the Phase 1 Postgres layout.
//
// Every table maps 1:1 to an entity in `packages/schema` (the TS shape) or
// is an explicit Phase 1 addition documented in
// `plan0/phase-1-execution-plan.md §三 D7`.
//
// Field comments include the [Y]/[Y.in-flight]/[PG]/[Y+PG] bucket from
// ADR-0001 §2.1 where applicable, but only [PG] / [Y+PG] fields actually
// land in this schema — Y-only fields live in the Y.Doc, not Postgres.
//
// Circular FK note: contribution ↔ revision ↔ provenance form a small
// cycle. We use DEFERRABLE INITIALLY DEFERRED on the cycle edges (set in
// migrations/0001_initial.sql) so a single transaction can insert the
// whole bundle in any order.

import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import {
  actorKindEnum,
  agentJobStatusEnum,
  agentKindEnum,
  agentRuntimeEnum,
  annotationKindEnum,
  annotationStatusEnum,
  bilingualModeEnum,
  capabilityResourceTypeEnum,
  citationKindEnum,
  claimConfidenceEnum,
  claimLinkTypeEnum,
  claimStatusEnum,
  claimTypeEnum,
  evidenceRelationEnum,
  extractionKindEnum,
  extractionStatusEnum,
  findingKindEnum,
  findingSeverityEnum,
  findingStatusEnum,
  mcpHealthStatusEnum,
  mcpOriginEnum,
  mcpTransportEnum,
  principalKindEnum,
  revisionStatusEnum,
  sourceKindEnum,
  sourceTrustLevelEnum,
} from './enums';
import { bytea } from './types';

// ============================================================
// 1. principal — authority that holds capabilities (User / Agent /
//    shared-link / service / org). Prefix-encoded id like 'user:<uuid>'
//    so JWT subject parsing avoids a DB join (ADR-0002 §2.3).
// ============================================================

export const principal = pgTable(
  'principal',
  {
    id: text('id').primaryKey(),
    kind: principalKindEnum('kind').notNull(),
    displayName: text('display_name').notNull(),
    // Backreferences to identity tables. Kept nullable + denormalised so
    // that better-auth user / org rows can live in their own schema and
    // we own the bridge.
    userId: text('user_id'),
    agentId: text('agent_id'),
    sharedLinkId: text('shared_link_id'),
    orgId: text('org_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    kindIdx: index('principal_kind_idx').on(t.kind),
    userIdIdx: index('principal_user_id_idx').on(t.userId),
    agentIdIdx: index('principal_agent_id_idx').on(t.agentId),
    orgIdIdx: index('principal_org_id_idx').on(t.orgId),
  }),
);

// ============================================================
// 2. agent — registered AI collaborator. Each agent owns one principal
//    of kind='agent' (foreign key set up after principal table exists).
// ============================================================

export const agent = pgTable(
  'agent',
  {
    id: text('id').primaryKey(),
    ownerPrincipalId: text('owner_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    kind: agentKindEnum('kind').notNull(),
    runtime: agentRuntimeEnum('runtime').notNull().default('server'),
    defaultModelId: text('default_model_id').notNull(),
    defaultSkillIds: text('default_skill_ids').array().notNull().default(sql`'{}'::text[]`),
    allowedMcpServerIds: text('allowed_mcp_server_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    defaultMaxTokens: integer('default_max_tokens').notNull(),
    defaultTimeoutMs: integer('default_timeout_ms').notNull(),
    principalId: text('principal_id')
      .notNull()
      .unique()
      .references(() => principal.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('agent_owner_idx').on(t.ownerPrincipalId),
    kindIdx: index('agent_kind_idx').on(t.kind),
  }),
);

// ============================================================
// 3. document — paper / report / chapter root.
//    body content lives in Y.Doc; this row is metadata + Y.Doc snapshot
//    storage (yjs_doc_binary) for fork base & disaster recovery.
//
// Phase 1 additions (vs ADR-0001 §2.3.1):
//   - forked_from_document_id / forked_from_contribution_id (scenario C
//     走查 in ADR-0002 §3.C identified these as required for fork support)
// ============================================================

export const document = pgTable(
  'document',
  {
    id: text('id').primaryKey(),
    ownerPrincipalId: text('owner_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    primaryLanguage: text('primary_language').notNull(),
    bilingualMode: bilingualModeEnum('bilingual_mode').notNull().default('mono'),
    templateId: text('template_id'),
    title: text('title').notNull().default(''),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    // Phase 1 fork bookkeeping
    forkedFromDocumentId: text('forked_from_document_id'),
    forkedFromContributionId: text('forked_from_contribution_id'),
    // Y.Doc backups
    yjsStateVectorSnapshot: bytea('yjs_state_vector_snapshot'),
    yjsDocBinary: bytea('yjs_doc_binary'),
    lastSnapshotAt: timestamp('last_snapshot_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('document_owner_idx').on(t.ownerPrincipalId),
    slugUniq: uniqueIndex('document_slug_uniq').on(t.slug),
    forkedFromIdx: index('document_forked_from_idx').on(t.forkedFromDocumentId),
  }),
);

// ============================================================
// 4. block_metadata — per-block index for cross-document queries.
//    The block content itself lives in Y.Doc PM tree; this is "where /
//    when did this block first appear". Populated by commit boundary.
// ============================================================

export const blockMetadata = pgTable(
  'block_metadata',
  {
    blockId: text('block_id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    firstSeenContributionId: text('first_seen_contribution_id').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => ({
    documentIdx: index('block_meta_document_idx').on(t.documentId),
    typeIdx: index('block_meta_type_idx').on(t.type),
  }),
);

// ============================================================
// 5. citation — global bibliographic record. Same paper can be cited by
//    many docs. citation-ref atom node attrs.citationId points here.
// ============================================================

export const citation = pgTable(
  'citation',
  {
    id: text('id').primaryKey(),
    kind: citationKindEnum('kind').notNull(),
    cslJson: jsonb('csl_json').notNull(),
    doi: text('doi'),
    url: text('url'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    language: text('language'),
    externalIds: jsonb('external_ids').notNull().default(sql`'{}'::jsonb`),
    createdBy: text('created_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    doiIdx: index('citation_doi_idx').on(t.doi),
    kindIdx: index('citation_kind_idx').on(t.kind),
  }),
);

// ============================================================
// 6. annotation_thread — discussion thread anchored to a region of text.
//    Anchor lives in Y.Doc as a PM mark (CRDT-tracked); this row keeps
//    the persistent thread metadata.
// ============================================================

export const annotationThread = pgTable(
  'annotation_thread',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    anchorId: text('anchor_id').notNull(),
    kind: annotationKindEnum('kind').notNull(),
    status: annotationStatusEnum('status').notNull().default('open'),
    createdBy: text('created_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    resolvedBy: text('resolved_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    documentIdx: index('annotation_thread_document_idx').on(t.documentId),
    anchorIdx: index('annotation_thread_anchor_idx').on(t.anchorId),
    statusIdx: index('annotation_thread_status_idx').on(t.status),
  }),
);

// ============================================================
// 7. annotation_comment — append-only comments inside a thread. Every
//    comment is also a Contribution (mandatory provenance) — see ADR-0001
//    §2.3.4. The contribution_id FK is set up DEFERRABLE so the comment
//    + its contribution can be inserted in any order within a tx.
// ============================================================

export const annotationComment = pgTable(
  'annotation_comment',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id')
      .notNull()
      .references(() => annotationThread.id, { onDelete: 'cascade' }),
    authorPrincipalId: text('author_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    bodyMarkdown: text('body_markdown').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    markedDeletedAt: timestamp('marked_deleted_at', { withTimezone: true }),
    contributionId: text('contribution_id').notNull(),
  },
  (t) => ({
    threadIdx: index('annotation_comment_thread_idx').on(t.threadId),
    createdAtIdx: index('annotation_comment_created_at_idx').on(t.createdAt),
  }),
);

// ============================================================
// 8. revision — proposed change, may be rejected.
// ============================================================

export const revision = pgTable(
  'revision',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    proposedBy: text('proposed_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    status: revisionStatusEnum('status').notNull().default('draft'),
    pmStepsBinary: bytea('pm_steps_binary').notNull(),
    yjsUpdateBinary: bytea('yjs_update_binary').notNull(),
    baseStateVector: bytea('base_state_vector').notNull(),
    rationale: text('rationale'),
    // Phase 1 D14: structured proposal metadata (revisedFragments[],
    // uncertainties[]). Nullable so user-typed (non-agent) revisions
    // don't have to populate it.
    proposalMetadata: jsonb('proposal_metadata'),
    // provenanceId is optional in TS schema (`Revision.provenanceId?`),
    // but Phase 1 makes it NOT NULL when proposedBy is an agent. Enforced
    // by CHECK constraint in 0001_initial.sql.
    provenanceId: text('provenance_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: text('decided_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    contributionId: text('contribution_id'),
  },
  (t) => ({
    documentIdx: index('revision_document_idx').on(t.documentId),
    statusIdx: index('revision_status_idx').on(t.status),
    statusDocumentIdx: index('revision_status_document_idx').on(
      t.documentId,
      t.status,
    ),
    proposedByIdx: index('revision_proposed_by_idx').on(t.proposedBy),
  }),
);

// ============================================================
// 9. contribution — append-only commit unit. provenance_id is mandatory.
//    parent_contribution_id forms the history DAG (ADR-0001 §2.3.6).
// ============================================================

export const contribution = pgTable(
  'contribution',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    parentContributionId: text('parent_contribution_id'),
    fromRevisionId: text('from_revision_id'),
    contributorPrincipalId: text('contributor_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    pmStepsBinary: bytea('pm_steps_binary').notNull(),
    yjsUpdateBinary: bytea('yjs_update_binary').notNull(),
    affectedBlockIds: text('affected_block_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    committedAt: timestamp('committed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    provenanceId: text('provenance_id').notNull(),
  },
  (t) => ({
    documentIdx: index('contribution_document_idx').on(t.documentId),
    contributorIdx: index('contribution_contributor_idx').on(t.contributorPrincipalId),
    // GIN index on affected_block_ids text[] is created in 0001_initial.sql
    // (Drizzle doesn't yet expose `using gin` directly).
  }),
);

// ============================================================
// 10. provenance — source-chain for every Contribution. Required at
//     commit boundary; in-flight state in Y.Map('provenance:in-flight')
//     does NOT land here.
// ============================================================

export const provenance = pgTable(
  'provenance',
  {
    id: text('id').primaryKey(),
    actorPrincipalId: text('actor_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    actorKind: actorKindEnum('actor_kind').notNull(),
    agentContext: jsonb('agent_context'),
    inputBlockIds: text('input_block_ids').array(),
    inputDocumentIds: text('input_document_ids').array(),
    triggeredAt: timestamp('triggered_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    toolCalls: jsonb('tool_calls'),
    approvalChain: jsonb('approval_chain'),
  },
  (t) => ({
    actorIdx: index('provenance_actor_idx').on(t.actorPrincipalId),
    triggeredIdx: index('provenance_triggered_idx').on(t.triggeredAt),
  }),
);

// ============================================================
// 11. capability_grant — verb × resource × principal × expiresAt.
//     Source of truth for ADR-0002 36 capabilities.
// ============================================================

export const capabilityGrant = pgTable(
  'capability_grant',
  {
    id: text('id').primaryKey(),
    principalId: text('principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'cascade' }),
    resourceType: capabilityResourceTypeEnum('resource_type').notNull(),
    resourceId: text('resource_id'),
    verb: text('verb').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    grantedBy: text('granted_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    lookupIdx: index('capability_grant_lookup_idx').on(
      t.principalId,
      t.resourceType,
      t.resourceId,
    ),
    expiresIdx: index('capability_grant_expires_idx').on(t.expiresAt),
    verbIdx: index('capability_grant_verb_idx').on(t.verb),
  }),
);

// ============================================================
// 12. document_acl — Phase 1 materialized view of capability bundles per
//     (principal, document). Avoids full capability_grant scan on every
//     WebSocket frame (ADR-0002 §2.5). Triggers in 0001_initial.sql keep
//     this in sync with capability_grant; reconcile job is Phase 1.5.
// ============================================================

export const documentAcl = pgTable(
  'document_acl',
  {
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    principalId: text('principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    capabilityVerbs: text('capability_verbs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.documentId, t.principalId] }),
    principalIdx: index('document_acl_principal_idx').on(t.principalId),
  }),
);

// ============================================================
// 13. prompt_template — immutable prompt content registry (ADR-0003 §2.5).
//     Provenance.agentContext.promptTemplateId references here.
//     Rows are NEVER mutated — new versions get a new id.
// ============================================================

export const promptTemplate = pgTable(
  'prompt_template',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id').notNull(),
    version: text('version').notNull(),
    hash: text('hash').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    skillIdx: index('prompt_template_skill_idx').on(t.skillId),
    skillVersionUniq: uniqueIndex('prompt_template_skill_version_uniq').on(
      t.skillId,
      t.version,
    ),
  }),
);

// ============================================================
// 14. doc_invitation — Phase 1.5 #1 per-document invitation flow.
//     The owner creates a row scoped to (document, email, role); the
//     invitee accepts by signed-in click, which calls
//     materialiseRoleBundle to write the matching document_acl row.
//     Replaces the SQL-grant workaround in USER_GUIDE.md §1.3.
// ============================================================

export const docInvitation = pgTable(
  'doc_invitation',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    inviterPrincipalId: text('inviter_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    email: text('email').notNull(),
    roleId: text('role_id').notNull(),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedByPrincipalId: text('accepted_by_principal_id').references(
      () => principal.id,
    ),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    documentIdx: index('doc_invitation_document_idx').on(t.documentId, t.status),
    emailIdx: index('doc_invitation_email_idx').on(sql`lower(${t.email})`),
  }),
);

// ============================================================
// 15. mcp_server — Phase 2 W1 ADR-0006 MCP server registry.
//     Source of truth for installed MCP servers (built-in seed +
//     user/team installs). ai-runtime resolves a skill's
//     allowed_mcp_servers ∩ enabled rows = allow set;越权调 MCP
//     抛 McpAccessDenied + 写 provenance.
//     Phase 2 transport='stdio' default; HTTP / http-sse 推 Phase 3.
// ============================================================

export const mcpServer = pgTable(
  'mcp_server',
  {
    id: text('id').primaryKey(),
    version: text('version').notNull(),
    transport: mcpTransportEnum('transport').notNull(),
    command: text('command').array().notNull().default(sql`'{}'::text[]`),
    args: text('args').array().notNull().default(sql`'{}'::text[]`),
    cwd: text('cwd'),
    url: text('url'),
    envVarsRequired: text('env_vars_required')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    declaresTools: text('declares_tools')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    requiredCapabilities: text('required_capabilities')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    origin: mcpOriginEnum('origin').notNull(),
    installedBy: text('installed_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    installedAt: timestamp('installed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    enabled: boolean('enabled').notNull().default(true),
    healthStatus: mcpHealthStatusEnum('health_status')
      .notNull()
      .default('unknown'),
    lastHealthCheckAt: timestamp('last_health_check_at', {
      withTimezone: true,
    }),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  },
  (t) => ({
    originIdx: index('mcp_server_origin_idx').on(t.origin),
    // Partial indexes (enabled-only / health-attention) live in
    // 0005_mcp_server.sql since Drizzle doesn't yet expose the
    // `WHERE` clause via the index builder.
  }),
);

// ============================================================
// 16. claim — Phase 2 W5 ADR-0011 一等知识对象。
//     全局 ID（uuidv7），跨文档可复用；text 是权威，PM body 内
//     paragraph 子树是 denormalised cache。counterpoint / synthesis
//     是 claim_type 子类型，不是独立表。
// ============================================================

export const claim = pgTable(
  'claim',
  {
    id: text('id').primaryKey(),
    text: text('text').notNull(),
    claimType: claimTypeEnum('claim_type').notNull().default('main'),
    status: claimStatusEnum('status').notNull().default('ai-suggested'),
    confidence: claimConfidenceEnum('confidence').notNull().default('medium'),
    documentOriginId: text('document_origin_id').references(() => document.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
    supersededByClaimId: text('superseded_by_claim_id'),
  },
  (t) => ({
    statusIdx: index('claim_status_idx').on(t.status),
    originIdx: index('claim_origin_idx').on(t.documentOriginId),
    typeIdx: index('claim_type_idx').on(t.claimType),
  }),
);

// ============================================================
// 17. evidence — Phase 2 W5 ADR-0011 证据对象。
//     每条 evidence 支持 / 反驳 / 限定一个 claim；citationId 软外键
//     关联资料源。
// ============================================================

export const evidence = pgTable(
  'evidence',
  {
    id: text('id').primaryKey(),
    excerpt: text('excerpt').notNull(),
    supportsClaimId: text('supports_claim_id')
      .notNull()
      .references(() => claim.id, { onDelete: 'cascade' }),
    citationId: text('citation_id').references(() => citation.id, {
      onDelete: 'set null',
    }),
    relation: evidenceRelationEnum('relation').notNull().default('supports'),
    status: claimStatusEnum('status').notNull().default('ai-suggested'),
    documentOriginId: text('document_origin_id').references(() => document.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    claimIdx: index('evidence_claim_idx').on(t.supportsClaimId),
    citationIdx: index('evidence_citation_idx').on(t.citationId),
    relationIdx: index('evidence_relation_idx').on(t.relation),
    originIdx: index('evidence_origin_idx').on(t.documentOriginId),
  }),
);

// ============================================================
// 18. claim_link — Phase 2 W5 ADR-0011 claim ↔ claim 关系。
//     synthesis / 组合论证 / 推导链用得到。
// ============================================================

export const claimLink = pgTable(
  'claim_link',
  {
    id: text('id').primaryKey(),
    fromClaimId: text('from_claim_id')
      .notNull()
      .references(() => claim.id, { onDelete: 'cascade' }),
    toClaimId: text('to_claim_id')
      .notNull()
      .references(() => claim.id, { onDelete: 'cascade' }),
    linkType: claimLinkTypeEnum('link_type').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    fromIdx: index('claim_link_from_idx').on(t.fromClaimId),
    toIdx: index('claim_link_to_idx').on(t.toClaimId),
    typeIdx: index('claim_link_type_idx').on(t.linkType),
  }),
);

// ============================================================
// 19. agent_job — Phase 2 W2 ADR-0008 long-horizon agent runtime.
//     User-visible mirror of pgboss queue state. Worker writes
//     status/progress here; UI reads via /api/agent/job/<id>.
// ============================================================

export const agentJob = pgTable(
  'agent_job',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    triggeringPrincipalId: text('triggering_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    agentPrincipalId: text('agent_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    status: agentJobStatusEnum('status').notNull().default('queued'),
    progressFraction: text('progress_fraction').notNull().default('0'),
    progressMessage: text('progress_message'),
    outputRevisionIds: text('output_revision_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    outputThreadIds: text('output_thread_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    costTokenInput: integer('cost_token_input').notNull().default(0),
    costTokenOutput: integer('cost_token_output').notNull().default(0),
    costUsdMilli: integer('cost_usd_milli').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorClass: text('error_class'),
    errorMessage: text('error_message'),
    inputPayload: jsonb('input_payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    docStatusIdx: index('agent_job_doc_status_idx').on(t.documentId, t.status),
    triggererIdx: index('agent_job_triggerer_idx').on(
      t.triggeringPrincipalId,
      t.createdAt,
    ),
  }),
);

// ============================================================
// 20. agent_job_event — Phase 2 W2 ADR-0008 SSE re-connect cursor.
//     Append-only; worker emits progress/partial/done/error here for
//     /api/agent/job/<id>/stream?cursor=<eventId> to resume.
// ============================================================

export const agentJobEvent = pgTable(
  'agent_job_event',
  {
    // PG bigserial; Drizzle exposes it as a number (within JS safe int).
    // For SSE cursor purposes the client treats it as opaque.
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => agentJob.id, { onDelete: 'cascade' }),
    eventKind: text('event_kind').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    jobIdx: index('agent_job_event_job_idx').on(t.jobId, t.id),
  }),
);

// ============================================================
// 21. source — Phase 3 W1/W2 ingestion (PDF / web / markdown / text /
//     docx / epub / manual). See ADR-0011 §1 (essay §6.1 7 对象之一).
//     PDF.js + readability extract raw_text; AI抽取走 source_extraction.
// ============================================================

export const source = pgTable(
  'source',
  {
    id: text('id').primaryKey(),
    kind: sourceKindEnum('kind').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    bytesHashSha256: text('bytes_hash_sha256'),
    bytesSize: integer('bytes_size'),
    bytesStorageUrl: text('bytes_storage_url'),
    rawText: text('raw_text'),
    language: text('language'),
    trustLevel: sourceTrustLevelEnum('trust_level').notNull().default('unverified'),
    importedBy: text('imported_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    importedAt: timestamp('imported_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    accessedAt: timestamp('accessed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    notesMarkdown: text('notes_markdown'),
    citationId: text('citation_id').references(() => citation.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    kindIdx: index('source_kind_idx').on(t.kind),
    importedByIdx: index('source_imported_by_idx').on(t.importedBy, t.importedAt),
    citationIdx: index('source_citation_idx').on(t.citationId),
    hashIdx: index('source_hash_idx').on(t.bytesHashSha256),
  }),
);

// ============================================================
// 22. source_extraction — Phase 3 W2 AI 抽取 staging。
//     status='ai-suggested' 是 AI 输出；user-accepted / user-modified
//     时 promoted_* 链到 main 表的真对象（claim/evidence/thread）。
//     rejected 留历史方便改 prompt 时回看。
// ============================================================

export const sourceExtraction = pgTable(
  'source_extraction',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => source.id, { onDelete: 'cascade' }),
    kind: extractionKindEnum('kind').notNull(),
    text: text('text').notNull(),
    excerpt: text('excerpt'),
    excerptOffset: integer('excerpt_offset'),
    excerptLength: integer('excerpt_length'),
    status: extractionStatusEnum('status').notNull().default('ai-suggested'),
    promotedClaimId: text('promoted_claim_id').references(() => claim.id, {
      onDelete: 'set null',
    }),
    promotedEvidenceId: text('promoted_evidence_id').references(
      () => evidence.id,
      { onDelete: 'set null' },
    ),
    promotedThreadId: text('promoted_thread_id').references(
      () => annotationThread.id,
      { onDelete: 'set null' },
    ),
    agentPrincipalId: text('agent_principal_id').references(() => principal.id, {
      onDelete: 'set null',
    }),
    extractedAt: timestamp('extracted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: text('decided_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    decisionNote: text('decision_note'),
    aiMetadata: jsonb('ai_metadata'),
  },
  (t) => ({
    sourceIdx: index('source_extraction_source_idx').on(t.sourceId, t.kind),
    statusIdx: index('source_extraction_status_idx').on(t.status),
    promotedClaimIdx: index('source_extraction_promoted_claim_idx').on(
      t.promotedClaimId,
    ),
    promotedEvidenceIdx: index('source_extraction_promoted_evidence_idx').on(
      t.promotedEvidenceId,
    ),
  }),
);

// ============================================================
// 23. maintenance_finding — Phase 3 W4 knowledge-maintenance scan
//     output. Per essay §7.4: scan for unsupported-claim /
//     outdated-source / duplicated-claim / contradicted-conclusion /
//     unverified-ai-block / broken-citation.
//     Job runs in apps/agent-worker via pgboss queue
//     'maintenance-scan'; one job emits many findings.
// ============================================================

export const maintenanceFinding = pgTable(
  'maintenance_finding',
  {
    id: text('id').primaryKey(),
    kind: findingKindEnum('kind').notNull(),
    severity: findingSeverityEnum('severity').notNull().default('medium'),
    status: findingStatusEnum('status').notNull().default('open'),
    jobId: text('job_id').references(() => agentJob.id, {
      onDelete: 'set null',
    }),
    claimId: text('claim_id').references(() => claim.id, { onDelete: 'cascade' }),
    evidenceId: text('evidence_id').references(() => evidence.id, {
      onDelete: 'cascade',
    }),
    sourceId: text('source_id').references(() => source.id, {
      onDelete: 'cascade',
    }),
    citationId: text('citation_id').references(() => citation.id, {
      onDelete: 'cascade',
    }),
    documentId: text('document_id').references(() => document.id, {
      onDelete: 'cascade',
    }),
    vaultPrincipalId: text('vault_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    details: jsonb('details'),
    foundAt: timestamp('found_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    dismissedBy: text('dismissed_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    dismissReason: text('dismiss_reason'),
  },
  (t) => ({
    kindIdx: index('maintenance_finding_kind_idx').on(t.kind),
    jobIdx: index('maintenance_finding_job_idx').on(t.jobId),
  }),
);

// ============================================================
// Type exports — used by application code for fully-typed queries.
// `db.select().from(document)` returns inferred row types.
// ============================================================

export type DbPrincipal = typeof principal.$inferSelect;
export type DbAgent = typeof agent.$inferSelect;
export type DbDocument = typeof document.$inferSelect;
export type DbBlockMetadata = typeof blockMetadata.$inferSelect;
export type DbCitation = typeof citation.$inferSelect;
export type DbAnnotationThread = typeof annotationThread.$inferSelect;
export type DbAnnotationComment = typeof annotationComment.$inferSelect;
export type DbRevision = typeof revision.$inferSelect;
export type DbContribution = typeof contribution.$inferSelect;
export type DbProvenance = typeof provenance.$inferSelect;
export type DbCapabilityGrant = typeof capabilityGrant.$inferSelect;
export type DbDocumentAcl = typeof documentAcl.$inferSelect;
export type DbPromptTemplate = typeof promptTemplate.$inferSelect;
export type DbDocInvitation = typeof docInvitation.$inferSelect;
export type DbMcpServer = typeof mcpServer.$inferSelect;
export type DbClaim = typeof claim.$inferSelect;
export type DbEvidence = typeof evidence.$inferSelect;
export type DbClaimLink = typeof claimLink.$inferSelect;
export type DbAgentJob = typeof agentJob.$inferSelect;
export type DbAgentJobEvent = typeof agentJobEvent.$inferSelect;
export type DbSource = typeof source.$inferSelect;
export type DbSourceExtraction = typeof sourceExtraction.$inferSelect;
export type DbMaintenanceFinding = typeof maintenanceFinding.$inferSelect;
