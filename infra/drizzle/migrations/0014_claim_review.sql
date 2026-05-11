-- Phase 5 Wave B B1 — ADR-0016 Claim-on-Claim Review.
--
-- claim 级评审：每条 claim 都能追溯它被哪些 ORCID 实体 endorse /
-- challenge / refine。verdict 不变量 + ORCID-signed payload 复用
-- ADR-0015 §2.2 JWS pattern；withdraw 仅 mark（与 ADR-0015 review
-- 表对称）。
--
-- 5 年差异化锚点核心 schema。
--
-- 1 enum + 1 新表 + 4 索引；现有 claim / evidence / provenance 表
-- 不动。soft FK to evidence (evidence_refs text[]) 因 PG 弱支持 FK
-- 数组；maintenance scan 第 8 类 finding 兜底悬空引用（Wave D 实施）。

-- ============================================================
-- §1 verdict enum
-- ============================================================

CREATE TYPE "claim_review_verdict" AS ENUM (
  'endorses',     -- reviewer agrees with the claim
  'challenges',   -- reviewer disagrees (evidence_refs MUST be non-empty)
  'refines'       -- reviewer agrees in part; asks for scope tightening
);

-- ============================================================
-- §2 claim_review table
-- ============================================================

CREATE TABLE "claim_review" (
  "id" text PRIMARY KEY,                                                  -- uuidv7
  "claim_id" text NOT NULL REFERENCES "claim"("id") ON DELETE RESTRICT,
  "reviewer_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  -- nullable when AI verdict or human reviewer who hasn't linked ORCID yet
  "reviewer_orcid_id" text,
  "is_ai_verdict" boolean NOT NULL DEFAULT false,
  "verdict" "claim_review_verdict" NOT NULL,
  "body_markdown" text NOT NULL,                                          -- reasoning; required
  -- evidence references — soft FK (PG arrays don't support FK constraints).
  -- Service layer validates ids exist; maintenance scan flags dangling refs.
  "evidence_refs" text[] NOT NULL DEFAULT '{}',
  -- ORCID detached signature (mirrors ADR-0015 §2.2 review.signed_payload_jws)
  "signed_payload_jws" text,
  "orcid_signed_at" timestamptz,
  "signature_verified_at" timestamptz,
  "signature_algorithm" text,                                             -- 'RS256' typical
  -- Provenance audit (ADR-0001 §2.3.7) — required because every claim_review
  -- is itself a contribution-shaped action. provenance row records the actor
  -- principal + agentContext (when AI) + toolCalls (when ORCID-sign).
  "provenance_id" text NOT NULL REFERENCES "provenance"("id") ON DELETE RESTRICT,
  -- Lifecycle
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz,                                             -- mark, never DELETE
  "withdrawn_reason" text,
  -- Phase 6 forward compat — sub-verdict meta ("endorses with caveat",
  -- "challenges methodology only", "refines scope"). Empty for Phase 5.
  "verdict_meta" jsonb,

  -- Invariants enforced both at DB level (CHECK) and service layer.
  -- CHECK constraints catch raw INSERT bugs; service layer gives nicer
  -- API errors before reaching DB.
  CONSTRAINT "claim_review_challenges_evidence_chk" CHECK (
    "verdict" <> 'challenges'
    OR (array_length("evidence_refs", 1) IS NOT NULL AND array_length("evidence_refs", 1) >= 1)
  ),
  CONSTRAINT "claim_review_ai_no_orcid_chk" CHECK (
    NOT "is_ai_verdict"
    OR ("reviewer_orcid_id" IS NULL AND "signed_payload_jws" IS NULL)
  ),
  CONSTRAINT "claim_review_signed_requires_orcid_chk" CHECK (
    "signed_payload_jws" IS NULL
    OR ("reviewer_orcid_id" IS NOT NULL AND "orcid_signed_at" IS NOT NULL)
  )
);

-- ============================================================
-- §3 indexes
-- ============================================================

-- Hot path: aggregate verdict buckets for a claim's lineage view.
CREATE INDEX "claim_review_claim_verdict_idx"
  ON "claim_review" ("claim_id", "verdict")
  WHERE "withdrawn_at" IS NULL;

-- Reviewer Inbox dashboard — list reviewer's own verdicts in time order.
CREATE INDEX "claim_review_reviewer_idx"
  ON "claim_review" ("reviewer_principal_id", "submitted_at" DESC);

-- ORCID iD lookup for cross-paper reviewer history.
CREATE INDEX "claim_review_orcid_idx"
  ON "claim_review" ("reviewer_orcid_id")
  WHERE "reviewer_orcid_id" IS NOT NULL;

-- Provenance back-link for audit trails.
CREATE INDEX "claim_review_provenance_idx"
  ON "claim_review" ("provenance_id");
