// GET /api/maintenance/findings
//
// Phase 4 W4 dashboard: list maintenance findings owned by the current
// user's principal (vault_principal_id = caller's principal_id).
//
// Authorization model: vault ownership, not capability — findings are
// per-principal aggregate state, distinct from document ACL. Cross-
// org / shared-vault dashboards are dogfood-trigger (Phase 4 末).
//
// Query params:
//   status      comma list, default 'open'
//   severity    comma list (info / low / medium / high)
//   kind        comma list (the 6 finding_kind values)
//   documentId  restrict to one document
//   limit       default 100, max 500
//
// Response:
//   { findings: PublicFinding[], counts: { open, acknowledged, resolved, dismissed } }

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

const VALID_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const;
const VALID_SEVERITIES = ['info', 'low', 'medium', 'high'] as const;
const VALID_KINDS = [
  'unsupported-claim',
  'outdated-source',
  'duplicated-claim',
  'contradicted-conclusion',
  'unverified-ai-block',
  'broken-citation',
] as const;

type Status = (typeof VALID_STATUSES)[number];
type Severity = (typeof VALID_SEVERITIES)[number];
type Kind = (typeof VALID_KINDS)[number];

function parseList<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] | null {
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.filter((p): p is T => (allowed as readonly string[]).includes(p));
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const url = new URL(request.url);
  const statuses =
    parseList<Status>(url.searchParams.get('status'), VALID_STATUSES) ?? ['open'];
  const severities = parseList<Severity>(
    url.searchParams.get('severity'),
    VALID_SEVERITIES,
  );
  const kinds = parseList<Kind>(url.searchParams.get('kind'), VALID_KINDS);
  const documentId = url.searchParams.get('documentId');
  const limitRaw = Number(url.searchParams.get('limit') ?? '100');
  const limit = Number.isFinite(limitRaw)
    ? Math.min(500, Math.max(1, Math.floor(limitRaw)))
    : 100;

  const db = getDb();

  const conds = [eq(schema.maintenanceFinding.vaultPrincipalId, principalId)];
  if (statuses.length > 0) {
    conds.push(inArray(schema.maintenanceFinding.status, statuses));
  }
  if (severities && severities.length > 0) {
    conds.push(inArray(schema.maintenanceFinding.severity, severities));
  }
  if (kinds && kinds.length > 0) {
    conds.push(inArray(schema.maintenanceFinding.kind, kinds));
  }
  if (documentId) {
    conds.push(eq(schema.maintenanceFinding.documentId, documentId));
  }

  const rows = await db
    .select()
    .from(schema.maintenanceFinding)
    .where(and(...conds))
    // Sort: high severity first, then most recent.
    .orderBy(
      sql`CASE ${schema.maintenanceFinding.severity}
            WHEN 'high' THEN 0
            WHEN 'medium' THEN 1
            WHEN 'low' THEN 2
            WHEN 'info' THEN 3
          END`,
      desc(schema.maintenanceFinding.foundAt),
    )
    .limit(limit);

  // Count per status for the filter chip strip — bound to vault, not
  // limited / filtered. One round-trip via FILTER aggregates.
  const countRow = await db
    .select({
      open: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'open')::int`,
      acknowledged: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'acknowledged')::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'resolved')::int`,
      dismissed: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'dismissed')::int`,
    })
    .from(schema.maintenanceFinding)
    .where(eq(schema.maintenanceFinding.vaultPrincipalId, principalId));

  return NextResponse.json({
    findings: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      severity: r.severity,
      status: r.status,
      summary: r.summary,
      details: r.details,
      claimId: r.claimId,
      evidenceId: r.evidenceId,
      sourceId: r.sourceId,
      citationId: r.citationId,
      documentId: r.documentId,
      jobId: r.jobId,
      foundAt: r.foundAt.toISOString(),
      acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      dismissedAt: r.dismissedAt?.toISOString() ?? null,
      dismissReason: r.dismissReason ?? null,
    })),
    counts: countRow[0] ?? { open: 0, acknowledged: 0, resolved: 0, dismissed: 0 },
  });
}
