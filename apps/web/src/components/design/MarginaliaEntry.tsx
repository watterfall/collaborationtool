// Marginalia entry (Design.md §5.7) — margin annotation in the editor's
// 360px right rail (or anywhere a comment / agent revision lands).
//
// Layout: 2px left border in accent color · 12px padding · caption-cap
// actor + time · 2-line italic body · optional pill + meta footer.

import * as React from 'react';

import { cx } from '@/lib/cx';
import { StatusPill, type StatusPillStatus } from './StatusPill';

export type MarginaliaAccent = 'agent' | 'human' | 'community';

export interface MarginaliaEntryProps {
  accent: MarginaliaAccent;
  actorMonogram: string;
  actorName: string;
  /** Optional English actor name for bilingual a11y. */
  actorNameEn?: string;
  time: Date | string;
  /** Margin body — 2 lines italic (CJK or Latin). */
  body: React.ReactNode;
  /** Optional pill — matches StatusPill statuses. */
  pillLabel?: string;
  pillLabelEn?: string;
  pillStatus?: StatusPillStatus;
  /** Optional meta line (caption sans, ink-3) — e.g. "tool · 240ms". */
  meta?: string;
  className?: string;
}

function formatTime(t: Date | string): string {
  const d = typeof t === 'string' ? new Date(t) : t;
  if (Number.isNaN(d.getTime())) return typeof t === 'string' ? t : '';
  return d.toISOString().replace('T', ' ').replace(/:\d{2}\.\d+Z$/, 'Z');
}

export function MarginaliaEntry({
  accent,
  actorMonogram,
  actorName,
  actorNameEn,
  time,
  body,
  pillLabel,
  pillLabelEn,
  pillStatus,
  meta,
  className,
}: MarginaliaEntryProps) {
  const a11yActor = actorNameEn ? `${actorName} · ${actorNameEn}` : actorName;
  return (
    <aside
      className={cx('margin-entry', className)}
      data-kind={accent}
      aria-label={`Margin annotation · ${a11yActor}`}
    >
      <header className="margin-entry-head">
        <span className="margin-entry-monogram" aria-hidden="true">
          {actorMonogram.trim().slice(0, 2).toUpperCase()}
        </span>
        <span className="margin-entry-actor label-cap" data-kind={accent}>
          {actorName}
          {actorNameEn && (
            <>
              <span aria-hidden="true"> · </span>
              <span lang="en">{actorNameEn}</span>
            </>
          )}
        </span>
        <span className="margin-entry-time">
          <time dateTime={typeof time === 'string' ? time : time.toISOString()}>
            {formatTime(time)}
          </time>
        </span>
      </header>
      <div className="margin-entry-body">
        <em>{body}</em>
      </div>
      {(pillStatus || meta) && (
        <footer className="margin-entry-foot">
          {pillStatus && (
            <StatusPill
              status={pillStatus}
              label={pillLabel}
              labelEn={pillLabelEn}
            />
          )}
          {meta && <span className="margin-entry-meta">{meta}</span>}
        </footer>
      )}
    </aside>
  );
}

export default MarginaliaEntry;
