// Public open collaboration ledger.
//
// This route sits outside (app) so anonymous researchers can inspect
// signed questions, datasets and share snapshots without the auth shell.

import type { Metadata } from 'next';
import Link from 'next/link';

import { HeaderControls } from '@/components/chrome/HeaderControls';
import { getLocale } from '@/lib/i18n/get-locale';
import {
  parseFeedFilter,
  type FeedKind,
  type OpenFeedItem,
} from '@/lib/open-content-feed';
import { loadOpenContentFeedSafely } from '@/lib/open-content-feed-query';

export const dynamic = 'force-dynamic';

type RawSearchParams = Record<string, string | string[] | undefined>;

const KIND_TABS: Array<{
  kind: FeedKind;
  label: string;
  note: string;
}> = [
  {
    kind: 'open_question',
    label: 'Questions · 问题',
    note: 'Unresolved research questions that strangers can answer.',
  },
  {
    kind: 'open_dataset',
    label: 'Datasets · 数据集',
    note: 'Citable, licensed data artifacts with signed provenance.',
  },
  {
    kind: 'share_snapshot',
    label: 'Snapshots · 快照',
    note: 'Published sections, preprints and shareable working notes.',
  },
];

const KIND_LABEL: Record<FeedKind, string> = {
  open_question: 'Open question · 开放问题',
  open_dataset: 'Dataset · 数据集',
  share_snapshot: 'Snapshot · 快照',
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Open collaboration ledger · 开放协作账本',
    description:
      'A public feed of signed research questions, datasets and snapshots from CollaborationTool.',
  };
}

