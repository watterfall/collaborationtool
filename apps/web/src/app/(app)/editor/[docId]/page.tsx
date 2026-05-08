import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import { loadPrincipalContext } from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

import EditorClient from './editor-client';

export default async function EditorPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    throw new Error(`No Principal row for user ${session.user.id}`);
  }

  const db = getDb();
  const docRows = await db
    .select()
    .from(schema.document)
    .where(and(eq(schema.document.id, docId), isNull(schema.document.deletedAt)))
    .limit(1);

  if (docRows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-medium">404</h1>
        <p className="text-sm text-zinc-600">文档不存在或已被删除。</p>
        <Link href="/docs" className="mt-4 inline-block text-sm underline">
          返回文档列表
        </Link>
      </div>
    );
  }

  const doc = docRows[0]!;

  const ctx = await loadPrincipalContext(db, principalId, doc.id);
  if (!ctx || !ctx.documentCapabilities.has('document.read')) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-medium">403</h1>
        <p className="text-sm text-zinc-600">你没有访问此文档的权限。</p>
        <Link href="/docs" className="mt-4 inline-block text-sm underline">
          返回文档列表
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-medium">{doc.title || doc.slug}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {doc.primaryLanguage} · {doc.bilingualMode} · /{doc.slug}
        </p>
      </header>

      <EditorClient documentId={doc.id} />

      <Link href="/docs" className="mt-6 inline-block text-sm underline">
        ← 返回文档列表
      </Link>
    </div>
  );
}
