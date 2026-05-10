// Mono-disc identity chip (Design.md §5.2).
//
// 28px circle (24/28/32 sm/md/lg), paper-2 bg, 1.25px pencil border,
// serif 600 monogram. Color/border switches by `kind`:
//   agent     → --color-accent-ink  (AI / model)
//   human     → --color-accent-ox   (author / coworker)
//   community → --color-accent-moss (forks / public)
//
// Implementation rides the .mono-disc[data-kind=...] selectors already
// in globals.css — no third-party avatar lib (Design.md §14).

import * as React from 'react';

import { cx } from '@/lib/cx';

export type MonoDiscKind = 'agent' | 'human' | 'community';
export type MonoDiscSize = 'sm' | 'md' | 'lg';

export interface MonoDiscProps {
  kind: MonoDiscKind;
  /** 1-2 letter monogram, serif 600. e.g. "YW" / "C" / "R". */
  monogram: string;
  /** Full actor name; used to compose bilingual aria-label. */
  actorName?: string;
  /** Optional English actor name for bilingual a11y. */
  actorNameEn?: string;
  size?: MonoDiscSize;
  className?: string;
  /** Optional override for full a11y label. */
  ariaLabel?: string;
}

const SIZE_CLASS: Record<MonoDiscSize, string> = {
  sm: 'mono-disc-sm',
  md: 'mono-disc-md',
  lg: 'mono-disc-lg',
};

// Kind-name lookup for aria-label fallback. Kept inline (3 entries) so
// the i18n dict isn't required at the leaf component.
const KIND_LABEL: Record<MonoDiscKind, { zh: string; en: string }> = {
  agent: { zh: 'AI 协作者', en: 'AI agent' },
  human: { zh: '作者', en: 'author' },
  community: { zh: '社区贡献者', en: 'community' },
};

export function MonoDisc({
  kind,
  monogram,
  actorName,
  actorNameEn,
  size = 'md',
  className,
  ariaLabel,
}: MonoDiscProps) {
  const trimmed = monogram.trim().slice(0, 2).toUpperCase();
  const fallback = KIND_LABEL[kind];
  const label =
    ariaLabel ??
    (actorName && actorNameEn
      ? `${actorName} · ${actorNameEn} (${fallback.zh} · ${fallback.en})`
      : actorName
        ? `${actorName} (${fallback.zh} · ${fallback.en})`
        : `${fallback.zh} · ${fallback.en}`);

  return (
    <span
      className={cx('mono-disc', SIZE_CLASS[size], className)}
      data-kind={kind}
      data-size={size}
      role="img"
      aria-label={label}
    >
      {trimmed}
    </span>
  );
}

export default MonoDisc;
