-- Phase 2 W1 ADR-0006: MCP server registry table.
--
-- Source of truth for installed MCP servers. Initially seeded from
-- `mcp-servers/registry.json` via `pnpm mcp:seed` (the built-in seed
-- contains crossref + crossref-mock; user/team installs are later
-- inserts).
--
-- ai-runtime resolves a skill's `allowed_mcp_servers` union against
-- this table at agent invocation:
--   allow_set = skill.allowed_mcp_servers ∩ (mcp_server WHERE enabled)
-- Anything outside allow_set raises McpAccessDenied + writes provenance
-- (per ADR-0006 §2.2).
--
-- Lifecycle (Phase 2): per-invocation stdio spawn — no process pool.
-- HTTP / http-sse rows are accepted in the schema but not exercised
-- until Phase 3 (per ADR-0006 §2.3).
--
-- Coordinated with ADR-0010 §2.5 plugin install flow: this table is
-- the MCP-specialised branch of the generic plugin registry. Plugin
-- loader on encountering `type: mcp-server` in plugin.yaml writes a
-- row here in addition to the generic install bookkeeping.

CREATE TYPE "mcp_transport" AS ENUM ('stdio', 'http', 'http-sse');
CREATE TYPE "mcp_origin" AS ENUM ('built-in', 'user', 'team');
CREATE TYPE "mcp_health_status" AS ENUM ('unknown', 'healthy', 'degraded', 'failed');

CREATE TABLE "mcp_server" (
  "id" text PRIMARY KEY,
  "version" text NOT NULL,
  "transport" "mcp_transport" NOT NULL,
  -- stdio fields. command[0] is the executable; command[1..] are static args.
  -- args[] is an additional list (kept separate so seed JSON / install UI
  -- can distinguish "executable + base args" from "extra args").
  "command" text[] NOT NULL DEFAULT '{}'::text[],
  "args" text[] NOT NULL DEFAULT '{}'::text[],
  "cwd" text,
  -- http / http-sse fields.
  "url" text,
  -- Common.
  "env_vars_required" text[] NOT NULL DEFAULT '{}'::text[],
  "declares_tools" text[] NOT NULL DEFAULT '{}'::text[],
  "required_capabilities" text[] NOT NULL DEFAULT '{}'::text[],
  "origin" "mcp_origin" NOT NULL,
  "installed_by" text REFERENCES "principal"("id") ON DELETE SET NULL,
  "installed_at" timestamptz NOT NULL DEFAULT now(),
  "enabled" boolean NOT NULL DEFAULT true,
  "health_status" "mcp_health_status" NOT NULL DEFAULT 'unknown',
  "last_health_check_at" timestamptz,
  "consecutive_failures" integer NOT NULL DEFAULT 0,

  -- Transport invariants. We can't yet express "stdio requires non-empty
  -- command" purely in DDL since command[] is text[] not nullable; the
  -- check below covers the structural cases.
  CONSTRAINT "mcp_server_transport_fields_chk" CHECK (
    ("transport" = 'stdio' AND array_length("command", 1) >= 1 AND "url" IS NULL)
    OR ("transport" IN ('http', 'http-sse') AND "url" IS NOT NULL)
  )
);

CREATE INDEX "mcp_server_enabled_idx" ON "mcp_server" ("enabled") WHERE "enabled" = true;
CREATE INDEX "mcp_server_origin_idx" ON "mcp_server" ("origin");
-- Partial index: only non-healthy rows are interesting for ops dashboards.
CREATE INDEX "mcp_server_health_attention_idx"
  ON "mcp_server" ("health_status")
  WHERE "health_status" <> 'healthy';
