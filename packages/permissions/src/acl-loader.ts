// ACL loader — turns a (principalId, documentId) pair into a
// PrincipalContext the checker can use. Phase 1 reads the materialised
// `document_acl` row directly; Phase 1.5 adds an in-process cache with
// expiresAt-driven invalidation.
//
// Source-of-truth note: `capability_grant` is the audit / history table.
// `document_acl` is denormalised from it by application code at grant /
// revoke time (Phase 1) and rebuilt by a reconcile job hourly
// (Phase 1.5; ADR-0002 §6 Bad/Trade-offs). The gateway's hot path reads
// `document_acl` only — never `capability_grant` — to keep WebSocket
// auth latency bounded.

import { and, eq } from 'drizzle-orm';

import {
  schema,
  type DbExecutor,
} from '@collaborationtool/drizzle';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import {
  type Capability,
  isCapability,
} from './capabilities';
import type { PrincipalContext } from './checker';

export interface LoadAclOptions {
  /** Default false; set true in tests to bypass the expiry cutoff. */
  ignoreExpiry?: boolean;
}

export async function loadPrincipalContext(
  db: DbExecutor,
  principalId: PrincipalId,
  documentId: DocumentId,
  options: LoadAclOptions = {},
): Promise<PrincipalContext | null> {
  const rows = await db
    .select()
    .from(schema.documentAcl)
    .where(
      and(
        eq(schema.documentAcl.documentId, documentId),
        eq(schema.documentAcl.principalId, principalId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0]!;

  if (!options.ignoreExpiry && row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  // Filter out any stored verbs that aren't in the current capability
  // vocabulary — defensive against a stale row that hasn't been
  // re-materialised after a vocab removal.
  const docCaps = new Set<Capability>();
  for (const v of row.capabilityVerbs) {
    if (isCapability(v)) docCaps.add(v);
  }

  return {
    principalId: row.principalId,
    documentCapabilities: docCaps,
    globalCapabilities: new Set(),
    expiresAt: row.expiresAt ?? null,
  };
}

/**
 * Materialise a role bundle into the `document_acl` table. Called by app
 * code (Phase 1 D9 web app) when the document owner grants a role to
 * another principal.
 *
 * In Phase 1 this is a single INSERT (or UPDATE on conflict); a Phase
 * 1.5 reconcile job will rebuild the entire table from `capability_grant`.
 */
export async function materialiseRoleBundle(
  db: DbExecutor,
  args: {
    documentId: DocumentId;
    principalId: PrincipalId;
    roleId: string;
    capabilities: readonly Capability[];
    expiresAt?: Date | null;
    /** Phase 4 W5 ADR-0014: subdocument-level grant. Omit for
     * root-scope (default; covers all subdocs). */
    subdocumentId?: string | null;
  },
): Promise<void> {
  // Phase 4 W5: surrogate id PK — encode (doc, principal[, subdoc])
  // so re-materialisation produces the same row id (lets onConflict
  // hit the right unique-index target).
  const id = args.subdocumentId
    ? `acl:${args.documentId}:${args.principalId}:${args.subdocumentId}`
    : `acl:${args.documentId}:${args.principalId}`;
  await db
    .insert(schema.documentAcl)
    .values({
      id,
      documentId: args.documentId,
      principalId: args.principalId,
      subdocumentId: args.subdocumentId ?? null,
      roleId: args.roleId,
      capabilityVerbs: [...args.capabilities],
      expiresAt: args.expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: [
        schema.documentAcl.documentId,
        schema.documentAcl.principalId,
        schema.documentAcl.subdocumentId,
      ],
      set: {
        roleId: args.roleId,
        capabilityVerbs: [...args.capabilities],
        expiresAt: args.expiresAt ?? null,
      },
    });
}
