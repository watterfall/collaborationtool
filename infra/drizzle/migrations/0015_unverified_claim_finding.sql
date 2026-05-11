-- Phase 5 Wave B B4 — ADR-0016 §2.6: maintenance scan 第 7 类 finding.
--
-- `unverified-claim`: claim has no endorsing human-ORCID review > 30 days
-- AND every provenance row in its history has actor_kind='agent'. The
-- finding tells the author "this claim was written by AI and nobody
-- with a name has stood behind it yet" — a signal to actively recruit
-- a reviewer rather than wait passively.
--
-- SQL-pure: no LLM, no network. Joins:
--   claim → claim_review (filter verdict='endorses' AND
--                          is_ai_verdict=false AND withdrawn_at IS NULL)
--   claim → contribution → provenance (require every actor_kind='agent')
--
-- Severity = 'medium' (informational, but should be actioned within
-- the dogfood cycle).

-- PG 12+ supports ADD VALUE IF NOT EXISTS — docker-compose pins 16.
ALTER TYPE "finding_kind" ADD VALUE IF NOT EXISTS 'unverified-claim';
