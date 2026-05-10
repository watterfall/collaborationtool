// Phase 4 W1: uninstall (status='uninstalled' + archived_at).

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({ installedBy: schema.pluginInstall.installedBy })
    .from(schema.pluginInstall)
    .where(eq(schema.pluginInstall.id, id))
    .limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  if (rows[0]!.installedBy !== principalId) {
    return NextResponse.json({ error: 'not-owner' }, { status: 403 });
  }

  await db
    .update(schema.pluginInstall)
    .set({ status: 'uninstalled', archivedAt: new Date() })
    .where(
      and(
        eq(schema.pluginInstall.id, id),
        eq(schema.pluginInstall.installedBy, principalId),
      ),
    );
  return NextResponse.json({ ok: true });
}
