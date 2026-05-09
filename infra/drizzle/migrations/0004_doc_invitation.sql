-- Phase 1.5 #1: per-document invitation flow.
--
-- Replaces the "owner runs SQL INSERT into document_acl" workaround
-- documented in USER_GUIDE.md §1.3 (Phase 1 stop-gap). The owner
-- creates an invitation row scoped to (document_id, email, role_id);
-- the invitee accepts by clicking the link, which materialises the
-- document_acl row via packages/permissions.materialiseRoleBundle.
--
-- Email match is required at accept time — only the user whose
-- session.email equals the invitation.email can accept. This gates
-- accidental token sharing without giving up the share-by-link UX.

CREATE TABLE "doc_invitation" (
  "id" text PRIMARY KEY,
  "document_id" uuid NOT NULL REFERENCES "document"("id") ON DELETE CASCADE,
  "inviter_principal_id" text NOT NULL REFERENCES "principal"("id") ON DELETE RESTRICT,
  "email" text NOT NULL,
  "role_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',  -- pending | accepted | revoked | expired
  "expires_at" timestamptz NOT NULL,
  "accepted_by_principal_id" text REFERENCES "principal"("id"),
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "doc_invitation_document_idx"
  ON "doc_invitation" ("document_id", "status");

CREATE INDEX "doc_invitation_email_idx"
  ON "doc_invitation" (lower("email"));

CREATE UNIQUE INDEX "doc_invitation_pending_uniq"
  ON "doc_invitation" ("document_id", lower("email"))
  WHERE "status" = 'pending';
