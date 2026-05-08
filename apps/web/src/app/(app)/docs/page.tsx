import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

export default async function DocsListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    // Bridge missed — surface as error rather than silently empty.
    throw new Error(
      `No Principal row for user ${session.user.id}. Run principal-bridge.`,
    );
  }

  const db = getDb();
  // Docs the user owns (Phase 1). Phase 1.5 also union with docs the
  // user has via document_acl.
  const docs = await db
    .select({
      id: schema.document.id,
      title: schema.document.title,
      slug: schema.document.slug,
      primaryLanguage: schema.document.primaryLanguage,
      bilingualMode: schema.document.bilingualMode,
      updatedAt: schema.document.updatedAt,
    })
    .from(schema.document)
    .where(
      and(
        eq(schema.document.ownerPrincipalId, principalId),
        isNull(schema.document.deletedAt),
      ),
    )
    .orderBy(desc(schema.document.updatedAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-medium">文档 · Documents</h1>
        <Link
          href="/docs/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
        >
          新建文档 / New document
        </Link>
      </header>

      {docs.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          还没有文档。
          <Link href="/docs/new" className="ml-1 underline">
            创建第一篇
          </Link>
          。
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col">
                <Link
                  href={`/editor/${d.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {d.title || d.slug}
                </Link>
                <span className="text-xs text-zinc-500">
                  {d.primaryLanguage} · {d.bilingualMode} ·{' '}
                  {d.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}
                </span>
              </div>
              <span className="text-xs text-zinc-400">/{d.slug}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        Phase 1 D9 — 编辑器还未接入（D10/D11/D14）。点击文档目前进入占位
        路由。
      </p>
    </div>
  );
}
