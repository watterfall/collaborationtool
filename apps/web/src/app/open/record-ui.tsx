import Link from 'next/link';
import * as React from 'react';

import { HeaderControls } from '@/components/chrome/HeaderControls';
import type { OpenFeedItem } from '@/lib/open-content-feed';
import type { OpenReviewDetail } from '@/lib/open-content-detail-query';
import type {
  OpenContentProvenanceStatus,
  OpenContentProvenanceSummary,
} from '@/lib/open-content-provenance';

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

export function RecordSideMeta({
  item,
  provenance,
}: {
  item: OpenFeedItem;
  provenance: OpenContentProvenanceSummary;
}) {
  const provenanceHref = provenanceApiHref(item);
  const verifierCommand =
    'pnpm --filter @collaborationtool/open-content verify:provenance provenance.json';
  const recordMode = provenanceRecordVerificationMode(item.kind);
  const rows = [
    ['status', item.status],
    ['pid', item.pid ?? 'pending'],
    ['integrity', provenanceStatusLabel(provenance.status)],
    ['algorithm', provenance.signatureAlgorithm ?? 'pending'],
    ['content hash', provenance.contentHashHex ?? 'unavailable'],
    ['merkle', provenance.merkleLogEntryId || item.merkleLogEntryId],
    ['signer', provenance.signerPrincipalId ?? 'unavailable'],
    ['public key', provenance.publicKeyFingerprint ?? 'not registered'],
    ['reviews', String(item.reviewCount)],
  ];
  return (
    <section className="flex flex-col gap-3">
      <p className="label-cap">provenance</p>
      <div
        className="border-y py-3"
        style={{ borderColor: provenanceStatusColor(provenance.status) }}
      >
        <p
          className="font-serif text-sm italic leading-[1.55]"
          style={{ color: 'var(--color-ink-2)' }}
        >
          {provenanceStatusCopy(provenance.status)}
        </p>
      </div>
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
      <Link
        href={provenanceHref}
        prefetch={false}
        className="btn-ghost w-fit font-mono text-[11px]"
      >
        Provenance JSON
      </Link>
      <div
        className="flex flex-col gap-3 border-y py-3"
        style={{ borderColor: 'var(--color-hairline)' }}
      >
        <div className="grid gap-2">
          <p className="label-cap">verification packet</p>
          <dl className="grid gap-2 font-mono text-[11px] leading-[1.45]">
            <div className="grid grid-cols-[92px_1fr] gap-2">
              <dt style={{ color: 'var(--color-ink-3)' }}>record</dt>
              <dd style={{ color: 'var(--color-ink-2)' }}>{recordMode}</dd>
            </div>
            <div className="grid grid-cols-[92px_1fr] gap-2">
              <dt style={{ color: 'var(--color-ink-3)' }}>reviews</dt>
              <dd style={{ color: 'var(--color-ink-2)' }}>public replay</dd>
            </div>
          </dl>
        </div>
        <pre
          className="whitespace-pre-wrap break-all border-l pl-3 font-mono text-[10px] leading-[1.55]"
          style={{
            borderColor: 'var(--color-pencil)',
            color: 'var(--color-ink-2)',
          }}
        >
          {verifierCommand}
        </pre>
        <div className="flex flex-wrap gap-3">
          <a
            href={provenanceHref}
            download={`${item.kind}-${item.id}-provenance.json`}
            className="btn-link font-mono text-[11px]"
          >
            Download JSON
          </a>
          <Link
            href={provenanceHref}
            prefetch={false}
            className="btn-link font-mono text-[11px]"
          >
            Open JSON
          </Link>
        </div>
      </div>
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

function provenanceApiHref(item: OpenFeedItem): string {
  const routeId =
    item.href
      .split('/')
      .filter((segment) => segment.length > 0)
      .at(-1) ?? encodeURIComponent(item.id);
  return `/api/open-content/provenance/${item.kind}/${routeId}`;
}

function provenanceRecordVerificationMode(kind: OpenFeedItem['kind']): string {
  if (kind === 'open_question') return 'public replay';
  return 'server summary';
}

function provenanceStatusLabel(status: OpenContentProvenanceStatus): string {
  if (status === 'verified') return 'verified';
  if (status === 'missing-public-key') return 'missing key';
  if (status === 'invalid-signature') return 'bad signature';
  if (status === 'hash-mismatch') return 'hash mismatch';
  if (status === 'log-mismatch') return 'log mismatch';
  if (status === 'missing-merkle-entry') return 'missing log';
  if (status === 'invalid-public-key') return 'bad key';
  if (status === 'unsigned') return 'unsigned';
  return 'unavailable';
}

function provenanceStatusCopy(status: OpenContentProvenanceStatus): string {
  if (status === 'verified') {
    return 'Canonical content, Merkle entry and Ed25519 signature verify.';
  }
  if (status === 'missing-public-key') {
    return 'The record is signed, but this signer has no registered public key yet.';
  }
  if (status === 'hash-mismatch') {
    return 'The public payload no longer matches the Merkle content hash.';
  }
  if (status === 'log-mismatch') {
    return 'The entity row and Merkle log disagree on identity or signature.';
  }
  if (status === 'invalid-signature') {
    return 'The stored Ed25519 public key does not verify this payload.';
  }
  if (status === 'unsigned') {
    return 'This record has no signature payload.';
  }
  return 'Verification is temporarily unavailable.';
}

function provenanceStatusColor(status: OpenContentProvenanceStatus): string {
  if (status === 'verified') return 'var(--color-accent-moss)';
  if (status === 'missing-public-key' || status === 'unsigned') {
    return 'var(--color-accent-ox)';
  }
  if (status === 'unavailable') return 'var(--color-hairline)';
  return 'var(--color-accent-ink)';
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
                <span style={{ color: provenanceStatusColor(review.provenance.status) }}>
                  {provenanceStatusLabel(review.provenance.status)}
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
              <dl
                className="grid gap-x-4 gap-y-2 border-y py-2 font-mono text-[11px] sm:grid-cols-3"
                style={{
                  borderColor: 'var(--color-hairline)',
                  color: 'var(--color-ink-3)',
                }}
              >
                <div className="min-w-0">
                  <dt className="uppercase tracking-[0.16em]">merkle</dt>
                  <dd className="break-words text-[10px] leading-[1.45]">
                    {review.provenance.merkleLogEntryId || review.merkleLogEntryId}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="uppercase tracking-[0.16em]">hash</dt>
                  <dd className="break-words text-[10px] leading-[1.45]">
                    {review.provenance.contentHashHex ?? 'unavailable'}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="uppercase tracking-[0.16em]">key</dt>
                  <dd className="break-words text-[10px] leading-[1.45]">
                    {review.provenance.publicKeyFingerprint ?? 'not registered'}
                  </dd>
                </div>
              </dl>
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
