-- Phase 3 closeout migration: 4 schema changes that close the W5 / W6 / W7
-- backend gates so Phase 3 can land cleanly:
--
--   1. agent_job.parent_job_id  (W6 — coordinator handoff parent linkage)
--   2. user_model_pref          (W7 — ADR-0013 user-level provider/model)
--   3. document_model_override  (W7 — ADR-0013 document-level override)
--   4. plugin_install           (W5 — ADR-0012 user-installed plugin row)
--
-- These 4 are the minimum schema needed for Phase 3 to NOT block on
-- Phase 4 — the dispatch loop / install API / BYO-model UI can be
-- written against these tables in Phase 4 without further migrations.
--
-- Why one migration: each piece is small (≤ 1 enum + 1 table) and tightly
-- coupled to its W5 / W6 / W7 closeout note. Splitting four files for
-- four small additions adds noise without aiding rollback (a partial
-- closeout has no useful intermediate state).

-- ============================================================
-- 1. agent_job.parent_job_id (W6 closeout)
--    Coordinator agent dispatches sub-jobs (mode='async'); parent_job_id
--    links child agent_job rows back to the coordinator row. Indexed
--    so the coordinator can poll all its outstanding children in one
--    query: WHERE parent_job_id = $coordinatorId AND status IN (...)
-- ============================================================

ALTER TABLE "agent_job"
  ADD COLUMN "parent_job_id" text
    REFERENCES "agent_job"("id") ON DELETE SET NULL;

CREATE INDEX "agent_job_parent_idx"
  ON "agent_job" ("parent_job_id")
  WHERE "parent_job_id" IS NOT NULL;

-- ============================================================
-- 2. user_model_pref (W7 closeout, ADR-0013 §2.4)
--    Per-principal default ModelProvider + modelId selection. The host
--    reads this when invokeAgentViaPlugin is called and the calling
--    agent has no document-level override.
--
--    pref_kind == 'default' applies to all agent kinds; when
--    plugin/agent author wants a specific provider they declare
--    `prefers_provider` in plugin manifest, but user can override.
--
--    JSON `provider_config` mirrors ProviderConfig (id / endpointUrl /
--    headers; apiKey lives in env-var pointer NOT here — see ADR-0013
--    §2.6 secrets policy). Stored values are non-secret only.
-- ============================================================

CREATE TYPE "model_provider_wire_format" AS ENUM (
  'anthropic',
  'openai-compat',
  'ollama',
  'custom-http'
);

CREATE TABLE "user_model_pref" (
  "id" text PRIMARY KEY,
  "principal_id" text NOT NULL
    REFERENCES "principal"("id") ON DELETE CASCADE,
  "pref_kind" text NOT NULL DEFAULT 'default',
  -- Provider id (e.g. 'anthropic-default', 'ollama-localhost', 'corp-vllm-A').
  "provider_id" text NOT NULL,
  "wire_format" "model_provider_wire_format" NOT NULL,
  "model_id" text NOT NULL,
  "endpoint_url" text,
  -- API key is referenced indirectly via env var name; never stored here.
  "api_key_env_var" text,
  "extra_headers" jsonb,
  "label" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- One default per principal+kind; per-agent-kind prefs come later.
  CONSTRAINT "user_model_pref_unique_default" UNIQUE ("principal_id", "pref_kind")
);

CREATE INDEX "user_model_pref_principal_idx"
  ON "user_model_pref" ("principal_id");

-- ============================================================
-- 3. document_model_override (W7 closeout, ADR-0013 §2.4)
--    A document owner can pin a specific provider/model for all agent
--    invocations on that document (e.g. a sensitive legal doc forced to
--    on-prem Ollama). Lookup precedence: document_model_override →
--    user_model_pref → ENV default.
-- ============================================================

CREATE TABLE "document_model_override" (
  "id" text PRIMARY KEY,
  "document_id" text NOT NULL UNIQUE
    REFERENCES "document"("id") ON DELETE CASCADE,
  "provider_id" text NOT NULL,
  "wire_format" "model_provider_wire_format" NOT NULL,
  "model_id" text NOT NULL,
  "endpoint_url" text,
  "api_key_env_var" text,
  "extra_headers" jsonb,
  "set_by_principal_id" text NOT NULL
    REFERENCES "principal"("id") ON DELETE RESTRICT,
  "set_at" timestamptz NOT NULL DEFAULT now(),
  "reason" text
);

-- ============================================================
-- 4. plugin_install (W5 closeout, ADR-0012 §2.4)
--    User-installed plugin rows. Built-in plugins continue to live in
--    plugins/registry.json (no DB row needed). User-installed plugins
--    have a row here, plus a sandbox descriptor + accepted-capabilities
--    snapshot at install time.
--
--    Lifecycle: install → enabled (default) → disabled (user toggle) →
--    uninstalled (soft delete: archived_at set so audit trail keeps).
--
--    On uninstall the host:
--      a) revokes capability_grant rows for this plugin
--      b) tears down sandbox (bwrap binding cleared)
--      c) cancels any in-flight agent_job rows that reference it
-- ============================================================

CREATE TYPE "plugin_install_status" AS ENUM (
  'enabled',
  'disabled',
  'uninstalled'
);

CREATE TYPE "plugin_install_origin" AS ENUM (
  'git-url',          -- user-provided git URL (https only; ADR-0012 §2.2)
  'local-path',       -- developer testing only; admin role required
  'marketplace'       -- Phase 4+; reserved
);

CREATE TABLE "plugin_install" (
  "id" text PRIMARY KEY,
  "plugin_manifest_id" text NOT NULL,
  "plugin_kind" text NOT NULL,
  "version" text NOT NULL,
  "origin" "plugin_install_origin" NOT NULL,
  "source_url" text,                        -- git URL or filesystem path
  "installed_by" text NOT NULL
    REFERENCES "principal"("id") ON DELETE RESTRICT,
  "installed_at" timestamptz NOT NULL DEFAULT now(),
  "status" "plugin_install_status" NOT NULL DEFAULT 'enabled',
  -- ADR-0010 manifest required_capabilities[] snapshot at install time.
  -- User explicitly accepted these via capability prompt UI.
  "accepted_capabilities" jsonb NOT NULL,
  -- Path on host filesystem after sandbox extraction (immutable post-install).
  "install_path" text NOT NULL,
  -- Sandbox descriptor (bwrap args / sandbox-exec profile / AppContainer
  -- spec); host serializes from ADR-0012 §2.1 platform-specific impl.
  "sandbox_descriptor" jsonb,
  "archived_at" timestamptz,
  -- Fingerprint of plugin source bytes (SHA-256 of tar of install_path)
  -- for tamper detection on next load.
  "bundle_hash_sha256" text,

  CONSTRAINT "plugin_install_origin_url_chk" CHECK (
    ("origin" = 'git-url' AND "source_url" IS NOT NULL AND "source_url" LIKE 'https://%')
    OR ("origin" = 'local-path' AND "source_url" IS NOT NULL)
    OR ("origin" = 'marketplace')
  )
);

CREATE INDEX "plugin_install_principal_idx"
  ON "plugin_install" ("installed_by", "status");
CREATE INDEX "plugin_install_active_idx"
  ON "plugin_install" ("status")
  WHERE "status" = 'enabled';
CREATE INDEX "plugin_install_kind_idx"
  ON "plugin_install" ("plugin_kind");
