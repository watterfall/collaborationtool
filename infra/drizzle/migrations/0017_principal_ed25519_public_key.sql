-- Phase 6 W3 — ADR-0018 strict open-content signatures.
--
-- Store each principal's Ed25519 public key so Merkle-linked open
-- content can be verified server-side without requiring callers to
-- resubmit the key on every publish. Values use the canonical
-- `ed25519:<64 hex>` text form from @collaborationtool/identity.

ALTER TABLE "principal"
  ADD COLUMN "ed25519_public_key" text;

CREATE UNIQUE INDEX "principal_ed25519_public_key_uniq"
  ON "principal" ("ed25519_public_key");
