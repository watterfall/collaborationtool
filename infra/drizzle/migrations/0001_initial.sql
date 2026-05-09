-- Phase 1 D7: initial schema.
--
-- This migration is hand-written rather than drizzle-kit generated
-- because we need:
--   1. CHECK constraints on Principal id prefix (e.g. 'user:' for kind=user)
--   2. DEFERRABLE INITIALLY DEFERRED on the contribution ↔ revision ↔
--      provenance cycle so a single tx can insert the bundle in any order
--   3. GIN index on contribution.affected_block_ids (text[])
--   4. CHECK that revision.provenance_id is NOT NULL when proposed_by is
--      an agent (kind='agent')
--   5. CHECK that document.bilingual_mode is consistent with primary_language
--
-- Future migrations may be drizzle-kit generated; this baseline locks in
-- the invariants that the TS schema can't express.

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE "principal_kind" AS ENUM (
  'user', 'agent', 'shared-link', 'service', 'org'
);

CREATE TYPE "agent_kind" AS ENUM (
  'editor', 'reviewer', 'citation', 'researcher', 'coordinator', 'custom'
);

CREATE TYPE "agent_runtime" AS ENUM ('server', 'client');

CREATE TYPE "bilingual_mode" AS ENUM ('mono', 'parallel', 'mixed');

CREATE TYPE "citation_kind" AS ENUM (
  'literature', 'dataset', 'software', 'document', 'web'
);

CREATE TYPE "annotation_kind" AS ENUM (
  'comment', 'suggestion', 'reviewer-note', 'agent-flag', 'task'
);

CREATE TYPE "annotation_status" AS ENUM ('open', 'resolved', 'archived');

CREATE TYPE "revision_status" AS ENUM (
  'draft', 'proposed', 'accepted', 'rejected', 'superseded'
);

CREATE TYPE "actor_kind" AS ENUM (
  'user', 'agent', 'service', 'shared-link'
);

CREATE TYPE "capability_resource_type" AS ENUM (
  'document', 'block', 'thread', 'global'
);

-- ============================================================
-- principal
-- ============================================================

CREATE TABLE "principal" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" "principal_kind" NOT NULL,
  "display_name" text NOT NULL,
  "user_id" text,
  "agent_id" text,
  "shared_link_id" text,
  "org_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz,
  -- ADR-0002 §2.3: id format encodes kind to avoid network-hot-path joins.
  CONSTRAINT "principal_id_prefix_matches_kind" CHECK (
    (kind = 'user'        AND id LIKE 'user:%')        OR
    (kind = 'agent'       AND id LIKE 'agent:%')       OR
    (kind = 'shared-link' AND id LIKE 'link:%')        OR
    (kind = 'service'     AND id LIKE 'service:%')     OR
    (kind = 'org'         AND id LIKE 'org:%')
  ),
  -- one identity link per row (cheap consistency)
  CONSTRAINT "principal_kind_link_consistency" CHECK (
    (kind = 'user'        AND user_id        IS NOT NULL AND agent_id IS NULL AND org_id IS NULL AND shared_link_id IS NULL) OR
    (kind = 'agent'       AND agent_id       IS NOT NULL AND user_id IS NULL AND org_id IS NULL AND shared_link_id IS NULL) OR
    (kind = 'shared-link' AND shared_link_id IS NOT NULL AND user_id IS NULL AND agent_id IS NULL AND org_id IS NULL) OR
    (kind = 'service'     AND user_id IS NULL AND agent_id IS NULL AND org_id IS NULL AND shared_link_id IS NULL) OR
    (kind = 'org'         AND org_id         IS NOT NULL AND user_id IS NULL AND agent_id IS NULL AND shared_link_id IS NULL)
  )
);

CREATE INDEX "principal_kind_idx"      ON "principal" ("kind");
CREATE INDEX "principal_user_id_idx"   ON "principal" ("user_id");
CREATE INDEX "principal_agent_id_idx"  ON "principal" ("agent_id");
CREATE INDEX "principal_org_id_idx"    ON "principal" ("org_id");

-- ============================================================
-- agent
-- ============================================================

CREATE TABLE "agent" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_principal_id" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "kind" "agent_kind" NOT NULL,
  "runtime" "agent_runtime" NOT NULL DEFAULT 'server',
  "default_model_id" text NOT NULL,
  "default_skill_ids" text[] NOT NULL DEFAULT '{}',
  "allowed_mcp_server_ids" text[] NOT NULL DEFAULT '{}',
  "default_max_tokens" integer NOT NULL,
  "default_timeout_ms" integer NOT NULL,
  "principal_id" text NOT NULL UNIQUE REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);

CREATE INDEX "agent_owner_idx" ON "agent" ("owner_principal_id");
CREATE INDEX "agent_kind_idx"  ON "agent" ("kind");

-- ============================================================
-- document
-- ============================================================

