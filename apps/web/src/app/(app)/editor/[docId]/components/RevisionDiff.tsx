'use client';

// Phase 4 W10.7 — Design.md compliance:
//   - amber/emerald/red filled badges → StatusPill (proposed/applied/blocked)
//   - removed `bg-zinc-50` fragment block backgrounds
//   - accept/reject/modify buttons go through SoT Button
//   - text-red / text-green diff coloring kept (it's diff semantics, not
//     status pills, and Design.md §11 #5 narrowly bans pills with red+
//     green together — diff +/- colored text is editorial precedent)
//
// Note: text-red-700 / text-green-700 in fragment diffs are recolored to
// editorial accent-ox / accent-moss tokens.

import { useState } from 'react';

import { Button, StatusPill } from '@/components/design';

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

  const fieldStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    padding: '6px 10px',
    background: 'var(--color-paper)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-hairline)',
    borderRadius: 'var(--radius-1)',
  };

  return (
    <div style={{ fontSize: '13px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              color: 'var(--color-ink-3)',
              margin: 0,
            }}
          >
            {isAgentProposal ? 'Agent' : 'User'} ·{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-accent-ink)',
              }}
            >
              {revision.proposedBy.slice(0, 24)}
            </code>
            {' · '}
            {dateStr}
          </p>
          {revision.rationale && (
            <p
              style={{
                marginTop: '4px',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: '13px',
                color: 'var(--color-ink-2)',
              }}
            >
              “{revision.rationale}”
            </p>
          )}
        </div>
        <StatusPill
          status="proposed"
          label={revision.status === 'draft' ? '草稿' : '已提议'}
          labelEn={revision.status === 'draft' ? 'Draft' : 'Proposed'}
        />
      </header>

      {fragments.length > 0 && (
        <ul
          style={{
            marginTop: '8px',
            listStyle: 'none',
            padding: '8px 12px',
            background: 'var(--color-paper-2)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}
        >
          {fragments.map((f, i) => (
            <li key={i}>
              <div style={{ color: 'var(--color-accent-ox)' }}>
                − {f.originalText}
              </div>
              <div style={{ color: 'var(--color-accent-moss)' }}>
                + {f.replacementText}
              </div>
              {f.citationId && (
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-ink-3)',
                    marginTop: '2px',
                  }}
                >
                  citation: {f.citationId}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {uncertainties.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            borderLeft: '2px solid var(--color-accent-ox)',
            padding: '6px 12px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '12px',
            color: 'var(--color-ink-2)',
          }}
        >
          <strong style={{ fontStyle: 'normal' }}>Uncertainties:</strong>
          <ul
            style={{
              margin: '4px 0 0 0',
              paddingLeft: '20px',
              listStyle: 'disc',
            }}
          >
            {uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <input
          type="text"
          placeholder="备注 · notes (可选)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...fieldStyle, flex: 1 }}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void call('accept', notes ? { notes } : undefined)}
          disabled={pending !== null}
        >
          {pending === 'accept' ? '...' : 'Accept'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void call('reject', notes ? { notes } : undefined)}
          disabled={pending !== null}
        >
          {pending === 'reject' ? '...' : 'Reject'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowModifyForm((v) => !v)}
        >
          {showModifyForm ? 'Cancel modify' : 'Modify…'}
        </Button>
      </div>

      {showModifyForm && (
        <div
          style={{
            marginTop: '12px',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-paper-2)',
            padding: '12px 14px',
            fontSize: '12px',
          }}
        >
          <h5
            className="label-cap"
            style={{
              color: 'var(--color-ink-3)',
              marginBottom: '6px',
            }}
          >
            COUNTER-PROPOSE · 反提议
          </h5>
          <label style={{ display: 'block' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                color: 'var(--color-ink-2)',
              }}
            >
              Rationale
            </span>
            <input
              type="text"
              value={modifyRationale}
              onChange={(e) => setModifyRationale(e.target.value)}
              style={{ ...fieldStyle, width: '100%', marginTop: '4px' }}
            />
          </label>
          {modifyFragments.map((f, i) => (
            <div
              key={i}
              style={{
                marginTop: '8px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
              }}
            >
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
                style={fieldStyle}
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
                style={fieldStyle}
                placeholder="replacementText"
              />
            </div>
          ))}
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setModifyFragments((p) => [
                  ...p,
                  { originalText: '', replacementText: '' },
                ])
              }
            >
              + fragment
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                void call('modify', {
                  rationale: modifyRationale,
                  revisedFragments: modifyFragments,
                  ...(notes ? { notes } : {}),
                })
              }
              disabled={pending !== null || modifyFragments.length === 0}
            >
              {pending === 'modify' ? '...' : 'Submit counter-proposal'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: 'var(--color-accent-ox)',
            borderLeft: '2px solid var(--color-accent-ox)',
            paddingLeft: '10px',
            fontStyle: 'italic',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
