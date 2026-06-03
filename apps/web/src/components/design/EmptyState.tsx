// EmptyState (Design.md v2 §5) — the centered italic-serif "nothing here yet"
// message bounded by top/bottom hairlines, replacing the inline empty-state
// blocks in settings/models, docs, triadic, open/*.
//
//   <EmptyState message="还没有论文 · No papers yet."
//     action={<Button as="a" href="/docs/new">创建第一篇 · Start one</Button>} />
//
// Zero hex — tokens + hairline.

import * as React from 'react';

import { cx } from '@/lib/cx';

export interface EmptyStateProps {
  message: string;
  /** Optional second line (e.g. a hint). */
  messageEn?: string;
  /** Optional CTA (Button/link). */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ message, messageEn, action, className }: EmptyStateProps) {
  return (
    <div className={cx('empty-state', className)} role="status">
      <p className="empty-state-message" data-prose="bilingual">
        {message}
      </p>
      {messageEn ? <p className="empty-state-sub">{messageEn}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
