'use client';

// Phase 1.5 #1 — Share dialog. Owner enters email + role, server
// creates the invitation and emails the link (or logs it). Replaces
// the SQL-grant workaround.
//
// Phase 4 W6.5 — when MAIL_WEBHOOK_URL is not configured the server
// only logs the acceptUrl to stderr (mailer backend = 'console'). For
// self-host deployments that flow leaves普通 user 够不着邀请链接 —
// `.brainstorm/role-user.md §2` 列为 onboarding 阻塞点。本组件在
// fallback 分支必须显式渲染 acceptUrl + 一键复制 + 中英双语提示。
//
// Phase 4 W10.7 — refactored from `bg-amber-100` / `bg-emerald-100`
// banner colors (Design.md reject #5: "status pill 红黄绿蓝四色齐发")
// to a single `<StatusPill>` whose status reflects mail outcome:
//   webhook OK  → status=applied   (邮件已发送 / Mail dispatched)
//   fallback    → status=blocked   (邮件未配置 / Mail unsent)
// The acceptUrl + copy button stay in both branches; the helper
// `shareDialogStatusCopy` keeps tone='emerald'|'amber' for backwards
// compatibility with the W6.5 unit tests, but tone is no longer used
// for color — only as the StatusPill status mapping below.

import { useEffect, useState } from 'react';

import { Button, HairlineRule, StatusPill } from '@/components/design';
import {
  COPY_BUTTON_LABEL,
  copyTextToClipboard,
  isFallbackBackend,
  shareDialogStatusCopy,
} from '@/lib/share-dialog-fallback';

interface PendingRow {
  id: string;
  email: string;
  roleId: string;
  expiresAt: string;
  createdAt: string;
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'paper-author', label: 'paper-author（共同作者）' },
  { value: 'paper-reviewer', label: 'paper-reviewer（评审）' },
  { value: 'commenter', label: 'commenter（仅评论）' },
];

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

