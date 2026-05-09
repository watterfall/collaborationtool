// Principal bridge — turns identity-provider events (user / org create,
// user / org revoke) into rows in the `principal` table.
//
// Phase 1 callers:
//   - apps/web — wires better-auth `databaseHooks` to these functions
//   - CLI fixtures / dev seed — calls `createUserPrincipal` directly
//
// Design rule: this module knows ONLY about (userId, displayName) and
// (orgId, name) tuples. It does NOT import better-auth types — that
// keeps Phase 2 swap to Auth.js (or anything else) a one-file change.
//
// Phase 1.5 extension points:
//   - audit log row alongside the principal write
//   - emit a domain event so y-sweet / sync-gateway can warm caches

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import {
  schema,
  type DbExecutor,
} from '@collaborationtool/drizzle';
import type { PrincipalId } from '@collaborationtool/schema';

export interface CreateUserPrincipalInput {
  /** better-auth's user id (or whatever your identity provider issues). */
  userId: string;
  displayName: string;
}

export interface CreateOrgPrincipalInput {
  /** better-auth organization id. */
  orgId: string;
  displayName: string;
}

export interface BridgeResult {
  principalId: PrincipalId;
  /** True when a row was inserted; false when the FK already existed. */
  created: boolean;
}

/**
 * Idempotent: if a principal already maps to this userId, return its id
 * and `created=false`. Otherwise insert a new `user:<uuidv7>` principal
 * and return `created=true`.
 *
 * Wrap in a transaction together with whatever other rows you write —
 * the bridge does NOT manage tx for you (it's just an INSERT).
 */
export async function createUserPrincipal(
  db: DbExecutor,
  input: CreateUserPrincipalInput,
): Promise<BridgeResult> {
  const existing = await db
    .select({ id: schema.principal.id })
    .from(schema.principal)
    .where(eq(schema.principal.userId, input.userId))
    .limit(1);

  if (existing.length > 0) {
    return { principalId: existing[0]!.id as PrincipalId, created: false };
  }

  const principalId = `user:${uuidv7()}` as PrincipalId;
  await db.insert(schema.principal).values({
    id: principalId,
    kind: 'user',
    displayName: input.displayName,
    userId: input.userId,
  });
  return { principalId, created: true };
}

/**
 * Idempotent counterpart for organizations. Org principals get the
 * 'org:' prefix per ADR-0002 §2.3 (we extended the kind enum in
 * migration 0001; the better-auth bridge is the canonical writer).
 */
export async function createOrgPrincipal(
  db: DbExecutor,
  input: CreateOrgPrincipalInput,
): Promise<BridgeResult> {
  const existing = await db
    .select({ id: schema.principal.id })
    .from(schema.principal)
    .where(eq(schema.principal.orgId, input.orgId))
    .limit(1);

  if (existing.length > 0) {
    return { principalId: existing[0]!.id as PrincipalId, created: false };
  }

  const principalId = `org:${uuidv7()}` as PrincipalId;
  await db.insert(schema.principal).values({
    id: principalId,
    kind: 'org',
    displayName: input.displayName,
    orgId: input.orgId,
  });
  return { principalId, created: true };
}

/**
 * Soft-revoke: sets `revoked_at`. We never DELETE principal rows because
 * downstream tables (provenance, contribution, capability_grant) hold
 * FKs and represent historical truth — a revoked user's past
 * contributions remain attributed.
 */
export async function revokeUserPrincipal(
  db: DbExecutor,
  userId: string,
  at: Date = new Date(),
): Promise<{ revoked: boolean }> {
  const found = await db
    .select({ id: schema.principal.id })
    .from(schema.principal)
    .where(eq(schema.principal.userId, userId))
    .limit(1);
  if (found.length === 0) return { revoked: false };

  await db
    .update(schema.principal)
    .set({ revokedAt: at })
    .where(eq(schema.principal.userId, userId));
  return { revoked: true };
}

export async function revokeOrgPrincipal(
  db: DbExecutor,
  orgId: string,
  at: Date = new Date(),
): Promise<{ revoked: boolean }> {
  const found = await db
    .select({ id: schema.principal.id })
    .from(schema.principal)
    .where(eq(schema.principal.orgId, orgId))
    .limit(1);
  if (found.length === 0) return { revoked: false };

  await db
    .update(schema.principal)
    .set({ revokedAt: at })
    .where(eq(schema.principal.orgId, orgId));
  return { revoked: true };
}

/**
 * Lookup helpers for the gateway / app code that needs to translate
 * between identity-provider id and PrincipalId.
 */
export async function findPrincipalIdByUserId(
  db: DbExecutor,
  userId: string,
): Promise<PrincipalId | null> {
  const rows = await db
    .select({ id: schema.principal.id })
    .from(schema.principal)
    .where(eq(schema.principal.userId, userId))
    .limit(1);
  return rows.length === 0 ? null : (rows[0]!.id as PrincipalId);
}

export async function findPrincipalIdByOrgId(
  db: DbExecutor,
  orgId: string,
): Promise<PrincipalId | null> {
  const rows = await db
    .select({ id: schema.principal.id })
    .from(schema.principal)
    .where(eq(schema.principal.orgId, orgId))
    .limit(1);
  return rows.length === 0 ? null : (rows[0]!.id as PrincipalId);
}
