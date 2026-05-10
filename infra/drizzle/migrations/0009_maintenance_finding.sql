-- Phase 3 W4: Knowledge maintenance scan output table.
--
-- essay §7.4 工作流：scan 知识库找
--   - unsupported claims (claim 没有 evidence 行)
--   - outdated sources (source.accessed_at >= cutoff)
--   - duplicated claims (相似度高的 claim 跨文档重复)
--   - contradicted conclusions (claim 有 evidence relation='challenges'
--     但没人 reconcile)
--   - unverified AI blocks (claim/evidence status='ai-suggested' 长期
--     未被人审)
--   - broken citations (citation.id reference 但 doi 失效)
--
-- 一个 scan job（apps/agent-worker，pgboss queue 'maintenance-scan'）
-- 跑后写多条 maintenance_finding 行；UI 在专门 dashboard 列出，用户
-- 接受/忽略/已修复。
--
-- Phase 3 §2.3 决策：
--   - 触发：cron（每周一凌晨）+ 用户主动 + source 更新事件触发；
--   - 报告形式：新表 maintenance_finding（不复用 annotation_thread —
--             这些是知识库级而非文档级）；
--   - 范围：单文档 + per-user vault 两档（job.input.scope 字段决定）

CREATE TYPE "finding_kind" AS ENUM (
  'unsupported-claim',
  'outdated-source',
  'duplicated-claim',
  'contradicted-conclusion',
  'unverified-ai-block',
  'broken-citation'
);

CREATE TYPE "finding_severity" AS ENUM ('info', 'low', 'medium', 'high');

CREATE TYPE "finding_status" AS ENUM (
  'open',
  'acknowledged',  -- 用户看过但暂不处理
  'resolved',      -- 用户修了对应问题
  'dismissed'      -- 用户判定误报
);

CREATE TABLE "maintenance_finding" (
  "id" text PRIMARY KEY,
  "kind" "finding_kind" NOT NULL,
  "severity" "finding_severity" NOT NULL DEFAULT 'medium',
  "status" "finding_status" NOT NULL DEFAULT 'open',
  -- 触发该 finding 的 scan job（追溯用；可空：手动 import 的也算）
  "job_id" text REFERENCES "agent_job"("id") ON DELETE SET NULL,
  -- soft FKs to whatever entity the finding points at; at most one is set
  "claim_id" text REFERENCES "claim"("id") ON DELETE CASCADE,
  "evidence_id" text REFERENCES "evidence"("id") ON DELETE CASCADE,
  "source_id" text REFERENCES "source"("id") ON DELETE CASCADE,
  "citation_id" text REFERENCES "citation"("id") ON DELETE CASCADE,
  "document_id" text REFERENCES "document"("id") ON DELETE CASCADE,
  -- The principal whose vault this finding is in (knowledge owner;
  -- often = job.triggering_principal_id but can differ for team scans)
  "vault_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE CASCADE,
  -- Human-readable description (rendered from a template + entity row)
  "summary" text NOT NULL,
  -- Structured payload for the UI: e.g. for 'duplicated-claim' include
  -- otherClaimIds[], similarity score, etc.
  "details" jsonb,
  "found_at" timestamptz NOT NULL DEFAULT now(),
  "acknowledged_at" timestamptz,
  "acknowledged_by" text REFERENCES "principal"("id") ON DELETE SET NULL,
  "resolved_at" timestamptz,
  "resolved_by" text REFERENCES "principal"("id") ON DELETE SET NULL,
  "dismissed_at" timestamptz,
  "dismissed_by" text REFERENCES "principal"("id") ON DELETE SET NULL,
  "dismiss_reason" text,

  -- 必须至少有一个 entity FK；CHECK 强制
  CONSTRAINT "maintenance_finding_has_target_chk" CHECK (
    "claim_id" IS NOT NULL
    OR "evidence_id" IS NOT NULL
    OR "source_id" IS NOT NULL
    OR "citation_id" IS NOT NULL
    OR "document_id" IS NOT NULL
  )
);

CREATE INDEX "maintenance_finding_vault_open_idx"
  ON "maintenance_finding" ("vault_principal_id", "status")
  WHERE "status" = 'open';
CREATE INDEX "maintenance_finding_kind_idx"
  ON "maintenance_finding" ("kind");
CREATE INDEX "maintenance_finding_severity_idx"
  ON "maintenance_finding" ("severity")
  WHERE "status" = 'open';
CREATE INDEX "maintenance_finding_job_idx"
  ON "maintenance_finding" ("job_id");
