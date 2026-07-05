// HairlineList + ListRow (Design.md §5 / v2) — the canonical hairline list,
// replacing the inline `<ul style={{listStyle:none,borderTop:hairline}}>` +
// `<li style={{padding:'14px 0',borderBottom:hairline}}>` copy-pasted across
// settings/models, settings root, docs index, plugins.
//
// This is a LAYOUT primitive, never a DataGrid (reject #6). Callers compose
// StatusPill / MonoDisc / mono tags into `leading` / `trailing` / cells.
//
//   <HairlineList>
//     <ListRow title="claude-sonnet" meta="anthropic" trailing={<StatusPill/>} />
//   </HairlineList>
//
//   // grid mode for column layouts (e.g. docs index):
//   <HairlineList as="ol">
//     <ListRow cols="40px 1fr 180px 120px" href="/editor/x">
//       <span/>…<span/>
//     </ListRow>
//   </HairlineList>
//
// Zero hex — tokens via globals.css `.hairline-list` / `.list-row`.

import Link from 'next/link';
import * as React from 'react';

import { cx } from '@/lib/cx';

export interface HairlineListProps {
  as?: 'ul' | 'ol';
  className?: string;
  children: React.ReactNode;
}

export function HairlineList({ as = 'ul', className, children }: HairlineListProps) {
  const Tag = as;
  return <Tag className={cx('hairline-list', className)}>{children}</Tag>;
}

export interface ListRowProps {
  /** Leading element (mono-disc, index, icon). Flex mode only. */
  leading?: React.ReactNode;
  title?: React.ReactNode;
  /** Secondary bilingual / italic title line. Flex mode only. */
  titleEn?: React.ReactNode;
  meta?: React.ReactNode;
  /** Right-aligned actions / status. Stays OUTSIDE the row link. */
  trailing?: React.ReactNode;
  /** Whole-row (or row-body) navigation. */
  href?: string;
  /** Grid mode: CSS grid-template-columns. When set, render `children`. */
  cols?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ListRow({
  leading,
  title,
  titleEn,
  meta,
  trailing,
  href,
  cols,
  className,
  children,
}: ListRowProps) {
  // Grid mode — caller composes cells; row optionally a whole-row link.
  if (cols) {
    const grid = (
      <span
        className="list-row-grid"
        style={{ display: 'grid', gridTemplateColumns: cols }}
      >
        {children}
      </span>
    );
    return (
      <li className={cx('list-row', className)}>
        {href ? (
          <Link href={href} className="list-row-link">
            {grid}
          </Link>
        ) : (
          grid
        )}
      </li>
    );
  }

  // Flex mode — structured leading / main / trailing.
  const body = children ?? (
    <span className="list-row-main">
      {title ? <span className="list-row-title">{title}</span> : null}
      {titleEn ? <span className="list-row-title-en">{titleEn}</span> : null}
      {meta ? <span className="list-row-meta">{meta}</span> : null}
    </span>
  );
  const left = (
    <span className="list-row-left">
      {leading ? <span className="list-row-leading">{leading}</span> : null}
      {body}
    </span>
  );
  return (
    <li className={cx('list-row', className)}>
      {href ? (
        <Link href={href} className="list-row-link">
          {left}
        </Link>
      ) : (
        left
      )}
      {trailing ? <span className="list-row-trailing">{trailing}</span> : null}
    </li>
  );
}

export default HairlineList;
