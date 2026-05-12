-- Phase 6 W2 P2 — ADR-0018 Open Content Mechanisms.
--
-- 4 first-class open entity tables + 1 append-only Merkle-signed
-- provenance chain. Substrate for web open-content feed (open question
-- → stranger reply → owner accept), DOI minting (Phase 6 W8), public
-- peer review with ORCID signature.
--
-- Crypto contract:
--   - Every entity row carries a non-null signed_payload_jws (detached
--     JWS over canonical-JSON content per RFC 7515)
--   - Every entity row references provenance_merkle_log via
--     merkle_log_entry_id (anti-tamper chain)
--   - withdrawn_at is mark-only (no DELETE; supersede pattern for edits)
--
-- DeSCI 去区块链 (per spec §1 Q4) — no on-chain references; Merkle log
-- lives entirely in PG; third-party verifies via SQL dump + signature
-- check; user identity is ed25519 keypair + ORCID iD, not wallet.

-- ============================================================
-- §1 enum: open_peer_review_target_kind
-- ============================================================

CREATE TYPE "open_peer_review_target_kind" AS ENUM (
  'question',   -- targets open_question
  'dataset',    -- targets open_dataset
  'snapshot'    -- targets share_snapshot (section/preprint/etc)
);

-- ============================================================
-- §2 provenance_merkle_log — append-only signed chain
-- ============================================================
--
-- Created BEFORE the 4 entity tables because they FK into it.
-- Anti-tamper: nightly verify-merkle-log.ts worker (Phase 6 W7) checks
--   (a) prev_entry_id chain integrity
--   (b) entry_seq monotonic
--   (c) content_hash matches stored payload
-- All three invariants together make in-place row tampering detectable.

