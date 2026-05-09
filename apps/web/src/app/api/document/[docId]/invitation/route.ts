// POST /api/document/<docId>/invitation
// GET  /api/document/<docId>/invitation
//
// Owner creates / lists per-document invitations. Replaces the
// SQL-grant workaround. The accept side lives at
// /api/invitation/<id>/accept.

import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext } from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  createInvitation,
  InvitationError,
  listPendingInvitations,
  renderInvitationEmail,
} from '@/lib/invitations';
import { sendEmail } from '@/lib/mailer';
import { getPrincipalIdForUser } from '@/lib/principal';

interface InvitePostBody {
  email?: unknown;
  roleId?: unknown;
}

async function requireOwnerCtx(
  docId: string,
): Promise<
  | { ok: true; principalId: string; ctx: Awaited<ReturnType<typeof loadPrincipalContext>> }
  | { ok: false; status: number; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, status: 401, error: 'unauthenticated' };
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) return { ok: false, status: 403, error: 'no-principal' };
  const ctx = await loadPrincipalContext(getDb(), principalId, docId);
  if (!ctx) return { ok: false, status: 403, error: 'no-access' };
  return { ok: true, principalId, ctx };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  const { docId } = await params;
  const ownerCheck = await requireOwnerCtx(docId);
  if (!ownerCheck.ok)
    return NextResponse.json({ error: ownerCheck.error }, { status: ownerCheck.status });

  let body: InvitePostBody;
  try {
    body = (await request.json()) as InvitePostBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (typeof body.email !== 'string' || typeof body.roleId !== 'string') {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 });
  }
  const email = body.email.trim();
  if (!/^.+@.+\..+$/.test(email)) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
  }

  const db = getDb();
  try {
    const created = await createInvitation({
      db,
      ctx: ownerCheck.ctx!,
      documentId: docId,
      email,
      roleId: body.roleId,
    });
    const session = await getSession();
    const docTitle = await loadDocTitle(docId);
    const inviterName = session?.user.name ?? session?.user.email ?? '论文协作者';
    const origin = new URL(request.url).origin;
    const acceptUrl = created.acceptUrl(origin);
    const rendered = renderInvitationEmail({
      inviterDisplayName: inviterName,
      documentTitle: docTitle,
      roleId: body.roleId,
      acceptUrl,
      expiresAt: created.expiresAt,
    });
    let emailResult: { backend: string } | { backend: string; error: string };
    try {
      emailResult = await sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (e) {
      emailResult = {
        backend: 'webhook',
        error: e instanceof Error ? e.message : String(e),
      };
    }
    return NextResponse.json({
      id: created.id,
      expiresAt: created.expiresAt.toISOString(),
      acceptUrl,
      email: { backend: emailResult.backend, ...('error' in emailResult ? { error: emailResult.error } : {}) },
    });
  } catch (err) {
    if (err instanceof InvitationError) {
      const status = err.code === 'unknown-role' ? 400
        : err.code === 'duplicate-pending' ? 409
        : 500;
      return NextResponse.json({ error: err.code, detail: err.message }, { status });
    }
    if (err instanceof Error && /denied/.test(err.message)) {
      return NextResponse.json({ error: 'capability-denied', detail: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'invitation-create-failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  const { docId } = await params;
  const ownerCheck = await requireOwnerCtx(docId);
  if (!ownerCheck.ok)
    return NextResponse.json({ error: ownerCheck.error }, { status: ownerCheck.status });
  const rows = await listPendingInvitations({ db: getDb(), documentId: docId });
  return NextResponse.json({
    pending: rows.map((r) => ({
      id: r.id,
      email: r.email,
      roleId: r.roleId,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function loadDocTitle(docId: string): Promise<string> {
  const rows = await getDb()
    .select({ title: schema.document.title, slug: schema.document.slug })
    .from(schema.document)
    .where(and(eq(schema.document.id, docId)))
    .limit(1);
  const row = rows[0];
  return row?.title || row?.slug || docId;
}
