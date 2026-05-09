-- Phase 2 W2 ADR-0008: long-horizon agent runtime (reviewer / researcher).
--
-- Two new tables: `agent_job` (user-visible job lifecycle) and
-- `agent_job_event` (append-only event stream for SSE re-connect at
-- /api/agent/job/<id>/stream?cursor=<eventId>).
--
-- pgboss owns its own schema (`pgboss.*`) for queue / dedupe / retry;
-- this migration does NOT create pgboss tables — pgboss creates them
-- on first connect via its own migrate API. We just create the
-- user-visible mirror tables.
--
-- agent_kind enum extension: add 'reviewer' + 'researcher' (ADR-0008
-- §2.2 + ADR-0001 §2.3.7).
-- agent_runtime enum extension: add 'long-horizon' (ADR-0008 §2.2).

-- Extend existing enums (PG ALTER TYPE ADD VALUE syntax).
ALTER TYPE "agent_kind" ADD VALUE IF NOT EXISTS 'reviewer';
ALTER TYPE "agent_kind" ADD VALUE IF NOT EXISTS 'researcher';
ALTER TYPE "agent_runtime" ADD VALUE IF NOT EXISTS 'long-horizon';

CREATE TYPE "agent_job_status" AS ENUM (
  'queued',
  'running',
  'done',
  'error',
  'cancelled'
);

CREATE TABLE "agent_job" (
  "id" text PRIMARY KEY,
  "kind" text NOT NULL,                     -- 'reviewer' | 'researcher' (free text vs enum so plugins can add later)
  "document_id" text NOT NULL REFERENCES "document"("id") ON DELETE CASCADE,
  "triggering_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "agent_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "status" "agent_job_status" NOT NULL DEFAULT 'queued',
  "progress_fraction" numeric(3, 2) NOT NULL DEFAULT 0,
  "progress_message" text,
  "output_revision_ids" text[] NOT NULL DEFAULT '{}'::text[],
  "output_thread_ids" text[] NOT NULL DEFAULT '{}'::text[],
  "cost_token_input" integer NOT NULL DEFAULT 0,
  "cost_token_output" integer NOT NULL DEFAULT 0,
  "cost_usd_milli" integer NOT NULL DEFAULT 0,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "error_class" text,
  "error_message" text,
  "input_payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "agent_job_progress_range" CHECK (
    "progress_fraction" >= 0 AND "progress_fraction" <= 1
  )
);

CREATE INDEX "agent_job_doc_status_idx"
  ON "agent_job" ("document_id", "status");
CREATE INDEX "agent_job_triggerer_idx"
  ON "agent_job" ("triggering_principal_id", "created_at" DESC);
CREATE INDEX "agent_job_active_idx"
  ON "agent_job" ("status")
  WHERE "status" IN ('queued', 'running');

-- ============================================================
-- agent_job_event — append-only event stream backing SSE re-connect.
-- The worker writes here for every progress / partial / done / error.
-- The /api/agent/job/<id>/stream endpoint reads in (job_id, id) order
-- starting at cursor.
-- ============================================================
CREATE TABLE "agent_job_event" (
  "id" bigserial PRIMARY KEY,
  "job_id" text NOT NULL REFERENCES "agent_job"("id") ON DELETE CASCADE,
  "event_kind" text NOT NULL,               -- 'progress' | 'partial' | 'done' | 'error'
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "agent_job_event_job_idx" ON "agent_job_event" ("job_id", "id");
