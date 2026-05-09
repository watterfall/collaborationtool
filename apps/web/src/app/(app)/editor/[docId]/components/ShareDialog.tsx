'use client';

// Phase 1.5 #1 — Share dialog. Owner enters email + role, server
// creates the invitation and emails the link (or logs it). Replaces
// the SQL-grant workaround.

import { useEffect, useState } from 'react';

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
        {lastResult && (
          <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-800">
            邀请已创建（{lastResult.backend === 'webhook' ? '邮件已发出' : 'console-only：复制下方链接给被邀者'}）：
            <br />
            <code className="break-all text-[11px]">{lastResult.acceptUrl}</code>
          </p>
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