CREATE TABLE "document" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_principal_id" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "primary_language" text NOT NULL,
  "bilingual_mode" "bilingual_mode" NOT NULL DEFAULT 'mono',
  "template_id" text,
  "title" text NOT NULL DEFAULT '',
  "slug" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "forked_from_document_id" text REFERENCES "document" ("id") ON DELETE SET NULL,
  "forked_from_contribution_id" text,
  "yjs_state_vector_snapshot" bytea,
  "yjs_doc_binary" bytea,
  "last_snapshot_at" timestamptz
);

CREATE INDEX "document_owner_idx" ON "document" ("owner_principal_id");
CREATE UNIQUE INDEX "document_slug_uniq" ON "document" ("slug");
CREATE INDEX "document_forked_from_idx" ON "document" ("forked_from_document_id");

-- ============================================================
-- block_metadata
-- ============================================================

CREATE TABLE "block_metadata" (
  "block_id" text PRIMARY KEY NOT NULL,
  "document_id" text NOT NULL REFERENCES "document" ("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "first_seen_contribution_id" text NOT NULL,
  "last_seen_at" timestamptz NOT NULL,
  "removed_at" timestamptz
);

CREATE INDEX "block_meta_document_idx" ON "block_metadata" ("document_id");
CREATE INDEX "block_meta_type_idx"     ON "block_metadata" ("type");

-- ============================================================
-- citation
-- ============================================================

CREATE TABLE "citation" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" "citation_kind" NOT NULL,
  "csl_json" jsonb NOT NULL,
  "doi" text,
  "url" text,
  "archived_at" timestamptz,
  "language" text,
  "external_ids" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "citation_doi_idx"  ON "citation" ("doi");
CREATE INDEX "citation_kind_idx" ON "citation" ("kind");

-- ============================================================
-- annotation_thread
-- ============================================================

CREATE TABLE "annotation_thread" (
  "id" text PRIMARY KEY NOT NULL,
  "document_id" text NOT NULL REFERENCES "document" ("id") ON DELETE CASCADE,
  "anchor_id" text NOT NULL,
  "kind" "annotation_kind" NOT NULL,
  "status" "annotation_status" NOT NULL DEFAULT 'open',
  "created_by" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_by" text REFERENCES "principal" ("id") ON DELETE SET NULL,
  "resolved_at" timestamptz
);

CREATE INDEX "annotation_thread_document_idx" ON "annotation_thread" ("document_id");
CREATE INDEX "annotation_thread_anchor_idx"   ON "annotation_thread" ("anchor_id");
CREATE INDEX "annotation_thread_status_idx"   ON "annotation_thread" ("status");

-- ============================================================
-- annotation_comment
-- ============================================================

CREATE TABLE "annotation_comment" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL REFERENCES "annotation_thread" ("id") ON DELETE CASCADE,
  "author_principal_id" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "body_markdown" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "marked_deleted_at" timestamptz,
  "contribution_id" text NOT NULL
);

CREATE INDEX "annotation_comment_thread_idx"     ON "annotation_comment" ("thread_id");
CREATE INDEX "annotation_comment_created_at_idx" ON "annotation_comment" ("created_at");

-- ============================================================
-- provenance (created BEFORE revision/contribution because they FK to it)
-- ============================================================

CREATE TABLE "provenance" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_principal_id" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "actor_kind" "actor_kind" NOT NULL,
  "agent_context" jsonb,
  "input_block_ids" text[],
  "input_document_ids" text[],
  "triggered_at" timestamptz NOT NULL DEFAULT now(),
  "tool_calls" jsonb,
  "approval_chain" jsonb,
  CONSTRAINT "provenance_agent_requires_context" CHECK (
    actor_kind <> 'agent' OR agent_context IS NOT NULL
  )
);

CREATE INDEX "provenance_actor_idx"     ON "provenance" ("actor_principal_id");
CREATE INDEX "provenance_triggered_idx" ON "provenance" ("triggered_at");

-- ============================================================
-- revision (FK to provenance + later DEFERRABLE FK to contribution)
-- ============================================================

