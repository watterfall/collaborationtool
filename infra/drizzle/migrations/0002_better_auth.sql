-- Phase 1 D9: better-auth identity layer.
--
-- These tables are owned by better-auth (via its Drizzle adapter). The
-- application code NEVER inserts into them directly — better-auth's API
-- (signUpEmail, signInEmail, organization.create, ...) is the single
-- entry point. Our `principal-bridge` listens to better-auth lifecycle
-- hooks and writes corresponding rows into the `principal` table from D7.
--
-- This separation keeps "identity provider" (better-auth) decoupled from
-- "authority abstraction" (Principal) per ADR-0002 §2.3 — better-auth
-- could be swapped for Auth.js later without touching capability /
-- gateway code; only the bridge changes.

-- ============================================================
-- user
-- ============================================================

CREATE TABLE "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "user_email_uniq" ON "user" ("email");

-- ============================================================
-- session
-- ============================================================

CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "active_organization_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "session_token_uniq" ON "session" ("token");
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");
CREATE INDEX "session_expires_at_idx" ON "session" ("expires_at");

-- ============================================================
-- account (OAuth providers + email/password credential)
-- ============================================================

CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "account_user_id_idx" ON "account" ("user_id");
CREATE UNIQUE INDEX "account_provider_account_uniq"
  ON "account" ("provider_id", "account_id");

-- ============================================================
-- verification (email verify / password reset tokens)
-- ============================================================

CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");

-- ============================================================
-- organization plugin tables
-- ============================================================

CREATE TABLE "organization" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "metadata" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "organization_slug_uniq" ON "organization" ("slug");

CREATE TABLE "member" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "member_org_idx" ON "member" ("organization_id");
CREATE INDEX "member_user_idx" ON "member" ("user_id");
CREATE UNIQUE INDEX "member_user_org_uniq"
  ON "member" ("user_id", "organization_id");

CREATE TABLE "invitation" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization" ("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text,
  "status" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "inviter_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX "invitation_org_idx" ON "invitation" ("organization_id");
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");
