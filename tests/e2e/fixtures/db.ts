// Direct PG fixtures for e2e tests. Phase 1 has no invitation flow yet
// (Phase 1.5), so the e2e suite seeds the second user's role via direct
// inserts. Uses the same Drizzle handle as the rest of the workspace.

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { openDatabase, schema } from '@collaborationtool/drizzle';
import {
  DEFAULT_ROLE_BUNDLES,
  type DefaultRoleId,
} from '@collaborationtool/permissions';

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgres://collab:collab@localhost:5432/collaborationtool';

let cached: ReturnType<typeof openDatabase> | null = null;

function getHandle(): ReturnType<typeof openDatabase> {
  if (!cached) cached = openDatabase({ url: DATABASE_URL });
  return cached;
}

export async function closeHandle(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}

/** Resolve the PrincipalId for a better-auth user id. */
export async function principalForUserId(
  userId: string,
): Promise<string | null> {
  const handle = getHandle();
  const rows = await handle.db
    .select({ id: schema.principal.id })
    .from(schema.principal)
    .where(eq(schema.principal.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

export interface CreateDocFixtureInput {
  ownerPrincipalId: string;
  primaryLanguage?: string;
  bilingualMode?: 'mono' | 'parallel' | 'mixed';
  title: string;
}

/** Insert a fresh document + paper-author ACL for the owner. */
export async function createDocFixture(
  input: CreateDocFixtureInput,
): Promise<{ documentId: string }> {
  const handle = getHandle();
  const documentId = uuidv7();
  const slug = `e2e-${documentId.replace(/-/g, '').slice(0, 24)}`;
  await handle.db.insert(schema.document).values({
    id: documentId,
    ownerPrincipalId: input.ownerPrincipalId,
    primaryLanguage: input.primaryLanguage ?? 'zh-Hans',
    bilingualMode: input.bilingualMode ?? 'mixed',
    title: input.title,
    slug,
  });
  await handle.db.insert(schema.documentAcl).values({
    documentId,
    principalId: input.ownerPrincipalId,
    roleId: 'paper-author',
    capabilityVerbs: [...DEFAULT_ROLE_BUNDLES['paper-author']],
  });
  return { documentId };
}

export interface GrantRoleFixtureInput {
  documentId: string;
  principalId: string;
  roleId: DefaultRoleId;
}

/** Materialise a role bundle on a document for an existing principal. */
export async function grantRoleFixture(
  input: GrantRoleFixtureInput,
): Promise<void> {
  const handle = getHandle();
  await handle.db
    .insert(schema.documentAcl)
    .values({
      documentId: input.documentId,
      principalId: input.principalId,
      roleId: input.roleId,
      capabilityVerbs: [...DEFAULT_ROLE_BUNDLES[input.roleId]],
    })
    .onConflictDoUpdate({
      target: [schema.documentAcl.documentId, schema.documentAcl.principalId],
      set: {
        roleId: input.roleId,
        capabilityVerbs: [...DEFAULT_ROLE_BUNDLES[input.roleId]],
      },
    });
}

export interface PendingRevisionRowQuery {
  documentId: string;
}

/** Read pending revisions directly from PG (back-channel for assertions). */
export async function pgPendingRevisions(
  query: PendingRevisionRowQuery,
): Promise<
  Array<{
    id: string;
    proposedBy: string;
    status: string;
    rationale: string | null;
  }>
> {
  const handle = getHandle();
  const rows = await handle.db
    .select({
      id: schema.revision.id,
      proposedBy: schema.revision.proposedBy,
      status: schema.revision.status,
      rationale: schema.revision.rationale,
    })
    .from(schema.revision)
    .where(eq(schema.revision.documentId, query.documentId));
  return rows.filter((r) => r.status === 'proposed' || r.status === 'draft');
}

/** Read provenance row for a revision (asserts agentContext + toolCalls). */
export async function pgProvenanceForRevision(revisionId: string): Promise<{
  actorKind: string;
  agentContext: Record<string, unknown> | null;
  toolCalls: unknown[] | null;
  approvalChain: unknown[] | null;
} | null> {
  const handle = getHandle();
  const revRows = await handle.db
    .select({ provenanceId: schema.revision.provenanceId })
    .from(schema.revision)
    .where(eq(schema.revision.id, revisionId))
    .limit(1);
  const provenanceId = revRows[0]?.provenanceId;
  if (!provenanceId) return null;
  const provRows = await handle.db
    .select()
    .from(schema.provenance)
    .where(eq(schema.provenance.id, provenanceId))
    .limit(1);
  const p = provRows[0];
  if (!p) return null;
  return {
    actorKind: p.actorKind,
    agentContext: p.agentContext as Record<string, unknown> | null,
    toolCalls: p.toolCalls as unknown[] | null,
    approvalChain: p.approvalChain as unknown[] | null,
  };
}

/** Confirm a contribution row exists for an accepted revision. */
export async function pgContributionExists(
  contributionId: string,
): Promise<boolean> {
  const handle = getHandle();
  const rows = await handle.db
    .select({ id: schema.contribution.id })
    .from(schema.contribution)
    .where(eq(schema.contribution.id, contributionId))
    .limit(1);
  return rows.length > 0;
}
