-- Phase 2 W5 ADR-0011: Claim / Evidence 一等知识对象层。
--
-- 3 张新表 + 3 个 enum，承载 essay §15 的 :::claim::: / :::evidence:::
-- / counterpoint / synthesis 语义。counterpoint / synthesis 是 claim
-- 的 claim_type 子类型，不是独立表（per ADR-0011 §2.1+§4.4）。
--
-- claim/evidence 的 text/excerpt 是权威数据；Y.Doc 内 PM block 持有
-- attrs.claimId / attrs.evidenceId 作为索引。PM body 里的文本是
-- denormalised cache，不一致时以 PG 为准（ADR-0011 §2.3）。
--
-- W7 dogfood gate：Evidence Map demo（GET /api/document/<id>/evidence-map
-- 返回 claim/evidence/claim_link 全集 + cross-doc reuse）+ AI context
-- pack export（GET /api/document/<id>/export?format=ai-context-pack）
-- 必须可用，否则 ADR-0011 §7 review log 记 fail，停下来重新设计。

CREATE TYPE "claim_type" AS ENUM ('main', 'counter', 'synthesis');

CREATE TYPE "claim_status" AS ENUM (
  'ai-suggested',
  'human-reviewed',
  'approved',
  'deprecated',
  'superseded'
);

CREATE TYPE "claim_confidence" AS ENUM ('low', 'medium', 'high');

CREATE TYPE "evidence_relation" AS ENUM ('supports', 'challenges', 'qualifies');

CREATE TYPE "claim_link_type" AS ENUM (
  'derives-from',
  'synthesizes',
  'contradicts',
  'refines'
);

-- ============================================================
-- claim — 全局对象（类比 citation），跨文档可复用。
-- text 字段是权威；PM body 内 paragraph 子树是 denormalised cache。
-- ============================================================
CREATE TABLE "claim" (
  "id" text PRIMARY KEY,
  "text" text NOT NULL,
  "claim_type" "claim_type" NOT NULL DEFAULT 'main',
  "status" "claim_status" NOT NULL DEFAULT 'ai-suggested',
  "confidence" "claim_confidence" NOT NULL DEFAULT 'medium',
  "document_origin_id" text REFERENCES "document"("id") ON DELETE SET NULL,
  "created_by" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "reviewed_at" timestamptz,
  "reviewed_by" text REFERENCES "principal"("id") ON DELETE SET NULL,
  "deprecated_at" timestamptz,
  "superseded_by_claim_id" text REFERENCES "claim"("id") ON DELETE SET NULL,

  CONSTRAINT "claim_supersession_chk" CHECK (
    ("status" = 'superseded' AND "superseded_by_claim_id" IS NOT NULL)
    OR ("status" <> 'superseded')
  )
);

CREATE INDEX "claim_status_idx" ON "claim" ("status");
CREATE INDEX "claim_origin_idx" ON "claim" ("document_origin_id");
CREATE INDEX "claim_type_idx" ON "claim" ("claim_type");
CREATE INDEX "claim_active_idx"
  ON "claim" ("status")
  WHERE "status" IN ('approved', 'human-reviewed');

-- ============================================================
-- evidence — 全局对象，每条支持/反驳/限定一个 claim。
-- 资料源通过 citation_id 软外键关联（可 NULL：未关联 source 的临时
-- evidence）。
-- ============================================================
CREATE TABLE "evidence" (
  "id" text PRIMARY KEY,
  "excerpt" text NOT NULL,
  "supports_claim_id" text NOT NULL REFERENCES "claim"("id") ON DELETE CASCADE,
  "citation_id" text REFERENCES "citation"("id") ON DELETE SET NULL,
  "relation" "evidence_relation" NOT NULL DEFAULT 'supports',
  "status" "claim_status" NOT NULL DEFAULT 'ai-suggested',
  "document_origin_id" text REFERENCES "document"("id") ON DELETE SET NULL,
  "created_by" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "evidence_claim_idx" ON "evidence" ("supports_claim_id");
CREATE INDEX "evidence_citation_idx" ON "evidence" ("citation_id");
CREATE INDEX "evidence_relation_idx" ON "evidence" ("relation");
CREATE INDEX "evidence_origin_idx" ON "evidence" ("document_origin_id");

-- ============================================================
-- claim_link — claim ↔ claim 关系。synthesis / 组合论证用得到。
-- ============================================================
CREATE TABLE "claim_link" (
  "id" text PRIMARY KEY,
  "from_claim_id" text NOT NULL REFERENCES "claim"("id") ON DELETE CASCADE,
  "to_claim_id" text NOT NULL REFERENCES "claim"("id") ON DELETE CASCADE,
  "link_type" "claim_link_type" NOT NULL,
  "created_by" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "claim_link_no_self" CHECK ("from_claim_id" <> "to_claim_id"),
  CONSTRAINT "claim_link_uniq" UNIQUE ("from_claim_id", "to_claim_id", "link_type")
);

CREATE INDEX "claim_link_from_idx" ON "claim_link" ("from_claim_id");
CREATE INDEX "claim_link_to_idx" ON "claim_link" ("to_claim_id");
CREATE INDEX "claim_link_type_idx" ON "claim_link" ("link_type");
