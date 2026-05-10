// POST /api/maintenance/findings/<id>/transition
//
// Phase 4 W4 dashboard mutations. Single endpoint covers the 3 user
// actions (acknowledge / resolve / dismiss) since they all flip the
// `status` column + a per-action timestamp + actor principal.
//
// Body:
//   { to: 'acknowledged' | 'resolved' | 'dismissed', reason?: string }
//
// Authorization:
//   - Authenticated session
//   - Caller's principal_id must equal finding.vault_principal_id
//   - 'dismissed' requires a non-empty reason (audit trail; users can
//     review why something was a false positive)
//
// Allowed transitions:
//   open         → acknowledged | resolved | dismissed
//   acknowledged → resolved | dismissed
//   resolved     → (terminal; no transition)
//   dismissed    → (terminal; no transition)

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { validateTransition } from '@/lib/maintenance';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: findingId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  let body: { to?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as { to?: unknown; reason?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const reason =
    typeof body.reason === 'string' && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  const db = getDb();

  const rows = await db
    .select({
      vaultPrincipalId: schema.maintenanceFinding.vaultPrincipalId,
      status: schema.maintenanceFinding.status,
    })
    .from(schema.maintenanceFinding)
    .where(eq(schema.maintenanceFinding.id, findingId))
    .limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'finding-not-found' }, { status: 404 });
  }
  const current = rows[0]!;
  if (current.vaultPrincipalId !== principalId) {
    return NextResponse.json({ error: 'not-vault-owner' }, { status: 403 });
  }

  const verdict = validateTransition({
    currentStatus: current.status,
    to: body.to,
    reason,
    actorPrincipalId: principalId,
  });
  if (!verdict.ok) {
    const status =
      verdict.reason === 'invalid-target' ||
      verdict.reason === 'reason-required-for-dismissed'
        ? 400
        : 409;
    return NextResponse.json(verdict, { status });
  }

  await db
    .update(schema.maintenanceFinding)
    .set(verdict.updates)
    .where(eq(schema.maintenanceFinding.id, findingId));

  return NextResponse.json({
    ok: true,
    id: findingId,
    status: verdict.updates.status,
  });
}
