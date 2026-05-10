// Phase 4 W4 dashboard: maintenance findings list.
//
// Server component fetches the current user's vault findings directly
// from PG (faster than self-fetching the HTTP route). Mutations go
// through the /api/maintenance/findings/<id>/transition route via a
// Server Action that revalidates this path.
//
// Phase 4 W10.7 — Design.md compliance:
//   - Severity badges (red/amber/blue/zinc) → StatusPill (3 states +
//     "info" treated as proposed accent-ink). Reject criteria #5 says
//     status pill 红黄绿蓝四色齐发 = P1.
//   - Status filter tabs (filled `bg-zinc-900` pill) → hairline border-
//     bottom anchors per Design.md §6.3 (links, not pills, for nav).
//   - Severity emoji icons → MonoDisc kind=agent (M monogram for
//     "Maintenance" findings — they're surfaced by the maintenance-scan
//     agent worker per ADR-0011).
//   - Cards (`rounded-md border bg-white`) → hairline list rows.

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import {
  Button,
  HairlineRule,
  MonoDisc,
  StatusPill,
  type StatusPillStatus,
} from '@/components/design';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  FINDING_STATUSES,
  validateTransition,
  severityToPillStatus,
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

const SEVERITY_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
  info: '提示',
};
const SEVERITY_LABEL_EN: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
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
    <div
      className="mx-auto max-w-5xl px-6 py-10"
      style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}
    >
      <header className="mb-6">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '30px',
            fontWeight: 500,
            letterSpacing: '-0.005em',
          }}
        >
          维护 · Maintenance
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--color-ink-3)',
            marginTop: '6px',
          }}
        >
          知识库巡检发现 · 接受 / 已修复 / 误报后归档（详见 ADR-0011 §7.4）
        </p>
        <HairlineRule weight="thick" className="mt-3" />
      </header>

      <nav
        aria-label="筛选状态 / Filter by status"
        style={{
          display: 'flex',
          gap: '18px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--color-hairline)',
          paddingBottom: '4px',
        }}
      >
        {STATUSES.map((s) => {
          const active = s === activeStatus;
          const n = c[s];
          return (
            <Link
              key={s}
              href={`/maintenance?status=${s}`}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: active ? 'var(--color-ink)' : 'var(--color-ink-3)',
                borderBottom: active
                  ? '1.5px solid var(--color-pencil)'
                  : '1px solid transparent',
                paddingBottom: '6px',
                textDecoration: 'none',
              }}
              aria-current={active ? 'page' : undefined}
            >
              {STATUS_LABEL[s]}
              <span
                style={{
                  marginLeft: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--color-ink-3)',
                }}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '14px',
            color: 'var(--color-ink-3)',
            padding: '40px 0',
            borderTop: '1px solid var(--color-hairline)',
            borderBottom: '1px solid var(--color-hairline)',
            textAlign: 'center',
          }}
        >
          暂无 {STATUS_LABEL[activeStatus]} 状态的发现 · No findings.
          {activeStatus === 'open' &&
            ' 若刚跑完 maintenance scan job 再刷新本页。'}
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            borderTop: '1px solid var(--color-hairline)',
          }}
        >
          {rows.map((f) => {
            const pillStatus: StatusPillStatus = severityToPillStatus(
              f.severity,
            );
            return (
              <li
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '16px 0',
                  borderBottom: '1px solid var(--color-hairline)',
                }}
              >
                <MonoDisc
                  kind="agent"
                  monogram="M"
                  actorName="Maintenance scan"
                  actorNameEn="Maintenance scan"
                  size="md"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <StatusPill
                      status={pillStatus}
                      label={SEVERITY_LABEL[f.severity] ?? f.severity}
                      labelEn={SEVERITY_LABEL_EN[f.severity] ?? f.severity}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--color-accent-ink)',
                      }}
                    >
                      {KIND_LABEL[f.kind] ?? f.kind}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--color-ink-3)',
                      }}
                    >
                      {f.foundAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                    {f.documentId && (
                      <Link
                        href={`/editor/${f.documentId}`}
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '12px',
                          color: 'var(--color-ink)',
                          borderBottom: '1px solid var(--color-pencil)',
                          paddingBottom: '1px',
                          textDecoration: 'none',
                        }}
                      >
                        打开文档 · Open
                      </Link>
                    )}
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '15px',
                      lineHeight: 1.6,
                      color: 'var(--color-ink)',
                      margin: 0,
                    }}
                  >
                    {f.summary}
                  </p>
                  {f.details != null ? (
                    <details
                      style={{
                        marginTop: '6px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        color: 'var(--color-ink-3)',
                      }}
                    >
                      <summary
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        细节 · Details
                      </summary>
                      <pre
                        style={{
                          marginTop: '6px',
                          padding: '10px 12px',
                          background: 'var(--color-paper-2)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--color-ink-2)',
                          overflowX: 'auto',
                          borderRadius: 'var(--radius-1)',
                        }}
                      >
                        {JSON.stringify(f.details, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                  {f.dismissReason && (
                    <p
                      style={{
                        marginTop: '4px',
                        fontFamily: 'var(--font-serif)',
                        fontStyle: 'italic',
                        fontSize: '12px',
                        color: 'var(--color-ink-3)',
                      }}
                    >
                      已忽略：{f.dismissReason}
                    </p>
                  )}
                </div>
                <FindingActions findingId={f.id} status={f.status as Status} />
              </li>
            );
          })}
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: 0,
      }}
    >
      {status === 'open' && (
        <form action={transitionAction}>
          <input type="hidden" name="findingId" value={findingId} />
          <input type="hidden" name="to" value="acknowledged" />
          <Button variant="ghost" size="sm" type="submit">
            知悉 · Ack
          </Button>
        </form>
      )}
      <form action={transitionAction}>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="to" value="resolved" />
        <Button variant="ghost" size="sm" type="submit">
          已修复 · Resolved
        </Button>
      </form>
      <form
        action={transitionAction}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="to" value="dismissed" />
        <input
          type="text"
          name="reason"
          required
          placeholder="忽略原因…"
          style={{
            width: '110px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            padding: '4px 8px',
            background: 'var(--color-paper)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-1)',
          }}
        />
        <Button variant="ghost" size="sm" type="submit">
          忽略 · Dismiss
        </Button>
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
