-- Phase 4 W5-W6 ADR-0014: Yjs subdocument 章节级拆分 + cross-reference sync.
--
-- Backend "启动" 落地 4 件事，让 W5-W6 dogfood gate（50 客户端 stress +
-- cross-doc reference 真同步 + subdocument-level ACL 真生效）能开始 wire 实施：
--
--   1. subdocument 表（root 内章节级 Y.Doc 单元）
--   2. crossref_index 表（root crossRefs Y.Map 的 PG 镜像；search/maintenance scan 用）
--   3. block_metadata.subdocument_id（block 归属 subdoc 软外键）
--   4. document_acl 重构 PK + subdocument_id（subdoc-级 ACL）
--   5. capability_resource_type 加 'subdocument' enum 第三档
--
-- Y.Doc 是 source of truth（ADR-0014 §2.6）；PG 行作 dump / 索引镜像。
-- Sync gateway 重路由 + 真 multi-doc 挂载 + 50 客户端 stress 推 W5-W6 dogfood gate。

-- ============================================================
-- 1. subdocument
-- ============================================================

CREATE TABLE "subdocument" (
  "id" text PRIMARY KEY,                    -- subdoc:<uuidv7>
  "root_document_id" text NOT NULL
    REFERENCES "document"("id") ON DELETE CASCADE,
  -- 嵌套支持（ADR-0014 §3.3 long debt：本期不实施 subdoc-of-subdoc，但
  -- 字段保留以避免 Phase 5 再 ALTER）
  "parent_subdocument_id" text
    REFERENCES "subdocument"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  -- root 内排序；ADR-0014 §5 open question：拖动重排是否触发 root snapshot
  -- 重建 → 倾向是 + 30s 节流，仍待 dogfood 验证
  "ord" integer NOT NULL,
  -- y-sweet 端独立 doc 名（global-unique，y-sweet 看作独立 doc）
  "ysweet_doc_name" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);

CREATE INDEX "subdocument_root_idx"
  ON "subdocument" ("root_document_id", "ord");

-- ============================================================
-- 2. crossref_index — root crossRefs Y.Map 的 PG 镜像
--    Y.Map 仍是 source of truth；本表用于：
--      - maintenance scan: 找 broken-citation / unsupported-claim
--        across subdocs 时不必加载所有 subdoc Y.Doc
--      - search: full-text 搜索 figure-id / claim-id 出现位置
--      - dump / backup
--    写时机：subdoc transaction 落 + snapshot-worker 增量同步本表
-- ============================================================

CREATE TABLE "crossref_index" (
  "id" text PRIMARY KEY,                    -- crossref:<uuidv7>
  "root_document_id" text NOT NULL
    REFERENCES "document"("id") ON DELETE CASCADE,
  -- 'figure' | 'citation' | 'claim' | 'evidence'
  -- 不用 enum：Phase 5 可能加 'dataset' / 'computational-output'，避免频繁
  -- ALTER TYPE
  "ref_kind" text NOT NULL,
  -- e.g. figure-id, claim-id, citation-id —— 指向 Y.Doc atom node attr 或
  -- PG 全局表行
  "ref_target_id" text NOT NULL,
  "source_subdocument_id" text
    REFERENCES "subdocument"("id") ON DELETE CASCADE,
  -- block_id 不加 FK（block_metadata 是 denormalised cache）
  "source_block_id" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "crossref_index_root_kind_idx"
  ON "crossref_index" ("root_document_id", "ref_kind");
CREATE INDEX "crossref_index_target_idx"
  ON "crossref_index" ("ref_target_id");
CREATE UNIQUE INDEX "crossref_index_uniq"
  ON "crossref_index" (
    "root_document_id",
    "ref_kind",
    "ref_target_id",
    "source_subdocument_id",
    "source_block_id"
  )
  NULLS NOT DISTINCT;  -- root-scope refs (no subdoc) still need uniqueness

-- ============================================================
-- 3. block_metadata.subdocument_id
--    block 归属哪个 subdoc 的索引；nullable = root 直挂（preamble / 未拆）
-- ============================================================

ALTER TABLE "block_metadata"
  ADD COLUMN "subdocument_id" text
    REFERENCES "subdocument"("id") ON DELETE SET NULL;

CREATE INDEX "block_metadata_subdocument_idx"
  ON "block_metadata" ("subdocument_id");

-- ============================================================
-- 4. document_acl 重构：加 id PK + subdocument_id 列
--    既有复合 PK (document_id, principal_id) 升级为 surrogate id，
--    支持同 (document_id, principal_id) 在不同 subdoc 上独立授权。
--    null subdocument_id = root scope（向后兼容既有行）。
-- ============================================================

-- 1) 加 surrogate id（先 nullable，回填后再 SET NOT NULL）
ALTER TABLE "document_acl"
  ADD COLUMN "id" text;

-- 2) 回填 id（既有行：document_id + principal_id 拼字符串保稳定）
UPDATE "document_acl"
  SET "id" = 'acl:' || "document_id" || ':' || "principal_id"
  WHERE "id" IS NULL;

ALTER TABLE "document_acl"
  ALTER COLUMN "id" SET NOT NULL;

-- 3) 切 PK：先 drop 既有 PK，再加 (id) PK
ALTER TABLE "document_acl"
  DROP CONSTRAINT IF EXISTS "document_acl_pkey";
ALTER TABLE "document_acl"
  ADD CONSTRAINT "document_acl_pkey" PRIMARY KEY ("id");

-- 4) 加 subdocument_id 列
ALTER TABLE "document_acl"
  ADD COLUMN "subdocument_id" text
    REFERENCES "subdocument"("id") ON DELETE CASCADE;

-- 5) 唯一性：(document_id, principal_id, subdocument_id) NULLS NOT DISTINCT
--    PG 15+ 允许多 NULL 视为相等；root-scope 行 (subdocument_id IS NULL)
--    保证 (doc, principal) 维度仍唯一。
CREATE UNIQUE INDEX "document_acl_doc_principal_subdoc_uniq"
  ON "document_acl" ("document_id", "principal_id", "subdocument_id")
  NULLS NOT DISTINCT;

CREATE INDEX "document_acl_subdocument_idx"
  ON "document_acl" ("subdocument_id");

-- ============================================================
-- 5. capability_resource_type enum 加 'subdocument' 第五档
--    既有 4 档：document / block / thread / global。subdocument 在
--    document 与 block 之间，匹配作者"章节"心智模型（ADR-0014 §2.4）。
--    capability_grant.resource_type = 'subdocument' 时 resource_id 是
--    subdocument.id；既有 CHECK 兼容（resource_type <> 'global' AND
--    resource_id IS NOT NULL）。
-- ============================================================

ALTER TYPE "capability_resource_type" ADD VALUE 'subdocument';
