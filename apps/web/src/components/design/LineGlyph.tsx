// LineGlyph (Design.md v2 §5.11) — the line-art grammar wrapper for ad-hoc
// diagrams (lineage arrows, bridge edges, sketch marks). Enforces ONE
// consistent stroke language so hand-drawn diagrams stay on-brand:
//   stroke = currentColor (so it inherits the token color of its container)
//   stroke-width 1.25–1.5 (round caps/joins → the warmth lever)
//   fill = none, no feTurbulence wobble (Design.md §13 ban stays).
//
// Callers pass raw SVG children (path/line/circle/text):
//   <LineGlyph width={120} height={40} viewBox="0 0 120 40">
//     <path d="M4 20h112" /><path d="M104 12l12 8-12 8" />
//   </LineGlyph>
//
// Color a node by wrapping it in an element whose `color` is an accent token
// (e.g. style={{ color: 'var(--color-accent-ink)' }}) — never hardcode hex.

import * as React from 'react';

import { cx } from '@/lib/cx';

export interface LineGlyphProps {
  width: number;
  height: number;
  viewBox: string;
  /** 1.25–1.5 per the grammar; default 1.4 (matches Icon + block-hover-rail). */
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

export function LineGlyph({
  width,
  height,
  viewBox,
  strokeWidth = 1.4,
  className,
  ariaLabel,
  children,
}: LineGlyphProps) {
  return (
    <svg
      className={cx('line-glyph', className)}
      width={width}
      height={height}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={ariaLabel ? 'img' : undefined}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    >
      {children}
    </svg>
  );
}

export default LineGlyph;