export default async function OpenLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams>;
}) {
  const [locale, rawParams] = await Promise.all([
    getLocale(),
    searchParams ?? Promise.resolve({}),
  ]);
  const params = toURLSearchParams(rawParams);
  const filter = parseFeedFilter(params);
  const result = await loadOpenContentFeedSafely(filter);
  const queryString = params.toString();
  const jsonHref = `/api/open-content/feed${queryString ? `?${queryString}` : ''}`;
  const copy = locale === 'zh' ? zhCopy : enCopy;

  return (
    <div
      style={{
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
      }}
    >
      <header
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          background: 'var(--color-paper)',
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link
            href="/"
            className="font-serif text-base font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--color-ink)' }}
          >
            探索工作室 · Inquiry Studio
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

      <main
        id="main"
        className="mx-auto flex min-h-screen max-w-6xl flex-col gap-14 px-6 py-12"
      >
        <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div className="flex flex-col gap-5">
            <p className="label-cap">{copy.eyebrow}</p>
            <h1
              className="max-w-3xl font-serif text-5xl font-medium leading-[1.02] sm:text-6xl"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              Open collaboration ledger
              <br />
              开放协作账本
            </h1>
            <p
              className="max-w-2xl font-serif text-lg italic leading-[1.62]"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              {copy.sub}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href={jsonHref} className="btn-primary">
                JSON feed
              </a>
              <Link href="/" className="btn-ghost">
                Inquiry Studio
              </Link>
            </div>
          </div>

          <dl
            className="grid grid-cols-3 gap-0 border-y py-5"
            style={{ borderColor: 'var(--color-hairline)' }}
          >
            <LedgerStat
              label={copy.stats.total}
              value={result.feed.summary.totalItems}
            />
            <LedgerStat
              label={copy.stats.signed}
              value={result.feed.summary.signedItems}
            />
            <LedgerStat
              label={copy.stats.reviewed}
              value={result.feed.summary.reviewedItems}
            />
          </dl>
        </section>

        {result.unavailable ? (
          <section
            className="border-y py-5"
            style={{ borderColor: 'var(--color-accent-ox)' }}
          >
            <p
              className="font-serif text-base leading-[1.7]"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              {copy.unavailable}
            </p>
          </section>
        ) : null}

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="label-cap">{copy.filterLabel}</p>
            <nav
              aria-label="Open content feeds"
              className="grid gap-3 md:grid-cols-3"
            >
              {KIND_TABS.map((tab) => (
                <FeedTab
                  key={tab.kind}
                  tab={tab}
                  active={tab.kind === filter.kind}
                />
              ))}
            </nav>
          </div>

          {result.feed.items.length > 0 ? (
            <ol className="flex flex-col">
              {result.feed.items.map((item) => (
                <FeedRow
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  locale={locale}
                />
              ))}
            </ol>
          ) : (
            <div
              className="border-y py-10"
              style={{ borderColor: 'var(--color-hairline)' }}
            >
              <p
                className="font-serif text-xl italic leading-[1.5]"
                style={{ color: 'var(--color-ink-2)' }}
                data-prose="bilingual"
              >
                {copy.empty}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FeedTab({
  tab,
  active,
}: {
  tab: (typeof KIND_TABS)[number];
  active: boolean;
}) {
  return (
    <Link
      href={`/open?kind=${tab.kind}`}
      className="flex min-h-[96px] flex-col justify-between gap-3 border p-4 transition-colors hover:bg-[--color-paper-2]"
      style={{
        borderColor: active ? 'var(--color-pencil)' : 'var(--color-hairline)',
        background: active ? 'var(--color-paper-2)' : 'transparent',
      }}
      aria-current={active ? 'page' : undefined}
    >
      <span
        className="font-serif text-lg leading-[1.25]"
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {tab.label}
      </span>
      <span
        className="font-sans text-xs leading-[1.45]"
        style={{ color: 'var(--color-ink-3)' }}
      >
        {tab.note}
      </span>
    </Link>
  );
}

function LedgerStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex flex-col gap-2 px-4 first:pl-0 last:pr-0"
      style={{ borderLeft: '1px solid var(--color-hairline)' }}
    >
      <dt
        className="font-sans text-[10px] uppercase tracking-[0.18em]"
        style={{ color: 'var(--color-ink-3)' }}
      >
        {label}
      </dt>
      <dd
        className="font-serif text-4xl leading-none tabular-nums"
        style={{ color: 'var(--color-ink)' }}
      >
        {value}
      </dd>
    </div>
  );
}

function FeedRow({
  item,
  locale,
}: {
  item: OpenFeedItem;
  locale: 'zh' | 'en';
}) {
  return (
    <li
      className="grid gap-x-8 gap-y-4 py-7 md:grid-cols-[180px_1fr]"
      style={{ borderTop: '1px solid var(--color-hairline)' }}
    >
      <aside className="flex flex-col gap-2 font-sans text-xs">
        <span className="label-cap">{KIND_LABEL[item.kind]}</span>
        <time style={{ color: 'var(--color-ink-3)' }}>
          {formatDate(item.createdAt, locale)}
        </time>
        <span style={{ color: 'var(--color-ink-2)' }}>
          {item.reviewCount} review{item.reviewCount === 1 ? '' : 's'}
        </span>
      </aside>

      <article className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2
            className="font-serif text-2xl font-medium leading-[1.22]"
            style={{ color: 'var(--color-ink)' }}
            data-prose="bilingual"
          >
            <Link
              href={item.href}
              className="underline-offset-4 hover:underline"
              style={{ color: 'var(--color-ink)' }}
            >
              {item.title}
            </Link>
          </h2>
          <p
            className="font-serif text-[16px] leading-[1.72]"
            style={{ color: 'var(--color-ink-2)' }}
            data-prose="bilingual"
          >
            {item.excerpt}
          </p>
        </div>

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

        <div
          className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {item.meta.map((meta) => (
            <span key={meta}>{meta}</span>
          ))}
          <span>{item.status}</span>
          <span>{item.signed ? 'signed' : 'unsigned'}</span>
        </div>
      </article>
    </li>
  );
}

function toURLSearchParams(rawParams: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  return params;
}

function formatDate(value: Date, locale: 'zh' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(value);
}

const zhCopy = {
  eyebrow: '开放科学 · signed public work',
  sub:
    '把未解决的问题、可复用数据和可引用快照放到同一个可核验公共界面里。每一行都保留签名、Merkle 线索和同行回应入口。',
  filterLabel: '选择开放协作对象',
  unavailable:
    '当前数据库不可用，页面先保留公共账本入口。服务恢复后会自动显示签名问题、数据集和快照。',
  empty: '还没有可公开读取的条目。下一步是从编辑器发布问题、数据集或分享快照。',
  stats: {
    total: 'total',
    signed: 'signed',
    reviewed: 'reviewed',
  },
};

const enCopy = {
  eyebrow: 'Open science · signed public work',
  sub:
    'A verifiable public surface for unresolved questions, reusable datasets and citable snapshots. Each row carries signature state, Merkle identity and peer-response signals.',
  filterLabel: 'Choose an open collaboration surface',
  unavailable:
    'The database is unavailable, so this page is keeping the public ledger route online. Signed questions, datasets and snapshots will appear when the service recovers.',
  empty:
    'No public entries yet. The next step is to publish a question, dataset or share snapshot from the editor.',
  stats: {
    total: 'total',
    signed: 'signed',
    reviewed: 'reviewed',
  },
};
