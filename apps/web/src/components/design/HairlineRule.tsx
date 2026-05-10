// Hairline rule (Design.md §5.8) — the default divider, replacing
// `<div class="card">` filled boxes.
//
//   weight="thin"  → 1px hairline (.rule)
//   weight="thick" → 1.5px pencil (.rule-thick)
//
// Optional `dashed` adds a 1px dashed style (uses .rule-dashed when
// thin, .rule-thick-dashed when thick) — used in proposed-but-not-applied
// transitions in the editor's revision view.

import * as React from 'react';

import { cx } from '@/lib/cx';

export type HairlineWeight = 'thin' | 'thick';

export interface HairlineRuleProps {
  weight?: HairlineWeight;
  dashed?: boolean;
  className?: string;
  /** Optional aria-label override; default is `aria-hidden`. */
  ariaLabel?: string;
}

export function HairlineRule({
  weight = 'thin',
  dashed = false,
  className,
  ariaLabel,
}: HairlineRuleProps) {
  const base = weight === 'thick' ? 'rule-thick' : 'rule';
  const dashSuffix = dashed
    ? weight === 'thick'
      ? 'rule-thick-dashed'
      : 'rule-dashed'
    : null;

  return (
    <hr
      className={cx(base, dashSuffix, className)}
      data-weight={weight}
      data-dashed={dashed || undefined}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    />
  );
}

export default HairlineRule;
