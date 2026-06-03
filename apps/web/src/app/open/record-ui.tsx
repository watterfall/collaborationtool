import Link from 'next/link';
import * as React from 'react';

import { HeaderControls } from '@/components/chrome/HeaderControls';
import type { OpenFeedItem } from '@/lib/open-content-feed';
import type { OpenReviewDetail } from '@/lib/open-content-detail-query';

export function OpenPublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}>
      <header
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          background: 'var(--color-paper)',
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link
            href="/open"
            className="font-serif text-base font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--color-ink)' }}
          >
            Open ledger · 开放账本
          </Link>
          <div
            className="flex flex-wrap items-center gap-4 font-sans text-sm"
            style={{ color: 'var(--color-ink-2)' }}
          >
            <Link
              href="/login"
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink-2)' }}
            >
              Sign in · 登录
            </Link>
            <HeaderControls pathname="/open" />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export function OpenRecordLayout({
  item,
  children,
  side,
}: {
  item: OpenFeedItem;
  children: React.ReactNode;
  side: React.ReactNode;
}) {
  return (
    <OpenPublicChrome>
      <main
        id="main"
        className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_280px]"
      >
        <article className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-4">
            <Link
              href="/open"
              className="btn-link w-fit"
              style={{ color: 'var(--color-ink-2)' }}
            >
              Back to ledger
            </Link>
            <p className="label-cap">{kindLabel(item.kind)}</p>
            <h1
              className="font-serif text-4xl font-medium leading-[1.08] sm:text-5xl"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              {item.title}
            </h1>
            <p
              className="max-w-3xl font-serif text-lg italic leading-[1.62]"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              {item.excerpt}
            </p>
          </header>
          {children}
        </article>
        <aside className="flex flex-col gap-6">{side}</aside>
      </main>
    </OpenPublicChrome>
  );
}

export function PublicRecordUnavailable() {
  return (
    <OpenPublicChrome>
      <main id="main" className="mx-auto flex min-h-screen max-w-3xl px-6 py-16">
        <section
          className="flex flex-col gap-4 border-y py-8"
          style={{ borderColor: 'var(--color-accent-ox)' }}
        >
          <p className="label-cap">temporarily unavailable</p>
          <h1
            className="font-serif text-3xl"
            style={{ color: 'var(--color-ink)' }}
          >
            The public record could not be loaded.
          </h1>
          <p
            className="font-serif text-base leading-[1.72]"
            style={{ color: 'var(--color-ink-2)' }}
          >
            数据库暂时不可用。公共链接保留，服务恢复后会重新显示记录。
          </p>
        </section>
      </main>
    </OpenPublicChrome>
  );
}

export function RecordNotFound() {
  return (
    <OpenPublicChrome>
      <main id="main" className="mx-auto flex min-h-screen max-w-3xl px-6 py-16">
        <section
          className="flex flex-col gap-4 border-y py-8"
          style={{ borderColor: 'var(--color-hairline)' }}
        >
          <p className="label-cap">not found</p>
          <h1
            className="font-serif text-3xl"
            style={{ color: 'var(--color-ink)' }}
          >
            This public record is unavailable.
          </h1>
          <Link href="/open" className="btn-ghost w-fit">
            Open ledger
          </Link>
        </section>
      </main>
    </OpenPublicChrome>
  );
}

export function MarkdownPane({ content }: { content: string }) {
  return (
    <section
      className="border-y py-6"
      style={{ borderColor: 'var(--color-hairline)' }}
    >
      <pre
        className="whitespace-pre-wrap break-words font-serif text-[16px] leading-[1.78]"
        style={{ color: 'var(--color-ink)' }}
      >
        {content}
      </pre>
    </section>
  );
}

export function RecordSideMeta({ item }: { item: OpenFeedItem }) {
  const rows = [
    ['status', item.status],
    ['pid', item.pid ?? 'pending'],
    ['signed', item.signed ? 'yes' : 'no'],
    ['merkle', item.merkleLogEntryId],
    ['reviews', String(item.reviewCount)],
  ];
  return (
    <section className="flex flex-col gap-3">
      <p className="label-cap">provenance</p>
      <dl className="flex flex-col">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-2 py-3"
            style={{ borderTop: '1px solid var(--color-hairline)' }}
          >
            <dt
              className="font-sans text-[10px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-ink-3)' }}
            >
              {label}
            </dt>
            <dd
              className="break-words font-mono text-[11px] leading-[1.5]"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="border px-2 py-1 font-sans text-xs"
              style={{
                borderColor: 'var(--color-hairline)',
                color: 'var(--color-ink-2)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ReviewThread({ reviews }: { reviews: OpenReviewDetail[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <p className="label-cap">peer responses</p>
        <span
          className="font-mono text-xs"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {reviews.length}
        </span>
      </div>
      {reviews.length === 0 ? (
        <p
          className="border-y py-5 font-serif text-sm italic leading-[1.6]"
          style={{
            borderColor: 'var(--color-hairline)',
            color: 'var(--color-ink-2)',
          }}
        >
          No public responses yet.
        </p>
      ) : (
        <ol className="flex flex-col">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col gap-3 py-5"
              style={{ borderTop: '1px solid var(--color-hairline)' }}
            >
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                <span style={{ color: 'var(--color-ink)' }}>
                  {review.verdict}
                </span>
                <span style={{ color: 'var(--color-ink-3)' }}>
                  ORCID {review.reviewerOrcidId}
                </span>
                <span style={{ color: 'var(--color-ink-3)' }}>
                  {formatUtc(review.createdAt)}
                </span>
              </div>
              <p
                className="font-serif text-[15px] leading-[1.7]"
                style={{ color: 'var(--color-ink-2)' }}
                data-prose="bilingual"
              >
                {review.bodyMd}
              </p>
              {review.evidenceRefs.length > 0 ? (
                <p
                  className="font-mono text-[11px]"
                  style={{ color: 'var(--color-ink-3)' }}
                >
                  evidence: {review.evidenceRefs.join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function formatUtc(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(value);
}

function kindLabel(kind: OpenFeedItem['kind']) {
  if (kind === 'open_question') return 'open question · 开放问题';
  if (kind === 'open_dataset') return 'dataset · 数据集';
  return 'snapshot · 快照';
}
