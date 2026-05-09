'use client';

import { useCallback, useEffect, useState } from 'react';

import RevisionDiff, { type RevisionForDiff } from './RevisionDiff';

export interface RevisionInboxProps {
  documentId: string;
}

interface InboxResponse {
  revisions: RevisionForDiff[];
  error?: string;
}

export default function RevisionInbox({ documentId }: RevisionInboxProps) {
  const [revisions, setRevisions] = useState<RevisionForDiff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  const refresh = useCallback(() => setPollKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/revision?docId=${encodeURIComponent(documentId)}`,
          { cache: 'no-store' },
        );
        const body = (await res.json()) as InboxResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? `HTTP ${res.status}`);
          setRevisions([]);
          return;
        }
        setRevisions(body.revisions);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setRevisions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, pollKey]);

  return (
    <section className="my-6 rounded-md border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
        <div>
          <h3 className="text-sm font-medium">
            待评审修订 / Pending revisions
          </h3>
          {revisions !== null && (
            <p className="text-xs text-zinc-500">
              {loading ? '加载中…' : `${revisions.length} 条待处理`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
          disabled={loading}
        >
          刷新 / Reload
        </button>
      </header>

      {error ? (
        <div className="px-4 py-3 text-xs text-red-700" role="alert">
          {error === 'no-review-capability'
            ? '你没有 block.review 权限，看不到他人提议。'
            : error}
        </div>
      ) : !revisions ? (
        <div className="px-4 py-3 text-xs text-zinc-500">加载中…</div>
      ) : revisions.length === 0 ? (
        <div className="px-4 py-3 text-xs text-zinc-500">
          没有待评审的修订。Agent 提议会出现在这里。
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {revisions.map((rev) => (
            <li key={rev.id} className="px-4 py-3">
              <RevisionDiff revision={rev} onActed={refresh} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
