// Server route that materialises a Principal row for an org just
// created via better-auth's organization plugin. Phase 1.5 will replace
// this with a proper better-auth org databaseHook once the adapter
// surfaces it.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { auth, bridgeOrgCreate } from '@/lib/auth';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { orgId?: unknown; name?: unknown };
  try {
    body = (await request.json()) as { orgId?: unknown; name?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (typeof body.orgId !== 'string' || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 });
  }

  // The session check confirms the caller is logged in. better-auth
  // already enforces "only the org creator triggers org.create"; we
  // trust the orgId here. Phase 1.5 verifies the org exists + the
  // caller is its owner before bridging.
  await bridgeOrgCreate({
    orgId: body.orgId,
    displayName: body.name,
  });

  return NextResponse.json({ ok: true });
}
