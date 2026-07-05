// PageHeader + SectionHeader (Design.md v2 §5) — the serif H1 / H2 + meta +
// actions + hairline header repeated on docs / settings / orgs / etc.
//
//   <PageHeader title="模型 · Models" meta="…" actions={<Button/>} />
//   <SectionHeader cap="ADD PREF · 添加偏好" />
//
// Zero hex — tokens + .label-cap + HairlineRule.

import * as React from 'react';

import { cx } from '@/lib/cx';

import { HairlineRule } from './HairlineRule';

export interface PageHeaderProps {
  /** Optional small label-cap eyebrow above the title. */
  eyebrow?: string;
  title: string;
  /** Optional italic ` · {titleEn}` counterpart appended to the H1. */
  titleEn?: string;
  /** Meta line below the title (sans, ink-3). Can be a node for rich meta. */
  meta?: React.ReactNode;
  /** Right-aligned actions (buttons). */
  actions?: React.ReactNode;
  /** Render the thick hairline under the header (default true). */
  rule?: boolean;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  titleEn,
  meta,
  actions,
  rule = true,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx('page-header', className)}>
      <div className="page-header-row">
        <div className="page-header-titles">
          {eyebrow ? <p className="label-cap">{eyebrow}</p> : null}
          <h1 className="page-header-title">
            {title}
            {titleEn ? <span className="page-header-title-en"> · {titleEn}</span> : null}
          </h1>
          {meta ? <div className="page-header-meta">{meta}</div> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>
      {rule ? <HairlineRule weight="thick" className="page-header-rule" /> : null}
    </header>
  );
}

export interface SectionHeaderProps {
  /** label-cap eyebrow (e.g. "ADD PREF · 添加偏好"). */
  cap?: string;
  /** Optional serif H2 title under the cap. */
  title?: string;
  titleEn?: string;
  className?: string;
}

export function SectionHeader({ cap, title, titleEn, className }: SectionHeaderProps) {
  return (
    <div className={cx('section-header', className)}>
      {cap ? <p className="label-cap">{cap}</p> : null}
      {title ? (
        <h2 className="section-header-title">
          {title}
          {titleEn ? <span className="section-header-title-en"> · {titleEn}</span> : null}
        </h2>
      ) : null}
    </div>
  );
}

export default PageHeader;
