// Status pill (Design.md §5.3) — outlined, never filled.
// 999px radius is allowed by §4.2 exception for pill semantic elements.
//
// Three statuses:
//   proposed → accent-ink   (AI proposal awaiting review)
//   applied  → accent-moss  (community / fork has applied)
//   blocked  → accent-ox    (human author has rejected)
//
// Bilingual label is the rule, not the exception (Design.md §3.4):
// `开始写作 · Start writing`.

import * as React from 'react';

import { cx } from '@/lib/cx';

export type StatusPillStatus = 'proposed' | 'applied' | 'blocked';

export interface StatusPillProps {
  status: StatusPillStatus;
  /** Chinese label (rendered first, before middle dot). */
  label?: string;
  /** English label (rendered after `·`). */
  labelEn?: string;
  className?: string;
  /** Override for ARIA — defaults to `<status code>: zh · en`. */
  ariaLabel?: string;
}

// Default labels used when caller wants the canonical zh/en pair.
const DEFAULT_LABEL: Record<StatusPillStatus, { zh: string; en: string }> = {
  proposed: { zh: '已提议', en: 'Proposed' },
  applied: { zh: '已采纳', en: 'Applied' },
  blocked: { zh: '已驳回', en: 'Blocked' },
};

export function StatusPill({
  status,
  label,
  labelEn,
  className,
  ariaLabel,
}: StatusPillProps) {
  const def = DEFAULT_LABEL[status];
  const zh = label ?? def.zh;
  const en = labelEn ?? def.en;
  const a11y = ariaLabel ?? `${status}: ${zh} · ${en}`;

  return (
    <span
      className={cx('pill', className)}
      data-state={status}
      role="status"
      aria-label={a11y}
    >
      <span lang="zh">{zh}</span>
      <span aria-hidden="true"> · </span>
      <span lang="en">{en}</span>
    </span>
  );
}

export default StatusPill;
