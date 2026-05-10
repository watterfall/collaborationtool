// Phase 4 W4 dashboard: maintenance findings list.
//
// Server component fetches the current user's vault findings directly
// from PG (faster than self-fetching the HTTP route). Mutations go
// through the /api/maintenance/findings/<id>/transition route via a
// Server Action that revalidates this path.

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  FINDING_STATUSES,
  validateTransition,
  type FindingStatus,
} from '@/lib/maintenance';
import { getPrincipalIdForUser } from '@/lib/principal';

const STATUSES = FINDING_STATUSES;
type Status = FindingStatus;

const KIND_LABEL: Record<string, string> = {
  'unsupported-claim': '论断无支撑',
  'outdated-source': '资料过期',
  'duplicated-claim': '论断重复',
  'contradicted-conclusion': '结论受挑战',
  'unverified-ai-block': 'AI 块待审',
  'broken-citation': '引用失效',
};

const SEVERITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-900 ring-red-200',
  medium: 'bg-amber-100 text-amber-900 ring-amber-200',
  low: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  info: 'bg-blue-100 text-blue-900 ring-blue-200',
};

const SEVERITY_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
  info: '提示',
};

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    throw new Error(
      `No Principal row for user ${session.user.id}. Run principal-bridge.`,
    );
  }

  const sp = await searchParams;
  const activeStatus =
    sp.status &&
    (STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as Status)
      : 'open';

  const db = getDb();

  const rows = await db
    .select()
    .from(schema.maintenanceFinding)
    .where(
      and(
        eq(schema.maintenanceFinding.vaultPrincipalId, principalId),
        inArray(schema.maintenanceFinding.status, [activeStatus]),
      ),
    )
    .orderBy(
      sql`CASE ${schema.maintenanceFinding.severity}
            WHEN 'high' THEN 0
            WHEN 'medium' THEN 1
            WHEN 'low' THEN 2
            WHEN 'info' THEN 3
          END`,
      desc(schema.maintenanceFinding.foundAt),
    )
    .limit(200);

  const counts = await db
    .select({
      open: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'open')::int`,
      acknowledged: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'acknowledged')::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'resolved')::int`,
      dismissed: sql<number>`count(*) FILTER (WHERE ${schema.maintenanceFinding.status} = 'dismissed')::int`,
    })
    .from(schema.maintenanceFinding)
    .where(eq(schema.maintenanceFinding.vaultPrincipalId, principalId));
  const c = counts[0] ?? {
    open: 0,
    acknowledged: 0,
    resolved: 0,
    dismissed: 0,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-medium">维护 · Maintenance</h1>
        <p className="mt-1 text-sm text-zinc-500">
          知识库巡检发现 · 接受 / 已修复 / 误报后归档（详见 ADR-0011 §7.4）
        </p>
      </header>

      <nav className="mb-4 flex gap-1 text-sm">
        {STATUSES.map((s) => {
          const active = s === activeStatus;
          const n = c[s];
          return (
            <Link
              key={s}
              href={`/maintenance?status=${s}`}
              className={
                'rounded-md px-3 py-1.5 ' +
                (active
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200')
              }
            >
              {STATUS_LABEL[s]}
              <span
                className={
                  'ml-1.5 text-xs ' +
                  (active ? 'text-zinc-300' : 'text-zinc-500')
                }
              >
                {n}
              </span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          暂无 {STATUS_LABEL[activeStatus]} 状态的发现。
          {activeStatus === 'open' && '若刚跑完 maintenance scan job 再刷新本页。'}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
          {rows.map((f) => (
            <li key={f.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        'rounded px-1.5 py-0.5 ring-1 ring-inset ' +
                        (SEVERITY_BADGE[f.severity] ?? '')
                      }
                    >
                      {SEVERITY_LABEL[f.severity] ?? f.severity}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                      {KIND_LABEL[f.kind] ?? f.kind}
                    </span>
                    <span className="text-zinc-500">
                      {f.foundAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                    {f.documentId && (
                      <Link
                        href={`/editor/${f.documentId}`}
                        className="text-zinc-600 underline-offset-2 hover:underline"
                      >
                        打开文档
                      </Link>
                    )}
                  </div>
                  <p className="text-sm text-zinc-900">{f.summary}</p>
                  {f.details != null ? (
                    <details className="mt-1 text-xs text-zinc-500">
                      <summary className="cursor-pointer select-none">
                        细节
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 text-[11px]">
                        {JSON.stringify(f.details, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                  {f.dismissReason && (
                    <p className="mt-1 text-xs italic text-zinc-500">
                      已忽略：{f.dismissReason}
                    </p>
                  )}
                </div>
                <FindingActions findingId={f.id} status={f.status as Status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  open: '待处理',
  acknowledged: '已知悉',
  resolved: '已修复',
  dismissed: '已忽略',
};

function FindingActions({
  findingId,
  status,
}: {
  findingId: string;
  status: Status;
}) {
  if (status === 'resolved' || status === 'dismissed') return null;
  return (
    <div className="flex shrink-0 flex-col gap-1 text-xs">
      {status === 'open' && (
        <form action={transitionAction}>
          <input type="hidden" name="findingId" value={findingId} />
          <input type="hidden" name="to" value="acknowledged" />
          <button
            type="submit"
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50"
          >
            知悉
          </button>
        </form>
      )}
      <form action={transitionAction}>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="to" value="resolved" />
        <button
          type="submit"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-emerald-50"
        >
          已修复
        </button>
      </form>
      <form action={transitionAction}>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="to" value="dismissed" />
        <input
          type="text"
          name="reason"
          required
          placeholder="忽略原因…"
          className="w-28 rounded border border-zinc-300 px-1.5 py-0.5 text-[11px]"
        />
        <button
          type="submit"
          className="ml-1 rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-amber-50"
        >
          忽略
        </button>
      </form>
    </div>
  );
}

async function transitionAction(formData: FormData): Promise<void> {
  'use server';
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) throw new Error('no-principal');

  const findingId = String(formData.get('findingId') ?? '');
  const to = String(formData.get('to') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  if (!findingId || !to) return;

  const db = getDb();
  const rows = await db
    .select({
      vaultPrincipalId: schema.maintenanceFinding.vaultPrincipalId,
      status: schema.maintenanceFinding.status,
    })
    .from(schema.maintenanceFinding)
    .where(eq(schema.maintenanceFinding.id, findingId))
    .limit(1);
  if (rows.length === 0) return;
  const current = rows[0]!;
  if (current.vaultPrincipalId !== principalId) return;

  const verdict = validateTransition({
    currentStatus: current.status,
    to,
    reason,
    actorPrincipalId: principalId,
  });
  if (!verdict.ok) return;

  await db
    .update(schema.maintenanceFinding)
    .set(verdict.updates)
    .where(eq(schema.maintenanceFinding.id, findingId));

  revalidatePath('/maintenance');
}
