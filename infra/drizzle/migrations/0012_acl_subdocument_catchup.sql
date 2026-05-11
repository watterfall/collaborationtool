-- Phase 4.5 W0 follow-up: catch-up for migration 0011 partial application.
--
-- 背景：在某些本地数据库上，migration 0011 的 §3-§5 三段未实际执行，但
-- `_drizzle_migrations` 表已记录 0011 为 applied（症状：document_acl 表只有
-- 老 (document_id, principal_id) 复合 PK，没有 id / subdocument_id 列；
-- block_metadata 没有 subdocument_id 列；capability_resource_type enum 只有
-- 4 档 document / block / thread / global，缺 subdocument 第五档）。
--
-- 本 migration 用幂等 SQL 把 0011 §3-§5 缺的状态补齐，不重复创建 §1
-- subdocument 表与 §2 crossref_index 表（这两段已经成功执行）。
--
-- 修复触发条件（per row 检测）：
--   - block_metadata 列缺 → 加列 + 加 FK + 加索引
--   - document_acl 列缺 → 加列 + 回填 + 切 PK + 加唯一索引
--   - enum 缺 'subdocument' → 加 enum 值
--
-- 已经应用过 0011 全部内容的数据库（CI / 全新初始化）：本 migration 全部
-- 子句的 IF EXISTS / IF NOT EXISTS 检测会安全跳过，0 行变更。

-- ============================================================
-- §3 block_metadata.subdocument_id（幂等）
-- ============================================================

ALTER TABLE "block_metadata"
  ADD COLUMN IF NOT EXISTS "subdocument_id" text;

-- FK 与索引：用 DO 块在缺失时才加（PG ALTER TABLE ADD CONSTRAINT 没有
-- IF NOT EXISTS 语法）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'block_metadata_subdocument_id_fkey'
  ) THEN
    ALTER TABLE "block_metadata"
      ADD CONSTRAINT "block_metadata_subdocument_id_fkey"
      FOREIGN KEY ("subdocument_id")
      REFERENCES "subdocument"("id")
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "block_metadata_subdocument_idx"
  ON "block_metadata" ("subdocument_id");

-- ============================================================
-- §4 document_acl 重构（幂等）
-- ============================================================

-- 1) 加 id 列（先 nullable）
ALTER TABLE "document_acl"
  ADD COLUMN IF NOT EXISTS "id" text;

-- 2) 回填 id（既有行 + 任何后续无 id 的行都会被覆盖）
UPDATE "document_acl"
  SET "id" = 'acl:' || "document_id" || ':' || "principal_id"
  WHERE "id" IS NULL;

-- 3) id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_acl'
      AND column_name = 'id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "document_acl" ALTER COLUMN "id" SET NOT NULL;
  END IF;
END$$;

-- 4) 切 PK：drop 老 PK，加 (id) PK
DO $$
DECLARE
  current_pk_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO current_pk_def
    FROM pg_constraint
    WHERE conname = 'document_acl_pkey';

  -- 老 PK = (document_id, principal_id)；新 PK = (id)。
  -- 仅当当前 PK 不是 (id) 时才切。
  IF current_pk_def IS NULL OR current_pk_def NOT LIKE '%PRIMARY KEY (id)%' THEN
    -- 老 PK 同名 document_acl_pkey，DROP 再加 (id) PK
    ALTER TABLE "document_acl" DROP CONSTRAINT IF EXISTS "document_acl_pkey";
    ALTER TABLE "document_acl"
      ADD CONSTRAINT "document_acl_pkey" PRIMARY KEY ("id");
  END IF;
END$$;

-- 5) 加 subdocument_id 列 + FK
ALTER TABLE "document_acl"
  ADD COLUMN IF NOT EXISTS "subdocument_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_acl_subdocument_id_fkey'
  ) THEN
    ALTER TABLE "document_acl"
      ADD CONSTRAINT "document_acl_subdocument_id_fkey"
      FOREIGN KEY ("subdocument_id")
      REFERENCES "subdocument"("id")
      ON DELETE CASCADE;
  END IF;
END$$;

-- 6) 唯一索引 + subdocument 索引（NULLS NOT DISTINCT 要求 PG 15+；
--    既有项目 docker-compose pin postgres 16 — ok）
CREATE UNIQUE INDEX IF NOT EXISTS "document_acl_doc_principal_subdoc_uniq"
  ON "document_acl" ("document_id", "principal_id", "subdocument_id")
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS "document_acl_subdocument_idx"
  ON "document_acl" ("subdocument_id");

-- ============================================================
-- §5 capability_resource_type enum 加 'subdocument'（幂等）
-- ============================================================

-- ADD VALUE 不能直接 IF NOT EXISTS（PG 12+ 有 ADD VALUE IF NOT EXISTS 语法，
-- 但需要确认 docker-compose 的 postgres 版本支持）。docker-compose 用
-- postgres:16 — 支持。
ALTER TYPE "capability_resource_type" ADD VALUE IF NOT EXISTS 'subdocument';
