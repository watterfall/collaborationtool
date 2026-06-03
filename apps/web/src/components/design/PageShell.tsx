// PageShell (Design.md v2 §5) — the centered `mx-auto max-w-* px-* py-*`
// page container repeated on every app/public page. `width` is a token, not
// an arbitrary value, so the JIT sees static class strings.
//
//   <PageShell width="default"> … </PageShell>
//
// Zero hex — bg/color via tokens.

import * as React from 'react';

import { cx } from '@/lib/cx';

export type PageWidth = 'prose' | 'default' | 'wide';

// Static class strings (JIT-safe — never string-built).
const WIDTH_CLASS: Record<PageWidth, string> = {
  prose: 'max-w-2xl',
  default: 'max-w-3xl',
  wide: 'max-w-6xl',
};

export interface PageShellProps {
  width?: PageWidth;
  className?: string;
  children: React.ReactNode;
}

export function PageShell({ width = 'default', className, children }: PageShellProps) {
  return (
    <div
      className={cx('mx-auto px-6 py-10', WIDTH_CLASS[width], className)}
      style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}
    >
      {children}
    </div>
  );
}

export default PageShell;