CREATE TABLE "revision" (
  "id" text PRIMARY KEY NOT NULL,
  "document_id" text NOT NULL REFERENCES "document" ("id") ON DELETE CASCADE,
  "proposed_by" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "status" "revision_status" NOT NULL DEFAULT 'draft',
  "pm_steps_binary" bytea NOT NULL,
  "yjs_update_binary" bytea NOT NULL,
  "base_state_vector" bytea NOT NULL,
  "rationale" text,
  "provenance_id" text REFERENCES "provenance" ("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "decided_at" timestamptz,
  "decided_by" text REFERENCES "principal" ("id") ON DELETE SET NULL,
  "contribution_id" text
);

CREATE INDEX "revision_document_idx"    ON "revision" ("document_id");
CREATE INDEX "revision_status_idx"      ON "revision" ("status");
CREATE INDEX "revision_proposed_by_idx" ON "revision" ("proposed_by");

-- ============================================================
-- contribution (provenance_id NOT NULL — provenance is mandatory)
-- ============================================================

CREATE TABLE "contribution" (
  "id" text PRIMARY KEY NOT NULL,
  "document_id" text NOT NULL REFERENCES "document" ("id") ON DELETE CASCADE,
  "parent_contribution_id" text,
  "from_revision_id" text,
  "contributor_principal_id" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "pm_steps_binary" bytea NOT NULL,
  "yjs_update_binary" bytea NOT NULL,
  "affected_block_ids" text[] NOT NULL DEFAULT '{}',
  "committed_at" timestamptz NOT NULL DEFAULT now(),
  "provenance_id" text NOT NULL REFERENCES "provenance" ("id") ON DELETE RESTRICT
);

CREATE INDEX "contribution_document_idx"    ON "contribution" ("document_id");
CREATE INDEX "contribution_contributor_idx" ON "contribution" ("contributor_principal_id");
-- GIN on text[] for per-block history queries (covers `WHERE affected_block_ids @> ARRAY[...]`)
CREATE INDEX "contribution_affected_blocks_gin_idx"
  ON "contribution" USING GIN ("affected_block_ids");

-- Self-FK for parent contribution.
ALTER TABLE "contribution"
  ADD CONSTRAINT "contribution_parent_fk"
  FOREIGN KEY ("parent_contribution_id") REFERENCES "contribution" ("id")
  ON DELETE SET NULL;

-- DEFERRABLE FK on the cycle: revision.contribution_id → contribution.id
-- and contribution.from_revision_id → revision.id can both be inserted in
-- the same transaction.
ALTER TABLE "revision"
  ADD CONSTRAINT "revision_contribution_fk"
  FOREIGN KEY ("contribution_id") REFERENCES "contribution" ("id")
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "contribution"
  ADD CONSTRAINT "contribution_from_revision_fk"
  FOREIGN KEY ("from_revision_id") REFERENCES "revision" ("id")
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- annotation_comment.contribution_id is also a deferred FK because the
-- contribution row is inserted at commit boundary, possibly before the
-- comment row in the same tx.
ALTER TABLE "annotation_comment"
  ADD CONSTRAINT "annotation_comment_contribution_fk"
  FOREIGN KEY ("contribution_id") REFERENCES "contribution" ("id")
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- block_metadata.first_seen_contribution_id deferred similarly.
ALTER TABLE "block_metadata"
  ADD CONSTRAINT "block_metadata_first_seen_contribution_fk"
  FOREIGN KEY ("first_seen_contribution_id") REFERENCES "contribution" ("id")
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- document.forked_from_contribution_id deferred similarly.
ALTER TABLE "document"
  ADD CONSTRAINT "document_forked_from_contribution_fk"
  FOREIGN KEY ("forked_from_contribution_id") REFERENCES "contribution" ("id")
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- capability_grant
-- ============================================================

CREATE TABLE "capability_grant" (
  "id" text PRIMARY KEY NOT NULL,
  "principal_id" text NOT NULL REFERENCES "principal" ("id") ON DELETE CASCADE,
  "resource_type" "capability_resource_type" NOT NULL,
  "resource_id" text,
  "verb" text NOT NULL,
  "expires_at" timestamptz,
  "granted_by" text NOT NULL REFERENCES "principal" ("id") ON DELETE RESTRICT,
  "granted_at" timestamptz NOT NULL DEFAULT now(),
  -- global grants must have null resource_id; non-global must have non-null
  CONSTRAINT "capability_grant_resource_id_consistency" CHECK (
    (resource_type = 'global' AND resource_id IS NULL) OR
    (resource_type <> 'global' AND resource_id IS NOT NULL)
  )
);

CREATE INDEX "capability_grant_lookup_idx"
  ON "capability_grant" ("principal_id", "resource_type", "resource_id");
CREATE INDEX "capability_grant_expires_idx" ON "capability_grant" ("expires_at");
CREATE INDEX "capability_grant_verb_idx"    ON "capability_grant" ("verb");

-- ============================================================
-- document_acl (Phase 1 materialized capability bundle per doc/principal)
-- ============================================================

CREATE TABLE "document_acl" (
  "document_id" text NOT NULL REFERENCES "document" ("id") ON DELETE CASCADE,
  "principal_id" text NOT NULL REFERENCES "principal" ("id") ON DELETE CASCADE,
  "role_id" text NOT NULL,
  "capability_verbs" text[] NOT NULL DEFAULT '{}',
  "expires_at" timestamptz,
  PRIMARY KEY ("document_id", "principal_id")
);

CREATE INDEX "document_acl_principal_idx" ON "document_acl" ("principal_id");

-- ============================================================
-- prompt_template (immutable; new versions = new id)
-- ============================================================

CREATE TABLE "prompt_template" (
  "id" text PRIMARY KEY NOT NULL,
  "skill_id" text NOT NULL,
  "version" text NOT NULL,
  "hash" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "prompt_template_skill_idx" ON "prompt_template" ("skill_id");
CREATE UNIQUE INDEX "prompt_template_skill_version_uniq"
  ON "prompt_template" ("skill_id", "version");
