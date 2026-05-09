// POST /api/invitation/<id>/accept
//
// Logged-in user accepts a per-document invitation. The session's
// email must match the invited email exactly (case-insensitive); the
// inviter cannot self-accept; expired/revoked invitations 410.

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { acceptInvitation, InvitationError } from '@/lib/invitations';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function POST(
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
  try {
    const result = await acceptInvitation({
      db: getDb(),
      invitationId: id,
      acceptingPrincipalId: principalId,
      acceptingEmail: session.user.email,
    });
    return NextResponse.json({
      documentId: result.documentId,
      roleId: result.roleId,
    });
  } catch (err) {
    if (err instanceof InvitationError) {
      const status =
        err.code === 'invitation-not-found' ? 404
        : err.code === 'expired' ? 410
        : err.code === 'wrong-email' ? 403
        : err.code === 'self-accept' ? 400
        : err.code === 'already-accepted' ? 409
        : 500;
      return NextResponse.json({ error: err.code, detail: err.message }, { status });
    }
    return NextResponse.json(
      {
        error: 'invitation-accept-failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
