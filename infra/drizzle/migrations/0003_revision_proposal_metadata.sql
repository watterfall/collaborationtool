-- Phase 1 D14: revision proposal metadata.
--
-- Adds a structured jsonb column to `revision` that captures the
-- AgentProposal shape produced by ai-runtime — `revisedFragments[]`
-- and `uncertainties[]`. The approval flow UI reads this to surface
-- before/after text + uncertainty markers without having to deserialize
-- the PM steps binary.
--
-- The column is nullable so user-typed (non-agent) revisions don't
-- have to populate it.

ALTER TABLE "revision"
  ADD COLUMN "proposal_metadata" jsonb;

CREATE INDEX "revision_status_document_idx"
  ON "revision" ("document_id", "status");
