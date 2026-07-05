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
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
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
  claimReviewVerdictEnum,
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
  modelProviderWireFormatEnum,
  openPeerReviewTargetKindEnum,
  pluginInstallOriginEnum,
  pluginInstallStatusEnum,
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
    // ADR-0018 open-content signing. Text shape is `ed25519:<64 hex>`.
    // Nullable so existing principals and non-user principals can migrate.
    ed25519PublicKey: text('ed25519_public_key'),
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
    ed25519PublicKeyUniq: uniqueIndex('principal_ed25519_public_key_uniq').on(
      t.ed25519PublicKey,
    ),
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
    // Phase 5 Wave A A1 (migration 0013): per-agent quota cap. Backs
    // ADR-0008 §122 promise. quota-enforcer.ts counts invocations in
    // the rolling 24h window and rejects new triggers above this.
    quotaPerDay: integer('quota_per_day').notNull().default(50),
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
    // Phase 4 W5 ADR-0014: which subdocument this block belongs to.
    // null = root scope (preamble or pre-split docs).
    subdocumentId: text('subdocument_id'),
  },
  (t) => ({
    documentIdx: index('block_meta_document_idx').on(t.documentId),
    typeIdx: index('block_meta_type_idx').on(t.type),
    subdocumentIdx: index('block_metadata_subdocument_idx').on(t.subdocumentId),
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
    // Phase 4 W5 ADR-0014: surrogate id PK to allow per-(doc, principal,
    // subdoc) row. Migration 0011 backfills `acl:<docId>:<principalId>`
    // for pre-existing rows.
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    principalId: text('principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'cascade' }),
    // Phase 4 W5: subdocument-level grant; null = root scope (covers
    // all subdocs by default; subdoc-specific rows override).
    subdocumentId: text('subdocument_id'),
    roleId: text('role_id').notNull(),
    capabilityVerbs: text('capability_verbs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    principalIdx: index('document_acl_principal_idx').on(t.principalId),
    subdocumentIdx: index('document_acl_subdocument_idx').on(t.subdocumentId),
    docPrincipalSubdocUniq: uniqueIndex(
      'document_acl_doc_principal_subdoc_uniq',
    ).on(t.documentId, t.principalId, t.subdocumentId),
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
    // Phase 3 W6 closeout: coordinator handoff parent linkage.
    // null for top-level jobs; set when a coordinator dispatches an
    // async handoff sub-job. ON DELETE SET NULL (parent gone, child
    // becomes orphan but keeps its history).
    parentJobId: text('parent_job_id'),
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
    parentIdx: index('agent_job_parent_idx').on(t.parentJobId),
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
// 24. user_model_pref — Phase 3 W7 ADR-0013 BYO model.
//     Per-principal default ModelProvider + modelId. The host reads
//     this when invokeAgentViaPlugin is called and the calling agent
//     has no document-level override.
//
//     Secrets policy: api_key_env_var stores the env-var NAME (e.g.
//     'ANTHROPIC_API_KEY'); the secret value lives in the host process
//     environment and is never persisted to PG. ADR-0013 §2.6.
// ============================================================

export const userModelPref = pgTable(
  'user_model_pref',
  {
    id: text('id').primaryKey(),
    principalId: text('principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'cascade' }),
    prefKind: text('pref_kind').notNull().default('default'),
    providerId: text('provider_id').notNull(),
    wireFormat: modelProviderWireFormatEnum('wire_format').notNull(),
    modelId: text('model_id').notNull(),
    endpointUrl: text('endpoint_url'),
    apiKeyEnvVar: text('api_key_env_var'),
    extraHeaders: jsonb('extra_headers'),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    principalIdx: index('user_model_pref_principal_idx').on(t.principalId),
    uniqDefault: uniqueIndex('user_model_pref_unique_default').on(
      t.principalId,
      t.prefKind,
    ),
  }),
);

// ============================================================
// 25. document_model_override — Phase 3 W7 ADR-0013.
//     Document owner pins a specific provider/model for all agent
//     invocations on that document (e.g. sensitive doc forced to
//     on-prem Ollama). Lookup precedence: document_model_override →
//     user_model_pref → ENV default.
// ============================================================

export const documentModelOverride = pgTable('document_model_override', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .unique()
    .references(() => document.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  wireFormat: modelProviderWireFormatEnum('wire_format').notNull(),
  modelId: text('model_id').notNull(),
  endpointUrl: text('endpoint_url'),
  apiKeyEnvVar: text('api_key_env_var'),
  extraHeaders: jsonb('extra_headers'),
  setByPrincipalId: text('set_by_principal_id')
    .notNull()
    .references(() => principal.id, { onDelete: 'restrict' }),
  setAt: timestamp('set_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  reason: text('reason'),
});

// ============================================================
// 26. plugin_install — Phase 3 W5 ADR-0012 user-installed plugins.
//     Built-in plugins continue to live in plugins/registry.json
//     (no DB row). User-installed plugins have a row here, plus a
//     sandbox descriptor + accepted-capabilities snapshot at install.
//
//     accepted_capabilities is the manifest required_capabilities[]
//     subset the user explicitly approved in the capability prompt UI.
// ============================================================

export const pluginInstall = pgTable(
  'plugin_install',
  {
    id: text('id').primaryKey(),
    pluginManifestId: text('plugin_manifest_id').notNull(),
    pluginKind: text('plugin_kind').notNull(),
    version: text('version').notNull(),
    origin: pluginInstallOriginEnum('origin').notNull(),
    sourceUrl: text('source_url'),
    installedBy: text('installed_by')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    installedAt: timestamp('installed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    status: pluginInstallStatusEnum('status').notNull().default('enabled'),
    acceptedCapabilities: jsonb('accepted_capabilities').notNull(),
    installPath: text('install_path').notNull(),
    sandboxDescriptor: jsonb('sandbox_descriptor'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    bundleHashSha256: text('bundle_hash_sha256'),
  },
  (t) => ({
    principalIdx: index('plugin_install_principal_idx').on(
      t.installedBy,
      t.status,
    ),
    kindIdx: index('plugin_install_kind_idx').on(t.pluginKind),
  }),
);

// ============================================================
// 27. subdocument — Phase 4 W5 ADR-0014.
//     Root-document 子单元；每 heading-1 章节默认一条。每 subdoc 在
//     y-sweet 端是独立 doc（ysweet_doc_name 全局 unique）。
//     Y.Doc 是 source of truth；本表作 metadata + 排序。
// ============================================================

export const subdocument = pgTable(
  'subdocument',
  {
    id: text('id').primaryKey(),
    rootDocumentId: text('root_document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    // 嵌套支持（ADR-0014 §3.3 long debt：Phase 5+ 才实施 subdoc-of-subdoc）
    parentSubdocumentId: text('parent_subdocument_id'),
    title: text('title').notNull(),
    ord: integer('ord').notNull(),
    ysweetDocName: text('ysweet_doc_name').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    rootIdx: index('subdocument_root_idx').on(t.rootDocumentId, t.ord),
  }),
);

// ============================================================
// 28. crossref_index — Phase 4 W5 ADR-0014.
//     root crossRefs Y.Map 的 PG 镜像。Y.Map 是权威；PG 行作 dump /
//     search / maintenance scan 索引。subdoc transaction 落 + snapshot-
//     worker 增量同步本表。
// ============================================================

export const crossrefIndex = pgTable(
  'crossref_index',
  {
    id: text('id').primaryKey(),
    rootDocumentId: text('root_document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    // 'figure' | 'citation' | 'claim' | 'evidence'（不用 enum：Phase 5
    // 加 'dataset' / 'computational-output' 时不必 ALTER TYPE）
    refKind: text('ref_kind').notNull(),
    refTargetId: text('ref_target_id').notNull(),
    sourceSubdocumentId: text('source_subdocument_id').references(
      () => subdocument.id,
      { onDelete: 'cascade' },
    ),
    sourceBlockId: text('source_block_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    rootKindIdx: index('crossref_index_root_kind_idx').on(
      t.rootDocumentId,
      t.refKind,
    ),
    targetIdx: index('crossref_index_target_idx').on(t.refTargetId),
    uniq: uniqueIndex('crossref_index_uniq').on(
      t.rootDocumentId,
      t.refKind,
      t.refTargetId,
      t.sourceSubdocumentId,
      t.sourceBlockId,
    ),
  }),
);

// ============================================================
// 21.5 agent_invocation_log — Phase 5 Wave A A1 (migration 0013).
//     Append-only counter for ADR-0008 §122 quota enforcement.
//     One row per (sync invoke || async dispatch) attempt that
//     passed the rolling-window quota check. quota-enforcer.ts
//     COUNTs rows within the 24h window before consuming.
// ============================================================

export const agentInvocationLog = pgTable(
  'agent_invocation_log',
  {
    id: text('id').primaryKey(),
    triggeringPrincipalId: text('triggering_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    principalKindTimeIdx: index('agent_invocation_log_principal_kind_time_idx').on(
      t.triggeringPrincipalId,
      t.kind,
      t.createdAt,
    ),
  }),
);

// ============================================================
// 22. claim_review — Phase 5 Wave B B1 (migration 0014) ADR-0016.
//     Claim-on-Claim Review: per-claim ORCID-signed verdict lineage.
//     5-year differentiation anchor. evidence_refs is text[] (soft FK
//     to evidence.id; PG arrays lack FK constraints; service layer
//     validates).
// ============================================================

export const claimReview = pgTable(
  'claim_review',
  {
    id: text('id').primaryKey(),
    claimId: text('claim_id')
      .notNull()
      .references(() => claim.id, { onDelete: 'restrict' }),
    reviewerPrincipalId: text('reviewer_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    reviewerOrcidId: text('reviewer_orcid_id'),
    isAiVerdict: boolean('is_ai_verdict').notNull().default(false),
    verdict: claimReviewVerdictEnum('verdict').notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    evidenceRefs: text('evidence_refs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    signedPayloadJws: text('signed_payload_jws'),
    orcidSignedAt: timestamp('orcid_signed_at', { withTimezone: true }),
    signatureVerifiedAt: timestamp('signature_verified_at', { withTimezone: true }),
    signatureAlgorithm: text('signature_algorithm'),
    provenanceId: text('provenance_id')
      .notNull()
      .references(() => provenance.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnReason: text('withdrawn_reason'),
    // Phase 6+ sub-verdict semantics; empty for Phase 5.
    verdictMeta: jsonb('verdict_meta'),
  },
  (t) => ({
    claimVerdictIdx: index('claim_review_claim_verdict_idx').on(
      t.claimId,
      t.verdict,
    ),
    reviewerIdx: index('claim_review_reviewer_idx').on(
      t.reviewerPrincipalId,
      t.submittedAt,
    ),
    orcidIdx: index('claim_review_orcid_idx').on(t.reviewerOrcidId),
    provenanceIdx: index('claim_review_provenance_idx').on(t.provenanceId),
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
export type DbClaimReview = typeof claimReview.$inferSelect;
export type DbAgentJob = typeof agentJob.$inferSelect;
export type DbAgentJobEvent = typeof agentJobEvent.$inferSelect;
export type DbAgentInvocationLog = typeof agentInvocationLog.$inferSelect;
export type DbSource = typeof source.$inferSelect;
export type DbSourceExtraction = typeof sourceExtraction.$inferSelect;
export type DbMaintenanceFinding = typeof maintenanceFinding.$inferSelect;
export type DbUserModelPref = typeof userModelPref.$inferSelect;
export type DbDocumentModelOverride = typeof documentModelOverride.$inferSelect;
export type DbPluginInstall = typeof pluginInstall.$inferSelect;
export type DbSubdocument = typeof subdocument.$inferSelect;
export type DbCrossrefIndex = typeof crossrefIndex.$inferSelect;

// ============================================================
// 23-27. Open content (Phase 6 W2 P2 — migration 0016 / ADR-0018)
//
// 5 tables: provenance_merkle_log (append-only chain) + 4 entity tables
// (open_question / open_dataset / open_peer_review / share_snapshot).
// Every entity row carries signed_payload_jws (detached JWS by author's
// ed25519) + merkle_log_entry_id (FK into chain). withdrawn_at is
// mark-only; edits go through supersede pattern (share_snapshot.
// supersedes_snapshot_id; other entities reissue under new id).
// ============================================================

export const provenanceMerkleLog = pgTable(
  'provenance_merkle_log',
  {
    id: text('id').primaryKey(),
    prevEntryId: text('prev_entry_id'),
    entrySeq: bigserial('entry_seq', { mode: 'bigint' }).notNull(),
    entityKind: text('entity_kind').notNull(),
    entityId: text('entity_id').notNull(),
    contentHash: bytea('content_hash').notNull(),
    signedJws: text('signed_jws').notNull(),
    signerPrincipalId: text('signer_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    appendedAt: timestamp('appended_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    entrySeqIdx: uniqueIndex('provenance_merkle_log_entry_seq_idx').on(t.entrySeq),
    prevIdx: index('provenance_merkle_log_prev_idx').on(t.prevEntryId),
    entityIdx: index('provenance_merkle_log_entity_idx').on(t.entityKind, t.entityId),
    signerIdx: index('provenance_merkle_log_signer_idx').on(
      t.signerPrincipalId,
      t.appendedAt,
    ),
  }),
);

export const openQuestion = pgTable(
  'open_question',
  {
    id: text('id').primaryKey(),
    askerPrincipalId: text('asker_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    askerOrcidId: text('asker_orcid_id'),
    questionMd: text('question_md').notNull(),
    domainTags: text('domain_tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text('status').notNull().default('open'),
    sourceSubdocId: text('source_subdoc_id').references(() => subdocument.id, {
      onDelete: 'set null',
    }),
    signedPayloadJws: text('signed_payload_jws').notNull(),
    merkleLogEntryId: text('merkle_log_entry_id')
      .notNull()
      .references(() => provenanceMerkleLog.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnReason: text('withdrawn_reason'),
  },
  (t) => ({
    statusIdx: index('open_question_status_idx').on(t.status, t.createdAt),
    askerIdx: index('open_question_asker_idx').on(t.askerPrincipalId, t.createdAt),
    orcidIdx: index('open_question_orcid_idx').on(t.askerOrcidId),
    merkleIdx: index('open_question_merkle_idx').on(t.merkleLogEntryId),
  }),
);

export const openDataset = pgTable(
  'open_dataset',
  {
    id: text('id').primaryKey(),
    contributorPrincipalId: text('contributor_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    datasetDoi: text('dataset_doi'),
    title: text('title').notNull(),
    descriptionMd: text('description_md').notNull(),
    blobStorageRef: text('blob_storage_ref').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    licenseSpdx: text('license_spdx').notNull(),
    signedPayloadJws: text('signed_payload_jws').notNull(),
    merkleLogEntryId: text('merkle_log_entry_id')
      .notNull()
      .references(() => provenanceMerkleLog.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnReason: text('withdrawn_reason'),
  },
  (t) => ({
    contributorIdx: index('open_dataset_contributor_idx').on(
      t.contributorPrincipalId,
      t.createdAt,
    ),
    doiIdx: index('open_dataset_doi_idx').on(t.datasetDoi),
    licenseIdx: index('open_dataset_license_idx').on(t.licenseSpdx),
    merkleIdx: index('open_dataset_merkle_idx').on(t.merkleLogEntryId),
  }),
);

export const openPeerReview = pgTable(
  'open_peer_review',
  {
    id: text('id').primaryKey(),
    reviewerPrincipalId: text('reviewer_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    reviewerOrcidId: text('reviewer_orcid_id').notNull(),
    targetKind: openPeerReviewTargetKindEnum('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    verdict: claimReviewVerdictEnum('verdict').notNull(),
    bodyMd: text('body_md').notNull(),
    evidenceRefs: text('evidence_refs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    signedPayloadJws: text('signed_payload_jws').notNull(),
    merkleLogEntryId: text('merkle_log_entry_id')
      .notNull()
      .references(() => provenanceMerkleLog.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnReason: text('withdrawn_reason'),
  },
  (t) => ({
    targetIdx: index('open_peer_review_target_idx').on(t.targetKind, t.targetId),
    reviewerIdx: index('open_peer_review_reviewer_idx').on(
      t.reviewerPrincipalId,
      t.createdAt,
    ),
    orcidIdx: index('open_peer_review_orcid_idx').on(t.reviewerOrcidId),
    verdictIdx: index('open_peer_review_verdict_idx').on(t.verdict, t.targetKind),
    merkleIdx: index('open_peer_review_merkle_idx').on(t.merkleLogEntryId),
  }),
);

export const shareSnapshot = pgTable(
  'share_snapshot',
  {
    id: text('id').primaryKey(),
    sourcePrincipalId: text('source_principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'restrict' }),
    sourceSubdocId: text('source_subdoc_id').references(() => subdocument.id, {
      onDelete: 'set null',
    }),
    markdownContent: text('markdown_content').notNull(),
    yjsBinary: bytea('yjs_binary').notNull(),
    kind: text('kind').notNull(),
    permalinkHash: text('permalink_hash').notNull().unique(),
    doi: text('doi').unique(),
    signedPayloadJws: text('signed_payload_jws').notNull(),
    merkleLogEntryId: text('merkle_log_entry_id')
      .notNull()
      .references(() => provenanceMerkleLog.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnReason: text('withdrawn_reason'),
    supersedesSnapshotId: text('supersedes_snapshot_id'),
  },
  (t) => ({
    kindIdx: index('share_snapshot_kind_idx').on(t.kind, t.createdAt),
    sourceIdx: index('share_snapshot_source_idx').on(t.sourcePrincipalId, t.createdAt),
    supersedesIdx: index('share_snapshot_supersedes_idx').on(t.supersedesSnapshotId),
    merkleIdx: index('share_snapshot_merkle_idx').on(t.merkleLogEntryId),
  }),
);

// Type exports for open content (ADR-0018)
export type DbProvenanceMerkleLog = typeof provenanceMerkleLog.$inferSelect;
export type DbOpenQuestion = typeof openQuestion.$inferSelect;
export type DbOpenDataset = typeof openDataset.$inferSelect;
export type DbOpenPeerReview = typeof openPeerReview.$inferSelect;
export type DbShareSnapshot = typeof shareSnapshot.$inferSelect;
