'use client';

import { useState } from 'react';

export interface RevisionForDiff {
  id: string;
  proposedBy: string;
  status: 'draft' | 'proposed';
  rationale: string | null;
  proposalMetadata: {
    revisedFragments?: Array<{
      originalText: string;
      replacementText: string;
      citationId?: string;
      citationCslJson?: Record<string, unknown>;
    }>;
    uncertainties?: string[];
  } | null;
  createdAt: string;
}

export interface RevisionDiffProps {
  revision: RevisionForDiff;
  onActed: () => void;
}

type Pending = 'accept' | 'reject' | 'modify' | null;

export default function RevisionDiff({
  revision,
  onActed,
}: RevisionDiffProps) {
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showModifyForm, setShowModifyForm] = useState(false);
  const [modifyRationale, setModifyRationale] = useState(
    revision.rationale ?? '',
  );
  const [modifyFragments, setModifyFragments] = useState(
    () =>
      revision.proposalMetadata?.revisedFragments?.map((f) => ({
        originalText: f.originalText,
        replacementText: f.replacementText,
      })) ?? [],
  );

  async function call(action: 'accept' | 'reject' | 'modify', body?: unknown) {
    setPending(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/revision/${encodeURIComponent(revision.id)}/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body !== undefined ? JSON.stringify(body) : '',
        },
      );
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(errBody.detail ?? errBody.error ?? `HTTP ${res.status}`);
        return;
      }
      onActed();
    } finally {
      setPending(null);
    }
  }

  const fragments = revision.proposalMetadata?.revisedFragments ?? [];
  const uncertainties = revision.proposalMetadata?.uncertainties ?? [];
  const isAgentProposal = revision.proposedBy.startsWith('agent:');
  const dateStr = new Date(revision.createdAt)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16);

  return (
    <div className="text-sm">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500">
            {isAgentProposal ? 'Agent' : 'User'} ·{' '}
            <code className="text-[10px]">{revision.proposedBy.slice(0, 24)}</code>
            {' · '}
            {dateStr}
          </p>
          {revision.rationale && (
            <p className="mt-1 text-zinc-700">{revision.rationale}</p>
          )}
        </div>
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
          {revision.status}
        </span>
      </header>

      {fragments.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs">
          {fragments.map((f, i) => (
            <li key={i}>
              <div className="text-red-700">- {f.originalText}</div>
              <div className="text-green-700">+ {f.replacementText}</div>
              {f.citationId && (
                <div className="text-[10px] text-zinc-500">
                  citation: {f.citationId}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {uncertainties.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <strong>Uncertainties:</strong>
          <ul className="ml-4 list-disc">
            {uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="备注 / notes (可选)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void call('accept', notes ? { notes } : undefined)}
          disabled={pending !== null}
          className="rounded-md bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending === 'accept' ? '...' : 'Accept'}
        </button>
        <button
          type="button"
          onClick={() => void call('reject', notes ? { notes } : undefined)}
          disabled={pending !== null}
          className="rounded-md bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending === 'reject' ? '...' : 'Reject'}
        </button>
        <button
          type="button"
          onClick={() => setShowModifyForm((v) => !v)}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100"
        >
          {showModifyForm ? 'Cancel modify' : 'Modify…'}
        </button>
      </div>

      {showModifyForm && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
          <h5 className="mb-1 font-medium">反提议 / Counter-propose</h5>
          <label className="block">
            <span className="text-zinc-700">Rationale</span>
            <input
              type="text"
              value={modifyRationale}
              onChange={(e) => setModifyRationale(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 focus:border-zinc-900 focus:outline-none"
            />
          </label>
          {modifyFragments.map((f, i) => (
            <div key={i} className="mt-2 grid grid-cols-2 gap-1">
              <input
                type="text"
                value={f.originalText}
                onChange={(e) =>
                  setModifyFragments((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, originalText: e.target.value } : x,
                    ),
                  )
                }
                className="rounded-md border border-zinc-300 px-2 py-1 font-mono"
                placeholder="originalText"
              />
              <input
                type="text"
                value={f.replacementText}
                onChange={(e) =>
                  setModifyFragments((prev) =>
                    prev.map((x, j) =>
                      j === i
                        ? { ...x, replacementText: e.target.value }
                        : x,
                    ),
                  )
                }
                className="rounded-md border border-zinc-300 px-2 py-1 font-mono"
                placeholder="replacementText"
              />
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setModifyFragments((p) => [
                  ...p,
                  { originalText: '', replacementText: '' },
                ])
              }
              className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] hover:bg-zinc-100"
            >
              + fragment
            </button>
            <button
              type="button"
              onClick={() =>
                void call('modify', {
                  rationale: modifyRationale,
                  revisedFragments: modifyFragments,
                  ...(notes ? { notes } : {}),
                })
              }
              disabled={pending !== null || modifyFragments.length === 0}
              className="rounded-md bg-zinc-900 px-3 py-1 text-xs text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending === 'modify' ? '...' : 'Submit counter-proposal'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
