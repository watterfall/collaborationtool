'use client';

// Phase 4 W10.7 — Design.md compliance: replaced `rounded-md border bg-white`
// container + `bg-zinc-100` reload button with hairline border + ghost
// Button. Reject criteria #2 / #5 / #6.

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/design';

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
    <section
      style={{
        marginTop: '24px',
        marginBottom: '24px',
        background: 'var(--color-paper)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-2)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <div>
          <h3
            className="label-cap"
            style={{ color: 'var(--color-ink-3)' }}
          >
            PENDING REVISIONS · 待评审修订
          </h3>
          {revisions !== null && (
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                color: 'var(--color-ink-3)',
                marginTop: '2px',
              }}
            >
              {loading ? '加载中…' : `${revisions.length} 条待处理`}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          刷新 · Reload
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '12px',
            color: 'var(--color-accent-ox)',
          }}
        >
          {error === 'no-review-capability'
            ? '你没有 block.review 权限，看不到他人提议。'
            : error}
        </div>
      ) : !revisions ? (
        <div
          style={{
            padding: '12px 16px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '12px',
            color: 'var(--color-ink-3)',
          }}
        >
          加载中…
        </div>
      ) : revisions.length === 0 ? (
        <div
          style={{
            padding: '12px 16px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '12px',
            color: 'var(--color-ink-3)',
          }}
        >
          没有待评审的修订 · Agent 提议会出现在这里。
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {revisions.map((rev, i) => (
            <li
              key={rev.id}
              style={{
                padding: '12px 16px',
                borderTop: i === 0 ? 0 : '1px solid var(--color-hairline)',
              }}
            >
              <RevisionDiff revision={rev} onActed={refresh} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
