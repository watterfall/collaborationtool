// Icon (Design.md v2 §5.10) — local line-icon set, NOT emoji (reject #4),
// NOT a runtime dependency (no Phosphor). One consistent grammar:
// 24×24 viewBox, stroke=currentColor, stroke-width 1.4, round caps/joins,
// fill=none. Colors come from the surrounding `color` (token), never hex —
// so an icon inside an accent-ink element tints itself.
//
//   <Icon name="idea" />                 // decorative (aria-hidden)
//   <Icon name="paper" ariaLabel="论文 · paper" />  // labelled
//
// Add new glyphs to ICON_PATHS; keep stroke-only path data (no fills, no hex).

import * as React from 'react';

import { cx } from '@/lib/cx';

export type IconName =
  | 'idea'
  | 'prototype'
  | 'paper'
  | 'arrow-right'
  | 'arrow-down'
  | 'check'
  | 'pen'
  | 'agent'
  | 'evidence'
  | 'export'
  | 'search'
  | 'plus'
  | 'lineage'
  | 'lock';

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 };

// Stroke-only 24×24 path data. currentColor + fill:none enforced on <svg>.
const ICON_PATHS: Record<IconName, React.ReactNode> = {
  // a spark / half-formed thought
  idea: (
    <>
      <path d="M12 3v2M5 6l1.4 1.4M19 6l-1.4 1.4M4 12H2M22 12h-2" />
      <path d="M9 16a5 5 0 1 1 6 0c-.7.5-1 1.2-1 2H10c0-.8-.3-1.5-1-2Z" />
      <path d="M10 21h4" />
    </>
  ),
  // a flask / prototype
  prototype: (
    <>
      <path d="M9 3h6M10 3v6l-4.5 8a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  // a manuscript page
  paper: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </>
  ),
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  check: <path d="M5 12.5 10 17 19 7" />,
  pen: (
    <>
      <path d="M4 20h4L20 8a2 2 0 0 0-3-3L5 17Z" />
      <path d="M14.5 6.5 17.5 9.5" />
    </>
  ),
  // a small node-with-orbit, used for AI/agent
  agent: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M18 18l-2-2M18 6l-2 2M6 18l2-2" />
    </>
  ),
  // chain link — evidence binding
  evidence: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8 16a3 3 0 0 1-4-4l2.5-2.5" />
      <path d="M16 8a3 3 0 0 1 4 4l-2.5 2.5" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 14v5h14v-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  // three nodes joined — lineage
  lineage: (
    <>
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 6.6 17 11.4M7 17.4 17 12.6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
  /** When set, the icon is exposed to AT with this label; else aria-hidden. */
  ariaLabel?: string;
}

export function Icon({ name, size = 'md', className, ariaLabel }: IconProps) {
  const px = SIZE_PX[size];
  return (
    <svg
      className={cx('line-icon', className)}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-icon={name}
      role={ariaLabel ? 'img' : undefined}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export default Icon;
