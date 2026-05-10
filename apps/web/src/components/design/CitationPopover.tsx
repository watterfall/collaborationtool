// Citation popover (Design.md §5.5) — CrossRef-shaped APA card.
//
// Layout:
//   <author>. "<title>". <journal> · <volume>(<issue>), pp.<pages> · <year>
//   doi:10.xx/yy   (mono, dotted underline accent-ink)
//   [Bind to claim] (primary)   [Open] (ghost)
//
// We don't pull Radix Popover — this component is the popover *body*;
// positioning is the caller's job (already wired in editor-core's
// CitationDOIMenu). Caller can portal/anchor as needed.

import * as React from 'react';

import { cx } from '@/lib/cx';
import { Button } from './Button';

export interface CitationPopoverProps {
  authors: string;
  title: string;
  journal: string;
  volume?: string;
  issue?: string;
  pages?: string;
  year: number;
  doi: string;
  /** Bind the citation to the current claim (¶ in editor). */
  onBindToClaim: () => void;
  /** Open the DOI in a new tab — caller decides target / rel. */
  onOpen: () => void;
  /** Optional paragraph anchor for the bind CTA — e.g. "¶ 12". */
  paragraphAnchor?: string;
  className?: string;
  /** Bilingual a11y label override for the wrapper. */
  ariaLabel?: string;
}

export function CitationPopover({
  authors,
  title,
  journal,
  volume,
  issue,
  pages,
  year,
  doi,
  onBindToClaim,
  onOpen,
  paragraphAnchor,
  className,
  ariaLabel,
}: CitationPopoverProps) {
  // APA-style assembly. Empty parts collapse, no trailing dot.
  const volPart = volume ? (issue ? `${volume}(${issue})` : volume) : null;
  const pagesPart = pages ? `pp.${pages}` : null;
  const detailParts = [journal, volPart, pagesPart, String(year)].filter(
    (x): x is string => Boolean(x),
  );

  const bindLabel = paragraphAnchor
    ? `Bind to claim · ${paragraphAnchor}`
    : 'Bind to claim';

  return (
    <div
      className={cx('citation-popover', className)}
      role="dialog"
      aria-label={ariaLabel ?? `Citation · ${title}`}
    >
      <div className="citation-popover-body">
        <p className="citation-popover-author">{authors}</p>
        <p className="citation-popover-title">
          <em>“{title}”</em>
        </p>
        <p className="citation-popover-detail">
          {detailParts.map((part, i) => (
            <React.Fragment key={`${part}-${i}`}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              <span>{part}</span>
            </React.Fragment>
          ))}
        </p>
        <p className="citation-popover-doi">
          <a
            href={`https://doi.org/${doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="citation-popover-doi-link"
          >
            <code>doi:{doi}</code>
          </a>
        </p>
      </div>
      <div className="citation-popover-actions">
        <Button
          variant="primary"
          size="sm"
          onClick={onBindToClaim}
          ariaLabel="绑定到论点"
          ariaLabelEn={bindLabel}
        >
          {bindLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpen}
          ariaLabel="打开 DOI"
          ariaLabelEn="Open DOI"
        >
          Open
        </Button>
      </div>
    </div>
  );
}

export default CitationPopover;
