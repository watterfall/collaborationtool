// Block hover-rail (Design.md §5.6).
//
// Four 22px sketch glyphs stacked vertically alongside a paragraph:
//   lock · propose · cite · history
//
// opacity: 0 by default; hover (or keyboard focus) reveals 0.85.
// Icons are inline SVG with 1.4px stroke (Design.md §13 — Phosphor-bold
// shape language without pulling phosphor as a dependency).

import * as React from 'react';

import { cx } from '@/lib/cx';

export interface BlockHoverRailProps {
  blockId: string;
  onLock: (blockId: string) => void;
  onPropose: (blockId: string) => void;
  onCite: (blockId: string) => void;
  onHistory: (blockId: string) => void;
  /** Forces the rail visible regardless of hover (useful when block is
   *  already focused for keyboard nav). */
  alwaysVisible?: boolean;
  className?: string;
}

interface RailIconProps {
  glyph: 'lock' | 'propose' | 'cite' | 'history';
}

function RailIcon({ glyph }: RailIconProps) {
  // 22px square outline icons. Stroke 1.4px to match §13 spec.
  // Each glyph is intentionally minimal — no fills, no gradients.
  switch (glyph) {
    case 'lock':
      return (
        <svg
          viewBox="0 0 22 22"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <rect x="5" y="10" width="12" height="8" rx="1" />
          <path d="M7.5 10 V7 a3.5 3.5 0 0 1 7 0 V10" />
        </svg>
      );
    case 'propose':
      return (
        <svg
          viewBox="0 0 22 22"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <path d="M4 17 L13 8 L17 12 L8 21 L3 21 Z" transform="translate(0 -3)" />
          <path d="M13 8 L15 6 a1.5 1.5 0 0 1 2 2 L15 10" />
        </svg>
      );
    case 'cite':
      return (
        <svg
          viewBox="0 0 22 22"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <path d="M5 7 q-1 4 0 8 h4 v-5 H6 q0-2 1-3 z" />
          <path d="M13 7 q-1 4 0 8 h4 v-5 h-3 q0-2 1-3 z" />
        </svg>
      );
    case 'history':
      return (
        <svg
          viewBox="0 0 22 22"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M11 7 V11 L14 13" />
        </svg>
      );
  }
}

interface RailButtonProps {
  glyph: 'lock' | 'propose' | 'cite' | 'history';
  labelZh: string;
  labelEn: string;
  onClick: () => void;
}

function RailButton({ glyph, labelZh, labelEn, onClick }: RailButtonProps) {
  return (
    <button
      type="button"
      className="block-hover-rail-btn"
      data-glyph={glyph}
      onClick={onClick}
      aria-label={`${labelZh} · ${labelEn}`}
    >
      <RailIcon glyph={glyph} />
    </button>
  );
}

export function BlockHoverRail({
  blockId,
  onLock,
  onPropose,
  onCite,
  onHistory,
  alwaysVisible,
  className,
}: BlockHoverRailProps) {
  return (
    <div
      className={cx(
        'block-hover-rail',
        alwaysVisible && 'block-hover-rail-visible',
        className,
      )}
      data-block-id={blockId}
      role="toolbar"
      aria-label={`段落操作 · Block actions (${blockId})`}
    >
      <RailButton
        glyph="lock"
        labelZh="锁定段落"
        labelEn="Lock paragraph"
        onClick={() => onLock(blockId)}
      />
      <RailButton
        glyph="propose"
        labelZh="提议修改"
        labelEn="Propose edit"
        onClick={() => onPropose(blockId)}
      />
      <RailButton
        glyph="cite"
        labelZh="引用文献"
        labelEn="Cite source"
        onClick={() => onCite(blockId)}
      />
      <RailButton
        glyph="history"
        labelZh="查看历史"
        labelEn="History"
        onClick={() => onHistory(blockId)}
      />
    </div>
  );
}

export default BlockHoverRail;