CREATE TABLE "provenance_merkle_log" (
  "id" text PRIMARY KEY,                                                  -- uuidv7
  "prev_entry_id" text REFERENCES "provenance_merkle_log"("id") ON DELETE RESTRICT,  -- null for genesis
  "entry_seq" bigserial NOT NULL,                                         -- monotonic insert order
  -- Logical pointer back to the entity row this chain entry attests to.
  -- entity_kind picks one of the 4 entity tables (no DB-level FK because
  -- destination varies; service layer joins by (entity_kind, entity_id)).
  "entity_kind" text NOT NULL CHECK (entity_kind IN ('open_question','open_dataset','open_peer_review','share_snapshot')),
  "entity_id" text NOT NULL,
  "content_hash" bytea NOT NULL,                                          -- sha-256 of canonical entity JSON
  "signed_jws" text NOT NULL,                                             -- detached JWS by author's ed25519
  "signer_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "appended_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "provenance_merkle_log_entry_seq_idx" ON "provenance_merkle_log"("entry_seq");
CREATE INDEX "provenance_merkle_log_prev_idx" ON "provenance_merkle_log"("prev_entry_id");
CREATE INDEX "provenance_merkle_log_entity_idx" ON "provenance_merkle_log"("entity_kind","entity_id");
CREATE INDEX "provenance_merkle_log_signer_idx" ON "provenance_merkle_log"("signer_principal_id","appended_at");

-- ============================================================
-- §3 open_question — Open Question entity (spec §5 F7 lifecycle)
-- ============================================================
--
-- Asker publishes "I am stuck on X; help wanted". Stranger answers
-- via ORCID OAuth → open_peer_review with target_kind='question'.
-- Lifecycle: open → answered → withdrawn (mark-only).

CREATE TABLE "open_question" (
  "id" text PRIMARY KEY,                                                  -- uuidv7
  "asker_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "asker_orcid_id" text,                                                  -- nullable when asker hasn't linked ORCID
  "question_md" text NOT NULL,                                            -- markdown body of the ask
  "domain_tags" text[] NOT NULL DEFAULT '{}',                             -- topic tags for feed discovery
  "status" text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','withdrawn')),
  "source_subdoc_id" text REFERENCES "subdocument"("id") ON DELETE SET NULL,  -- if asker linked to a subdoc paragraph
  "signed_payload_jws" text NOT NULL,                                     -- detached JWS by asker's ed25519
  "merkle_log_entry_id" text NOT NULL REFERENCES "provenance_merkle_log"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz,
  "withdrawn_reason" text
);

CREATE INDEX "open_question_status_idx" ON "open_question"("status","created_at" DESC);
CREATE INDEX "open_question_asker_idx" ON "open_question"("asker_principal_id","created_at" DESC);
CREATE INDEX "open_question_orcid_idx" ON "open_question"("asker_orcid_id");
CREATE INDEX "open_question_merkle_idx" ON "open_question"("merkle_log_entry_id");

-- ============================================================
-- §4 open_dataset — Open Dataset entity
-- ============================================================
--
-- Datasets contributed to the open content corpus. blob_storage_ref
-- points to external storage (Software Heritage / Zenodo / S3 / etc);
-- this table holds metadata + signed provenance only.

CREATE TABLE "open_dataset" (
  "id" text PRIMARY KEY,                                                  -- uuidv7
  "contributor_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "dataset_doi" text,                                                     -- optional DOI (CrossRef Phase 6 W8)
  "title" text NOT NULL,
  "description_md" text NOT NULL,
  "blob_storage_ref" text NOT NULL,                                       -- e.g. "s3://bucket/sha256/abc...", "swh:1:cnt:..."
  "size_bytes" bigint NOT NULL,
  "license_spdx" text NOT NULL,                                           -- e.g. 'CC0-1.0', 'MIT', 'ODbL-1.0'
  "signed_payload_jws" text NOT NULL,
  "merkle_log_entry_id" text NOT NULL REFERENCES "provenance_merkle_log"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz,
  "withdrawn_reason" text
);

CREATE INDEX "open_dataset_contributor_idx" ON "open_dataset"("contributor_principal_id","created_at" DESC);
CREATE INDEX "open_dataset_doi_idx" ON "open_dataset"("dataset_doi");
CREATE INDEX "open_dataset_license_idx" ON "open_dataset"("license_spdx");
CREATE INDEX "open_dataset_merkle_idx" ON "open_dataset"("merkle_log_entry_id");

-- ============================================================
-- §5 open_peer_review — Public peer review entity
-- ============================================================
--
-- Distinct from ADR-0016 claim_review (per-document Day-layer);
-- open_peer_review is public-surface review across the 4 open entity
-- types. Reviewer MUST be ORCID-linked (no anonymous open peer review
-- in Merkle log; anonymous comments live in comment-store outside this
-- chain).

CREATE TABLE "open_peer_review" (
  "id" text PRIMARY KEY,                                                  -- uuidv7
  "reviewer_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "reviewer_orcid_id" text NOT NULL,                                      -- required for open peer review
  "target_kind" "open_peer_review_target_kind" NOT NULL,
  "target_id" text NOT NULL,                                              -- FK into open_question/dataset/share_snapshot (varies)
  "verdict" "claim_review_verdict" NOT NULL,                              -- reuse ADR-0016 enum: endorses/challenges/refines
  "body_md" text NOT NULL,
  "evidence_refs" text[] NOT NULL DEFAULT '{}',                           -- soft FK to evidence.id
  "signed_payload_jws" text NOT NULL,
  "merkle_log_entry_id" text NOT NULL REFERENCES "provenance_merkle_log"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz,
  "withdrawn_reason" text
);

CREATE INDEX "open_peer_review_target_idx" ON "open_peer_review"("target_kind","target_id");
CREATE INDEX "open_peer_review_reviewer_idx" ON "open_peer_review"("reviewer_principal_id","created_at" DESC);
CREATE INDEX "open_peer_review_orcid_idx" ON "open_peer_review"("reviewer_orcid_id");
CREATE INDEX "open_peer_review_verdict_idx" ON "open_peer_review"("verdict","target_kind");
CREATE INDEX "open_peer_review_merkle_idx" ON "open_peer_review"("merkle_log_entry_id");

-- ============================================================
-- §6 share_snapshot — Publishable snapshot of a subdoc/section/preprint
-- ============================================================
--
-- Result of F4 publish flow (spec §5). Author's desktop emits markdown
-- + Y.Doc binary + Merkle entry signed by ed25519; server validates
-- signature + writes here. permalink_hash is the user-facing URL slug
-- (sha256 of canonical content, truncated).

CREATE TABLE "share_snapshot" (
  "id" text PRIMARY KEY,                                                  -- uuidv7
  "source_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "source_subdoc_id" text REFERENCES "subdocument"("id") ON DELETE SET NULL,
  "markdown_content" text NOT NULL,
  "yjs_binary" bytea NOT NULL,
  "kind" text NOT NULL CHECK (kind IN ('section','preprint','dataset')),
  "permalink_hash" text NOT NULL UNIQUE,                                  -- e.g. "a3f9b2..." (first 16 hex chars of sha256)
  "doi" text UNIQUE,                                                      -- optional, CrossRef Phase 6 W8
  "signed_payload_jws" text NOT NULL,
  "merkle_log_entry_id" text NOT NULL REFERENCES "provenance_merkle_log"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz,
  "withdrawn_reason" text,
  -- Supersede pointer for the "edit = new row" pattern.
  "supersedes_snapshot_id" text REFERENCES "share_snapshot"("id") ON DELETE SET NULL
);

CREATE INDEX "share_snapshot_kind_idx" ON "share_snapshot"("kind","created_at" DESC);
CREATE INDEX "share_snapshot_source_idx" ON "share_snapshot"("source_principal_id","created_at" DESC);
CREATE INDEX "share_snapshot_supersedes_idx" ON "share_snapshot"("supersedes_snapshot_id");
CREATE INDEX "share_snapshot_merkle_idx" ON "share_snapshot"("merkle_log_entry_id");
