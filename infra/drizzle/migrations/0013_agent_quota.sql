-- Phase 5 Wave A A1 — ADR-0008 §122 quota enforcer (compensates the
-- Phase 4.5 evidence gap flagged by codex review 2026-05-11).
--
-- Adds two artefacts:
--
--   1. `agent.quota_per_day` integer column (default 50). Mirrors
--      ADR-0008 §122 promise that every agent row carries its own
--      per-day cap. Existing rows backfill to 50 automatically via
--      DEFAULT.
--
--   2. `agent_invocation_log` table. Append-only counter feeding the
--      rolling 24h quota window. Both `/api/agent/invoke` (sync) and
--      `apps/agent-worker` (async reviewer / researcher / maintenance)
--      INSERT one row per invocation; quota-enforcer.ts counts in the
--      24h window before allowing each new call.
--
-- Redis swap (ADR-0008 §150 / improvement-plan-2026-05.md §三) stays
-- deferred to Phase 6+; PG counter is honest enough for the projected
-- usage volume in Phase 5-6.
--
-- Idempotency: PG 9.6+ ADD COLUMN IF NOT EXISTS / CREATE TABLE
-- IF NOT EXISTS / CREATE INDEX IF NOT EXISTS so re-run is a no-op.

-- ============================================================
-- §1 agent.quota_per_day (ADR-0008 §122)
-- ============================================================

ALTER TABLE "agent"
  ADD COLUMN IF NOT EXISTS "quota_per_day" integer NOT NULL DEFAULT 50;

-- ============================================================
-- §2 agent_invocation_log
-- ============================================================

CREATE TABLE IF NOT EXISTS "agent_invocation_log" (
  "id" text PRIMARY KEY,
  "triggering_principal_id" text NOT NULL
    REFERENCES "principal" ("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Hot path index: count(*) WHERE principal=? AND kind=? AND created_at >= ?
CREATE INDEX IF NOT EXISTS "agent_invocation_log_principal_kind_time_idx"
  ON "agent_invocation_log" ("triggering_principal_id", "kind", "created_at" DESC);

-- ============================================================
-- §3 agent_job_status += 'cancelling' (ADR-0008 §93 / §156)
--    Phase 5 Wave A A2 — user-requested-stop intermediate state.
--    Cancel route flips queued|running → cancelling; worker polls at
--    tool-call boundaries and graceful-shutdowns to 'cancelled'.
-- ============================================================

-- PG 12+ supports ADD VALUE IF NOT EXISTS — docker-compose pins
-- postgres:16, so safe.
ALTER TYPE "agent_job_status" ADD VALUE IF NOT EXISTS 'cancelling';