export default function ShareDialog({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('paper-reviewer');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingList, setPendingList] = useState<PendingRow[]>([]);
  const [lastResult, setLastResult] = useState<
    { acceptUrl: string; backend: string } | null
  >(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/document/${documentId}/invitation`);
      if (!res.ok) return;
      const data = (await res.json()) as { pending: PendingRow[] };
      if (!cancelled) setPendingList(data.pending);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setLastResult(null);
    setCopyState('idle');
    try {
      const res = await fetch(`/api/document/${documentId}/invitation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, roleId }),
      });
      const data = (await res.json()) as {
        id?: string;
        acceptUrl?: string;
        email?: { backend: string };
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(data.detail || data.error || `HTTP ${res.status}`);
      } else if (data.acceptUrl && data.email) {
        setLastResult({ acceptUrl: data.acceptUrl, backend: data.email.backend });
        setEmail('');
        // Re-fetch the pending list.
        const list = await fetch(`/api/document/${documentId}/invitation`);
        if (list.ok) {
          const j = (await list.json()) as { pending: PendingRow[] };
          setPendingList(j.pending);
        }
      }
    } finally {
      setPending(false);
    }
  }

  async function onCopyLink() {
    if (!lastResult) return;
    setCopyState('copying');
    const ok = await copyTextToClipboard(lastResult.acceptUrl);
    setCopyState(ok ? 'copied' : 'failed');
    if (ok) {
      // Reset back to idle after a beat so the affordance stays usable.
      setTimeout(() => {
        setCopyState((s) => (s === 'copied' ? 'idle' : s));
      }, 2000);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        分享 · Share
      </Button>
    );
  }

  const status = lastResult ? shareDialogStatusCopy(lastResult.backend) : null;
  const fallback = lastResult ? isFallbackBackend(lastResult.backend) : false;
  // Map W6.5 helper tone → Design.md StatusPill status (reject #5).
  // amber = mail backend not configured → blocked (oxblood accent)
  // emerald = mail dispatched           → applied (moss accent)
  const pillStatus: 'blocked' | 'applied' | null = status
    ? status.tone === 'amber'
      ? 'blocked'
      : 'applied'
    : null;
  const pillLabelZh = status
    ? status.tone === 'amber'
      ? '邮件未配置'
      : '邮件已发送'
    : '';
  const pillLabelEn = status
    ? status.tone === 'amber'
      ? 'Mail unsent'
      : 'Mail dispatched'
    : '';
  const copyButtonLabel =
    copyState === 'copying'
      ? COPY_BUTTON_LABEL.copying
      : copyState === 'copied'
        ? COPY_BUTTON_LABEL.copied
        : copyState === 'failed'
          ? COPY_BUTTON_LABEL.failed
          : COPY_BUTTON_LABEL.idle;

  return (
    <section
      className="my-4"
      style={{
        background: 'var(--color-paper)',
        border: '1px solid var(--color-hairline)',
        padding: '14px 16px',
        fontSize: '13px',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '17px',
            fontWeight: 500,
            color: 'var(--color-ink)',
          }}
        >
          邀请协作者 · Invite collaborator
        </h2>
        <Button
          variant="link"
          size="sm"
          onClick={() => setOpen(false)}
          ariaLabel="收起对话框"
          ariaLabelEn="Close dialog"
        >
          收起 ×
        </Button>
      </div>
      <HairlineRule />
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span
            className="label-cap"
            style={{ color: 'var(--color-ink-3)' }}
          >
            EMAIL · 邮箱
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              padding: '6px 10px',
              background: 'var(--color-paper)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-1)',
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span
            className="label-cap"
            style={{ color: 'var(--color-ink-3)' }}
          >
            ROLE · 角色
          </span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              padding: '6px 10px',
              background: 'var(--color-paper)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-1)',
            }}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p
            role="alert"
            style={{
              color: 'var(--color-accent-ox)',
              borderLeft: '2px solid var(--color-accent-ox)',
              paddingLeft: '10px',
              fontStyle: 'italic',
              fontSize: '12px',
            }}
          >
            {error}
          </p>
        )}
        {lastResult && status && pillStatus && (
          <div
            data-testid="share-dialog-result"
            data-backend={lastResult.backend}
            data-fallback={fallback ? 'true' : 'false'}
            data-tone={status.tone}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderLeft: `2px solid ${
                pillStatus === 'blocked'
                  ? 'var(--color-accent-ox)'
                  : 'var(--color-accent-moss)'
              }`,
              padding: '10px 12px',
              background: 'transparent',
            }}
          >
            <div className="flex items-center gap-2">
              <StatusPill
                status={pillStatus}
                label={pillLabelZh}
                labelEn={pillLabelEn}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  color: 'var(--color-ink-3)',
                }}
              >
                {status.headline}
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '13px',
                lineHeight: 1.6,
                color: 'var(--color-ink-2)',
                fontStyle: 'italic',
                margin: 0,
              }}
            >
              {status.body}
            </p>
            <code
              data-testid="share-dialog-accept-url"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-ink)',
                background: 'var(--color-paper-2)',
                padding: '6px 10px',
                wordBreak: 'break-all',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-1)',
              }}
            >
              {lastResult.acceptUrl}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyLink}
              data-testid="share-dialog-copy-button"
              data-copy-state={copyState}
              disabled={copyState === 'copying'}
              className="self-start"
            >
              {copyButtonLabel}
            </Button>
          </div>
        )}
        <Button
          variant="primary"
          size="sm"
          type="submit"
          disabled={pending}
          className="self-start"
        >
          {pending ? '...' : '发送邀请 · Send'}
        </Button>
      </form>
      {pendingList.length > 0 && (
        <div className="mt-4">
          <HairlineRule />
          <h3
            className="label-cap mt-3"
            style={{ color: 'var(--color-ink-3)' }}
          >
            PENDING · 待接受（{pendingList.length}）
          </h3>
          <ul
            style={{
              marginTop: '6px',
              padding: 0,
              listStyle: 'none',
              fontSize: '12px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {pendingList.map((r) => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--color-ink-2)',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--color-hairline)',
                }}
              >
                <span>{r.email}</span>
                <span style={{ color: 'var(--color-ink-3)' }}>
                  {r.roleId} · 到期 {r.expiresAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
