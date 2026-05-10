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

import { useEffect, useState } from 'react';

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        分享 / Share
      </button>
    );
  }

  const status = lastResult ? shareDialogStatusCopy(lastResult.backend) : null;
  const fallback = lastResult ? isFallbackBackend(lastResult.backend) : false;
  const copyButtonLabel =
    copyState === 'copying'
      ? COPY_BUTTON_LABEL.copying
      : copyState === 'copied'
        ? COPY_BUTTON_LABEL.copied
        : copyState === 'failed'
          ? COPY_BUTTON_LABEL.failed
          : COPY_BUTTON_LABEL.idle;

  return (
    <div className="my-4 rounded-md border border-zinc-200 bg-white p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">邀请协作者 / Invite collaborator</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 hover:text-zinc-700"
        >
          收起 ✕
        </button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-700">邮箱 / Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded border border-zinc-300 px-3 py-1.5 focus:border-zinc-900 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-700">角色 / Role</span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-1.5 focus:border-zinc-900 focus:outline-none"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        {lastResult && status && (
          <div
            data-testid="share-dialog-result"
            data-backend={lastResult.backend}
            data-fallback={fallback ? 'true' : 'false'}
            className={
              status.tone === 'amber'
                ? 'flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900'
                : 'flex flex-col gap-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900'
            }
          >
            <p className="font-medium">{status.headline}</p>
            <p className="leading-relaxed">{status.body}</p>
            <code
              data-testid="share-dialog-accept-url"
              className="break-all rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-[11px] text-zinc-800"
            >
              {lastResult.acceptUrl}
            </code>
            <button
              type="button"
              onClick={onCopyLink}
              data-testid="share-dialog-copy-button"
              data-copy-state={copyState}
              disabled={copyState === 'copying'}
              className={
                status.tone === 'amber'
                  ? 'self-start rounded-md bg-amber-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-800 disabled:opacity-50'
                  : 'self-start rounded-md bg-emerald-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-800 disabled:opacity-50'
              }
            >
              {copyButtonLabel}
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-zinc-900 px-4 py-1.5 text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? '...' : '发送邀请 / Send'}
        </button>
      </form>
      {pendingList.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-xs font-medium text-zinc-600">
            待接受 / Pending ({pendingList.length})
          </h3>
          <ul className="flex flex-col gap-1 text-xs">
            {pendingList.map((r) => (
              <li key={r.id} className="flex justify-between text-zinc-600">
                <span>{r.email}</span>
                <span>
                  {r.roleId} · 到期 {r.expiresAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
