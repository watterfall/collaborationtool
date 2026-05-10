-- Phase 3 W1/W2: source ingestion + AI extraction staging.
--
-- Background：essay §6.1 + §10.1 把 Source 列为 7 对象之一。Phase 1
-- 的 `citation` 表本质是"已确认的引用元数据"——但 Source Reader 阶段
-- 用户先有"这份文件原文"才有"提取的 claim/evidence"，再有"引用"。
-- citation ≠ source；前者是 reference，后者是 raw material。
--
-- 两表：
--   source —— 原始文件 / URL / 文本，PDF/HTML/markdown/text 多类型
--   source_extraction —— AI 抽取暂存表（claim / evidence 候选），人工
--                        确认后才进 main claim / evidence 表
--
-- AI 自动抽取流水线（W2 plugins/source-extractor）写 source_extraction
-- 行 status='ai-suggested'；用户在 Source Reader UI 接受/修改/拒绝
-- 后写真 claim / evidence row（per ADR-0011）。
-- 拒绝的留 status='rejected' 历史，便于改进 prompt 时回看。
--
-- Phase 3 §2.1 staging vs direct decisions：选 staging（避免 AI 直接
-- 污染 claim 一等对象表，per essay §1.4 "AI 生成会加剧知识污染"）。

CREATE TYPE "source_kind" AS ENUM (
  'pdf',
  'web',
  'markdown',
  'text',
  'docx',
  'epub',
  'manual'      -- 用户手动录入
);

CREATE TYPE "source_trust_level" AS ENUM (
  'unverified',
  'low',
  'medium',
  'high'
);

CREATE TYPE "extraction_status" AS ENUM (
  'ai-suggested',
  'user-accepted',  -- 已迁入 main claim / evidence 表
  'user-modified',  -- 用户改后接受；text 字段是 modified 版
  'rejected'
);

CREATE TYPE "extraction_kind" AS ENUM (
  'claim',
  'evidence',
  'question'
  -- 'decision' 推 Phase 3 后期；当前 annotation_thread 兜底
);

-- ============================================================
-- source — 原始材料
-- ============================================================
CREATE TABLE "source" (
  "id" text PRIMARY KEY,
  "kind" "source_kind" NOT NULL,
  "title" text NOT NULL,
  "url" text,
  -- File-backed sources: store byte hash for content-addressing,
  -- the bytes themselves on object storage (S3/R2). Phase 3 W1 may
  -- bundle bytes in PG `bytea` for small files; Phase 3 stub use
  -- nullable bytes_oid (path-style id) and require object-store
  -- adapter (Phase 4 dedicated ADR if needed).
  "bytes_hash_sha256" text,
  "bytes_size" integer,
  "bytes_storage_url" text,         -- s3://... or local path
  "raw_text" text,                  -- extracted plain text (PDF.js + readability)
  "language" text,                  -- BCP-47 if detected
  "trust_level" "source_trust_level" NOT NULL DEFAULT 'unverified',
  "imported_by" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "imported_at" timestamptz NOT NULL DEFAULT now(),
  "accessed_at" timestamptz,        -- last revisit for staleness checks
  "archived_at" timestamptz,        -- soft delete
  "notes_markdown" text,            -- user-written notes (optional)
  -- soft FK to citation when source has been resolved as a citeable work.
  "citation_id" text REFERENCES "citation"("id") ON DELETE SET NULL
);

CREATE INDEX "source_kind_idx" ON "source" ("kind");
CREATE INDEX "source_imported_by_idx" ON "source" ("imported_by", "imported_at" DESC);
CREATE INDEX "source_citation_idx" ON "source" ("citation_id");
CREATE INDEX "source_hash_idx" ON "source" ("bytes_hash_sha256");
CREATE INDEX "source_active_idx" ON "source" ("imported_by") WHERE "archived_at" IS NULL;

-- ============================================================
-- source_extraction — AI 抽取暂存表（staging）
-- ============================================================
CREATE TABLE "source_extraction" (
  "id" text PRIMARY KEY,
  "source_id" text NOT NULL REFERENCES "source"("id") ON DELETE CASCADE,
  "kind" "extraction_kind" NOT NULL,
  "text" text NOT NULL,             -- AI-suggested claim/evidence/question text
  "excerpt" text,                   -- 来自 source raw_text 的原文片段
  "excerpt_offset" integer,         -- char offset in raw_text，方便高亮
  "excerpt_length" integer,
  "status" "extraction_status" NOT NULL DEFAULT 'ai-suggested',
  -- 当 status='user-accepted' / 'user-modified' 时，链到 main 表的
  -- 真实对象（claim_id / evidence_id），便于 UI "you accepted this"
  -- 的回链显示。
  "promoted_claim_id" text REFERENCES "claim"("id") ON DELETE SET NULL,
  "promoted_evidence_id" text REFERENCES "evidence"("id") ON DELETE SET NULL,
  "promoted_thread_id" text REFERENCES "annotation_thread"("id") ON DELETE SET NULL,
  "agent_principal_id" text REFERENCES "principal"("id") ON DELETE SET NULL,
  "extracted_at" timestamptz NOT NULL DEFAULT now(),
  "decided_at" timestamptz,         -- 用户决定接/改/拒的时间
  "decided_by" text REFERENCES "principal"("id") ON DELETE SET NULL,
  "decision_note" text,             -- 用户备注（可选）
  -- 原始 AI 提案 + 元数据（modelId / promptHash 等）；用于改 prompt 后回看
  "ai_metadata" jsonb,

  -- 互斥：每个 extraction 最多链一个 promoted target（kind 与 promoted_*
  -- 一致；CHECK 在应用层而非 PG 因 enum-to-FK 关系约束太复杂）
  CONSTRAINT "source_extraction_decision_consistency_chk" CHECK (
    ("status" IN ('ai-suggested', 'rejected')
     AND "promoted_claim_id" IS NULL
     AND "promoted_evidence_id" IS NULL
     AND "promoted_thread_id" IS NULL)
    OR
    ("status" IN ('user-accepted', 'user-modified')
     AND (
       ("kind" = 'claim' AND "promoted_claim_id" IS NOT NULL)
       OR ("kind" = 'evidence' AND "promoted_evidence_id" IS NOT NULL)
       OR ("kind" = 'question' AND "promoted_thread_id" IS NOT NULL)
     ))
  )
);

CREATE INDEX "source_extraction_source_idx" ON "source_extraction" ("source_id", "kind");
CREATE INDEX "source_extraction_status_idx" ON "source_extraction" ("status");
CREATE INDEX "source_extraction_pending_idx"
  ON "source_extraction" ("source_id")
  WHERE "status" = 'ai-suggested';
CREATE INDEX "source_extraction_promoted_claim_idx" ON "source_extraction" ("promoted_claim_id");
CREATE INDEX "source_extraction_promoted_evidence_idx" ON "source_extraction" ("promoted_evidence_id");
