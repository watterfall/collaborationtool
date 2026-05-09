// Phase 1.5 #1 — per-document invitation lib.
//
// `createInvitation` is called by POST /api/document/<docId>/invitation.
// `acceptInvitation` is called by POST /api/invitation/<id>/accept.
// Both gate on capability + email match (no SQL grants needed any more).

import { v7 as uuidv7 } from 'uuid';
import { and, eq, sql } from 'drizzle-orm';

import { schema, type DbExecutor } from '@collaborationtool/drizzle';
import {
  DEFAULT_ROLE_BUNDLES,
  isDefaultRoleId,
  materialiseRoleBundle,
  requireCapability,
  type DefaultRoleId,
  type PrincipalContext,
} from '@collaborationtool/permissions';

const DEFAULT_TTL_DAYS = 7;

export interface CreateInvitationInput {
  db: DbExecutor;
  ctx: PrincipalContext;
  documentId: string;
  email: string;
  roleId: string;
  ttlDays?: number;
}

export interface CreateInvitationResult {
  id: string;
  expiresAt: Date;
  acceptUrl: (origin: string) => string;
}

export class InvitationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'unknown-role'
      | 'duplicate-pending'
      | 'invitation-not-found'
      | 'expired'
      | 'wrong-email'
      | 'already-accepted'
      | 'self-accept',
  ) {
    super(message);
    this.name = 'InvitationError';
  }
}

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  // Owner-only operation per ADR-0002 — capability.grant covers it.
  requireCapability(input.ctx, {
    verb: 'capability.grant',
    resourceType: 'document',
    resourceId: input.documentId,
  });
  if (!isDefaultRoleId(input.roleId)) {
    throw new InvitationError(
      `unknown role: ${input.roleId}`,
      'unknown-role',
    );
  }
  const id = uuidv7();
  const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  try {
    await input.db.insert(schema.docInvitation).values({
      id,
      documentId: input.documentId,
      inviterPrincipalId: input.ctx.principalId,
      email: input.email.trim().toLowerCase(),
      roleId: input.roleId,
      status: 'pending',
      expiresAt,
    });
  } catch (err) {
    // 23505 = unique_violation on the `lower(email)` partial index.
    if (
      err instanceof Error &&
      /doc_invitation_pending_uniq|unique constraint/i.test(err.message)
    ) {
      throw new InvitationError(
        'duplicate-pending invitation for this email + document',
        'duplicate-pending',
      );
    }
    throw err;
  }
  return {
    id,
    expiresAt,
    acceptUrl: (origin) =>
      `${origin.replace(/\/+$/, '')}/invite/${encodeURIComponent(id)}`,
  };
}

export interface AcceptInvitationInput {
  db: DbExecutor;
  invitationId: string;
  acceptingPrincipalId: string;
  acceptingEmail: string;
}

export interface AcceptInvitationResult {
  documentId: string;
  roleId: DefaultRoleId;
}

export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  return await input.db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.docInvitation)
      .where(eq(schema.docInvitation.id, input.invitationId))
      .for('update')
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new InvitationError('invitation not found', 'invitation-not-found');
    }
    if (row.status === 'accepted') {
      throw new InvitationError('invitation already accepted', 'already-accepted');
    }
    if (row.status === 'revoked') {
      throw new InvitationError('invitation revoked', 'invitation-not-found');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await tx
        .update(schema.docInvitation)
        .set({ status: 'expired' })
        .where(eq(schema.docInvitation.id, row.id));
      throw new InvitationError('invitation expired', 'expired');
    }
    if (row.email !== input.acceptingEmail.trim().toLowerCase()) {
      throw new InvitationError(
        `invitation was sent to a different email`,
        'wrong-email',
      );
    }
    if (row.inviterPrincipalId === input.acceptingPrincipalId) {
      throw new InvitationError(
        'cannot accept your own invitation',
        'self-accept',
      );
    }
    if (!isDefaultRoleId(row.roleId)) {
      // Defensive: the create path validates, but a malformed row
      // shouldn't crash silently.
      throw new InvitationError(
        `unknown role on invitation: ${row.roleId}`,
        'unknown-role',
      );
    }
    const role = row.roleId;
    await materialiseRoleBundle(tx, {
      documentId: row.documentId,
      principalId: input.acceptingPrincipalId,
      roleId: role,
      capabilities: DEFAULT_ROLE_BUNDLES[role],
    });
    await tx
      .update(schema.docInvitation)
      .set({
        status: 'accepted',
        acceptedByPrincipalId: input.acceptingPrincipalId,
        acceptedAt: sql`now()`,
      })
      .where(eq(schema.docInvitation.id, row.id));
    return { documentId: row.documentId, roleId: role };
  });
}

export interface ListPendingInvitationsInput {
  db: DbExecutor;
  documentId: string;
}

export async function listPendingInvitations(
  input: ListPendingInvitationsInput,
): Promise<
  Array<{
    id: string;
    email: string;
    roleId: string;
    expiresAt: Date;
    createdAt: Date;
  }>
> {
  const rows = await input.db
    .select({
      id: schema.docInvitation.id,
      email: schema.docInvitation.email,
      roleId: schema.docInvitation.roleId,
      expiresAt: schema.docInvitation.expiresAt,
      createdAt: schema.docInvitation.createdAt,
    })
    .from(schema.docInvitation)
    .where(
      and(
        eq(schema.docInvitation.documentId, input.documentId),
        eq(schema.docInvitation.status, 'pending'),
      ),
    )
    .orderBy(schema.docInvitation.createdAt);
  return rows;
}

export function renderInvitationEmail(args: {
  inviterDisplayName: string;
  documentTitle: string;
  roleId: string;
  acceptUrl: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  const subject = `${args.inviterDisplayName} 邀请你协作《${args.documentTitle}》`;
  const text = [
    `${args.inviterDisplayName} 邀请你以 ${args.roleId} 身份参与论文《${args.documentTitle}》。`,
    '',
    `点击下面的链接接受邀请（${args.expiresAt.toISOString().slice(0, 10)} 之前有效）：`,
    args.acceptUrl,
    '',
    '如果不是你本人请求，请忽略此邮件。',
  ].join('\n');
  const html = `<!doctype html><html lang="zh-Hans"><body style="font-family:system-ui,sans-serif;color:#27272a;line-height:1.5;">
    <p>${escapeHtml(args.inviterDisplayName)} 邀请你以 <strong>${escapeHtml(args.roleId)}</strong> 身份参与论文《${escapeHtml(args.documentTitle)}》。</p>
    <p><a href="${escapeAttr(args.acceptUrl)}" style="display:inline-block;background:#18181b;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;">接受邀请 / Accept invitation</a></p>
    <p style="color:#71717a;font-size:12px;">链接有效期至 ${args.expiresAt.toISOString().slice(0, 10)}。如果不是你本人请求，请忽略此邮件。</p>
  </body></html>`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
