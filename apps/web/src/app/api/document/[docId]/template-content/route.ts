// Phase 4 W6.2 — 新建文档模板首次播种端点。
//
// GET /api/document/<docId>/template-content
//   200 → { templateId, content }   首次访问者拿到 PM JSON
//   204 → 已被前一访问者播种 / 没有模板可播
//   403 → 无 document.read capability
//
// 在事务里 SELECT FOR UPDATE document 行，如果 template_id 还在就把它读出来
// 并立刻清空。后续请求看到 template_id = NULL，返回 204。这样多 client
// 同时连接时不会重复 seed，也不需要触碰 sync-gateway / snapshot-worker 的
// 初始化路径。
//
// 注意：这是一个尽力而为的 race-避免，实际防御依赖 PG 行级锁 + 事务的
// 原子性。如果调用方在拿到 200 之后没把 PM JSON 应用到 Y.Doc 就掉线，
// 文档会保持空白；我们接受这个降级（用户重开页面或自己粘贴内容即可）。

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext } from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';
import { isDocTemplateId, loadDocTemplate } from '@/lib/doc-template';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { docId } = await ctx.params;
  if (!docId) {
    return NextResponse.json({ error: 'missing-doc-id' }, { status: 400 });
  }
  const documentId = docId as DocumentId;

  const principalId = (await getPrincipalIdForUser(session.user.id)) as
    | PrincipalId
    | null;
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }
  const db = getDb();
  const principalContext = await loadPrincipalContext(
    db,
    principalId,
    documentId,
  );
  if (!principalContext) {
    return NextResponse.json({ error: 'no-access' }, { status: 403 });
  }
  if (!principalContext.documentCapabilities.has('document.read')) {
    return NextResponse.json(
      { error: 'capability-denied', verb: 'document.read' },
      { status: 403 },
    );
  }

  // Atomically claim the seed slot inside a transaction. Read first,
  // then NULL the column. PG default isolation is read-committed, but
  // we serialize via the implicit row lock from the UPDATE.
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ templateId: schema.document.templateId })
      .from(schema.document)
      .where(eq(schema.document.id, documentId))
      .for('update')
      .limit(1);
    const templateId = rows[0]?.templateId ?? null;
    if (!templateId) return null;
    await tx
      .update(schema.document)
      .set({ templateId: null })
      .where(eq(schema.document.id, documentId));
    return templateId;
  });

  if (!claimed || !isDocTemplateId(claimed)) {
    return new NextResponse(null, { status: 204 });
  }

  let content: unknown;
  try {
    content = await loadDocTemplate(claimed);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'template-load-failed',
        templateId: claimed,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ templateId: claimed, content });
}
