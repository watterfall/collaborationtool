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

import { and, eq, sql } from 'drizzle-orm';

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
import {
  type DefaultRoleId,
  getRoleBundle,
  isDefaultRoleId,
} from './roles';

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

// ============================================================
// Phase 4 W7.3 — bulk materialisation
// ------------------------------------------------------------
// Source-of-pain: ADR-0002 §3 demo profile + Phase 4 W5 subdocument
// fan-out. ORCID-verified open-reviewer demo posits 50 reviewers × 50
// subdocs = 2,500 document_acl rows per paper (and 16 capability verbs
// per row inflate to 40 000 capability_grant rows when we audit-log
// every verb individually). Doing 2 500 round-trips through the
// `materialiseRoleBundle` single-row path is prohibitive on Phase 4 W8
// when ORCID lights up — the wall-clock is dominated by INSERT latency,
// not by the work itself.
//
// `materialiseRoleBundleBulk` collapses the same fan-out into ONE
// multi-row INSERT (Drizzle `.insert(t).values(rows[])`). All conflict
// resolution piggybacks on the existing
// `document_acl_doc_principal_subdoc_uniq` unique index — re-running the
// bulk call is idempotent (UPDATE on conflict).
//
// Design decisions:
//   - role bundle expansion happens here so callers don't have to import
//     `getRoleBundle`. Pass either a known DefaultRoleId or supply your
//     own `capabilities` for custom bundles (Phase 5+).
//   - `resourceType` / `resourceId` mirror `capability_grant` shape for
//     forward-compat with the per-verb audit table; document_acl is the
//     hot-path read-side, capability_grant is the audit/rebuild side.
//     Phase 4 W7.3 writes only document_acl; the capability_grant
//     materialisation is a separate writer that already batches by
//     transaction.
//   - returns rows in input order with the surrogate id we wrote, so
//     callers can correlate input → grantId for downstream provenance.
//
// TODO (Phase 4 W8 ORCID, ADR-0002 §4 / §8 review log):
//   - 60s heartbeat re-check: an open-reviewer's `expiresAt` should
//     advance every 60s while the ORCID session is live. Implementing
//     that is a separate writer (heartbeat job in apps/agent-worker)
//     which calls this bulk path with refreshed `expiresAt`. The bulk
//     INSERT path is what makes that loop cheap — without it the
//     heartbeat itself would amplify into N round-trips.

export interface RoleBundleInput {
  /** Document the grant scopes to (matches capability_grant.resource_id). */
  documentId: DocumentId;
  /** Principal receiving the grant. */
  principalId: PrincipalId;
  /** Built-in role id (resolves capabilities via roles.ts) OR custom string
   *  paired with `capabilities[]`. */
  role: DefaultRoleId | string;
  /** Optional capability override; defaults to getRoleBundle(role) when
   *  `role` is a DefaultRoleId. Required when `role` is custom. */
  capabilities?: readonly Capability[];
  /** Resource shape mirrors capability_grant for forward compat. Phase 4
   *  this is always 'document'; Phase 5+ may add 'subdocument' / 'org'. */
  resourceType?: 'document' | 'subdocument' | 'org' | 'agent';
  /** Mirrors capability_grant.resource_id; defaults to documentId. */
  resourceId?: string;
  /** Phase 4 W5 ADR-0014 subdocument scope; null/omitted = root. */
  subdocumentId?: string | null;
  /** ORCID heartbeat or invitation TTL. null = never expires. */
  expiresAt?: Date | null;
}

export interface RoleBundleResult {
  grantId: string;
  documentId: DocumentId;
  principalId: PrincipalId;
  subdocumentId: string | null;
}

function deriveBundleCapabilities(
  input: RoleBundleInput,
): readonly Capability[] {
  if (input.capabilities) return input.capabilities;
  if (isDefaultRoleId(input.role)) return getRoleBundle(input.role);
  throw new Error(
    `materialiseRoleBundleBulk: role '${input.role}' is not a DefaultRoleId; ` +
      'caller must supply capabilities[] for custom roles.',
  );
}

function deriveGrantId(input: RoleBundleInput): string {
  return input.subdocumentId
    ? `acl:${input.documentId}:${input.principalId}:${input.subdocumentId}`
    : `acl:${input.documentId}:${input.principalId}`;
}

/**
 * Bulk-materialise a batch of role bundles in ONE multi-row INSERT.
 *
 * Empty input → no-op (returns []), no DB call. Idempotent: re-running
 * with the same (documentId, principalId, subdocumentId) tuple updates
 * the row in place via the existing unique-index conflict target.
 *
 * Performance target (ADR-0002 §3 demo profile): 50 reviewers × 16
 * subdocs ≈ 800 rows in < 100ms on a local Postgres.
 */
export async function materialiseRoleBundleBulk(
  db: DbExecutor,
  inputs: readonly RoleBundleInput[],
): Promise<RoleBundleResult[]> {
  if (inputs.length === 0) return [];

  const valuesRows = inputs.map((input) => {
    const capabilities = deriveBundleCapabilities(input);
    const id = deriveGrantId(input);
    return {
      id,
      documentId: input.documentId,
      principalId: input.principalId,
      subdocumentId: input.subdocumentId ?? null,
      roleId: input.role,
      capabilityVerbs: [...capabilities],
      expiresAt: input.expiresAt ?? null,
    };
  });

  // Single multi-row INSERT … ON CONFLICT DO UPDATE. We cannot use the
  // composite unique index target with a partial DO UPDATE that varies
  // per-row, so we route every conflict through the same SET clause:
  // EXCLUDED.* preserves the per-row payload supplied above.
  await db
    .insert(schema.documentAcl)
    .values(valuesRows)
    .onConflictDoUpdate({
      target: [
        schema.documentAcl.documentId,
        schema.documentAcl.principalId,
        schema.documentAcl.subdocumentId,
      ],
      set: {
        roleId: sql`excluded.role_id`,
        capabilityVerbs: sql`excluded.capability_verbs`,
        expiresAt: sql`excluded.expires_at`,
      },
    });

  return inputs.map((input, i) => ({
    grantId: valuesRows[i]!.id,
    documentId: input.documentId,
    principalId: input.principalId,
    subdocumentId: input.subdocumentId ?? null,
  }));
}
