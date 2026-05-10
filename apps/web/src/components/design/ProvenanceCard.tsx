// Provenance card (Design.md §5.4).
//
// Three sections, separated by 1.5px hairlines (no SVG filter — §13
// rejects "wob"):
//   1. label-cap "PROVENANCE · ¶ N · {kind}"
//   2. mono-disc + actor name + time
//   3. commit intent (italic) / prompt (mono) / tool calls / hash · model · cost
//
// Tokens: paper bg + 1.5px solid hairline (.rule-thick on dividers).

import * as React from 'react';

import { cx } from '@/lib/cx';
import { MonoDisc, type MonoDiscKind } from './MonoDisc';

export interface ProvenanceCardToolCall {
  name: string;
  ms: number;
}

export interface ProvenanceCardProps {
  /** Provenance "kind" — e.g. "agent inline edit" / "manual revision". */
  kind: string;
  /** Paragraph anchor index — rendered as "¶ N" in the cap. */
  paragraphIndex?: number;
  actorMonogram: string;
  actorName: string;
  actorKind: MonoDiscKind;
  time: Date | string;
  /** Italicized commit intent — one sentence. */
  commitIntent?: string;
  /** Original prompt — rendered in mono pre-block, no syntax highlight. */
  prompt?: string;
  /** Tool calls list — `name · ms`. */
  toolCalls?: ProvenanceCardToolCall[];
  /** Cryptographic hash of the request (mono). */
  hash?: string;
  /** Model identifier — e.g. "claude-3-5-sonnet". */
  model?: string;
  /** Cost stamp — e.g. "$0.0034 · 1.2k tokens". */
  cost?: string;
  className?: string;
}

function formatTime(t: Date | string): string {
  const d = typeof t === 'string' ? new Date(t) : t;
  if (Number.isNaN(d.getTime())) return typeof t === 'string' ? t : '';
  return d.toISOString().replace('T', ' ').replace(/:\d{2}\.\d+Z$/, 'Z');
}

export function ProvenanceCard({
  kind,
  paragraphIndex,
  actorMonogram,
  actorName,
  actorKind,
  time,
  commitIntent,
  prompt,
  toolCalls,
  hash,
  model,
  cost,
  className,
}: ProvenanceCardProps) {
  const cap =
    paragraphIndex !== undefined
      ? `PROVENANCE · ¶ ${paragraphIndex} · ${kind}`
      : `PROVENANCE · ${kind}`;

  return (
    <article
      className={cx('provenance-card', className)}
      aria-label={`Provenance · ${kind} · ${actorName}`}
    >
      {/* Section 1 — label-cap header */}
      <header className="provenance-card-cap">
        <span className="label-cap">{cap}</span>
      </header>

      <hr className="rule-thick" />

      {/* Section 2 — actor identity */}
      <section className="provenance-card-actor">
        <MonoDisc
          kind={actorKind}
          monogram={actorMonogram}
          actorName={actorName}
          size="md"
        />
        <span className="provenance-card-actor-name">{actorName}</span>
        <span className="provenance-card-actor-time">
          <time dateTime={typeof time === 'string' ? time : time.toISOString()}>
            {formatTime(time)}
          </time>
        </span>
      </section>

      <hr className="rule-thick" />

      {/* Section 3 — intent / prompt / tools / hash */}
      <section className="provenance-card-detail">
        {commitIntent && (
          <p className="provenance-card-intent">
            <em>“{commitIntent}”</em>
          </p>
        )}
        {prompt && (
          <pre className="provenance-card-prompt">
            <code>{prompt}</code>
          </pre>
        )}
        {toolCalls && toolCalls.length > 0 && (
          <ul className="provenance-card-tools" aria-label="Tool calls">
            {toolCalls.map((tc, i) => (
              <li key={`${tc.name}-${i}`}>
                <code>{tc.name}</code>
                <span aria-hidden="true"> · </span>
                <span>{tc.ms}ms</span>
              </li>
            ))}
          </ul>
        )}
        {(hash || model || cost) && (
          <p className="provenance-card-meta">
            {hash && <code className="provenance-card-hash">{hash}</code>}
            {hash && (model || cost) && (
              <span aria-hidden="true"> · </span>
            )}
            {model && <span className="provenance-card-model">{model}</span>}
            {model && cost && <span aria-hidden="true"> · </span>}
            {cost && <span className="provenance-card-cost">{cost}</span>}
          </p>
        )}
      </section>
    </article>
  );
}

export default ProvenanceCard;
