// Docs list — editorial journal index, not a SaaS DataGrid.
//
// Layout follows Design.md §6.4: 200px aside (collections / language /
// agents) + main column with H1 + meta-row + search/new + <ol> index.
// Each entry row: 40px serial · title&authors · updated&agents · lang.
//
// Until permissions ACL union lands (Phase 1.5+), we only show docs
// the user owns. Filters are visual placeholders the route doesn't
// yet drive — wired up alongside the ACL union work.

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
    throw new Error(
      `No Principal row for user ${session.user.id}. Run principal-bridge.`,
    );
  }

  const db = getDb();
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

  const totalCount = docs.length;
  const lastEdit = docs[0]?.updatedAt ?? null;

  return (
    <div className="mx-auto max-w-6xl px-14 pt-12 pb-16">
      <div className="grid grid-cols-[200px_1fr] gap-14">
        {/* Aside — collections / language / agents. Hairline navigation,
            no dropdowns. */}
        <aside className="font-sans text-sm">
          <p className="label-cap mb-3">collections</p>
          <ul
            className="m-0 list-none p-0 leading-[2]"
            style={{ color: 'var(--color-ink-2)' }}
          >
            <li
              className="pl-3"
              style={{
                borderLeft: '1.5px solid var(--color-ink)',
                color: 'var(--color-ink)',
              }}
            >
              全部 · All{' '}
              <span style={{ color: 'var(--color-ink-3)' }}>
                · {totalCount}
              </span>
            </li>
            <li className="pl-[13px]">
              草稿 · Drafts{' '}
              <span style={{ color: 'var(--color-ink-3)' }}>· —</span>
            </li>
            <li className="pl-[13px]">
              评审中 · In review{' '}
              <span style={{ color: 'var(--color-ink-3)' }}>· —</span>
            </li>
            <li className="pl-[13px]">
              已归档 · Archived{' '}
              <span style={{ color: 'var(--color-ink-3)' }}>· —</span>
            </li>
          </ul>

          <p className="label-cap mt-7 mb-2">language</p>
          <p style={{ color: 'var(--color-ink-2)' }}>中 / EN / 双语</p>

          <p className="label-cap mt-7 mb-2">agents</p>
          <p style={{ color: 'var(--color-ink-2)' }}>any · active · idle</p>
        </aside>

        {/* Main — H1 · meta · search/new · <ol> index. */}
        <main>
          <div className="mb-9 flex items-baseline justify-between">
            <div>
              <h1
                className="font-serif text-[44px] font-medium leading-[1.1]"
                style={{
                  color: 'var(--color-ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                我的论文{' '}
                <span
                  className="font-serif italic"
                  style={{
                    color: 'var(--color-ink-2)',
                    fontWeight: 400,
                  }}
                >
                  · papers
                </span>
              </h1>
              <p
                className="mt-2 font-sans text-sm"
                style={{ color: 'var(--color-ink-3)' }}
              >
                {totalCount} document{totalCount === 1 ? '' : 's'}
                {lastEdit
                  ? ` · last edit ${formatRelative(lastEdit)}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/docs/new" className="btn-primary">
                <span aria-hidden>+</span> 新建 · New
              </Link>
            </div>
          </div>

          {totalCount === 0 ? (
            <div
              className="border-t py-16 text-center font-serif text-base"
              style={{
                borderColor: 'var(--color-hairline)',
                color: 'var(--color-ink-3)',
              }}
              data-prose="bilingual"
            >
              还没有论文 · No papers yet.
              <Link
                href="/docs/new"
                className="ml-2 underline underline-offset-4"
                style={{ color: 'var(--color-ink-2)' }}
              >
                创建第一篇 · Start one
              </Link>
            </div>
          ) : (
            <ol className="m-0 list-none p-0">
              {docs.map((d, i) => (
                <li
                  key={d.id}
                  className="grid grid-cols-[40px_1fr_180px_120px] items-baseline gap-6 py-5"
                  style={{ borderTop: '1px solid var(--color-hairline)' }}
                >
                  <span
                    className="font-mono text-sm tabular-nums"
                    style={{
                      color: 'var(--color-ink-3)',
                      fontFeatureSettings: '"onum" 1',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <Link
                      href={`/editor/${d.id}`}
                      className="font-serif text-2xl font-medium leading-[1.3] hover:underline"
                      style={{
                        color: 'var(--color-ink)',
                        textUnderlineOffset: '4px',
                      }}
                      data-prose="bilingual"
                    >
                      {d.title || d.slug}
                    </Link>
                    <p
                      className="mt-1 font-mono text-xs"
                      style={{ color: 'var(--color-ink-3)' }}
                    >
                      /{d.slug}
                    </p>
                  </div>
                  <div
                    className="font-sans text-xs"
                    style={{ color: 'var(--color-ink-2)' }}
                  >
                    edited {formatRelative(d.updatedAt)}
                  </div>
                  <div className="flex items-center justify-end gap-2 font-sans text-xs">
                    <span className="label-cap">
                      {d.bilingualMode === 'mono'
                        ? d.primaryLanguage === 'zh'
                          ? '中'
                          : 'EN'
                        : '双语'}
                    </span>
                  </div>
                </li>
              ))}
              <li
                style={{ borderTop: '1px solid var(--color-hairline)' }}
              />
            </ol>
          )}
        </main>
      </div>
    </div>
  );
}

// Editorial relative time — explicit, no "just now" / "less than a
// minute ago" cuteness. Caller passes Date already from the DB row.
function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'moments ago';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toISOString().slice(0, 10);
}
