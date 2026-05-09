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
  agentKindEnum,
  agentRuntimeEnum,
  annotationKindEnum,
  annotationStatusEnum,
  bilingualModeEnum,
  capabilityResourceTypeEnum,
  citationKindEnum,
  principalKindEnum,
  revisionStatusEnum,
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
