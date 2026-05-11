// Wave D-4 — /triadic/manuscript (Day surface, Validator role).
//
// Skeleton: points to existing Day-layer surfaces (/docs, /maintenance,
// /reviewer-inbox, /claim lineage). The Day layer is not new in Wave D —
// Phase 4 already built it; this page reframes those surfaces as one
// of three equal outputs rather than "the main one".
//
// Per ADR-0020 §1.3: existing claim/evidence/render-* / reviewer-agent /
// commit serializer all retained as Day-layer adapters. We DO NOT
// downgrade or replace them — we declare equivalence with Night/Bridge.

import Link from 'next/link';

import { HairlineRule, MonoDisc, StatusPill } from '@/components/design';

interface DayLink {
  href: string;
  zh: string;
  en: string;
  intentZh: string;
}

const DAY_LINKS: ReadonlyArray<DayLink> = [
  {
    href: '/docs',
    zh: '论文 / 文档',
    en: 'Papers / Docs',
    intentZh:
      '现有文档树。CRDT 协作 + 双管线渲染 (MyST HTML / Typst PDF)。',
  },
  {
    href: '/maintenance',
    zh: '维护扫描',
    en: 'Maintenance',
    intentZh:
      '7 类 finding（unsupported-claim / outdated-source / duplicated-claim / contradicted-conclusion / unverified-ai-block / broken-citation / unverified-claim）+ 转移状态机。',
  },
  {
    href: '/reviewer-inbox',
    zh: 'Reviewer 收件箱',
    en: 'Reviewer Inbox',
    intentZh:
      'Claim-on-Claim Review · ORCID 签名 · 7 天老化 · mine-only / exclude-mine 过滤。',
  },
];

export default function ManuscriptPage() {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex items-baseline gap-3">
        <MonoDisc kind="community" monogram="D" size="md" />
        <h2
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '30px',
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
          }}
        >
          <span lang="zh">日科学验证</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Day Validation
          </span>
        </h2>
        <StatusPill
          status="applied"
          label="Phase 4 已交付"
          labelEn="Phase 4 shipped"
          className="ml-auto"
        />
      </header>

      <p
        className="font-serif"
        style={{
          color: 'var(--color-ink-2)',
          fontSize: '17px',
          lineHeight: 1.78,
        }}
        lang="zh"
      >
        Day 层是 Phase 4 已交付内容，**不被本 ADR 替换或降级**。本页只是把它叙事重定位为"三类等价产出之一"，与 Night/Bridge 同等 prominent。
      </p>
      <p
        className="font-serif"
        style={{
          color: 'var(--color-ink-3)',
          fontSize: '15px',
          lineHeight: 1.7,
          fontStyle: 'italic',
        }}
        lang="en"
      >
        Day surfaces shipped in Phase 4 — this page does <strong>not</strong>{' '}
        replace or downgrade them. It re-frames them as one of three equal
        outputs, no longer &ldquo;the main one&rdquo;.
      </p>

      <HairlineRule />

      <section aria-labelledby="day-surfaces" className="flex flex-col gap-3">
        <h3
          id="day-surfaces"
          className="font-sans uppercase"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          <span lang="zh">已交付的 Day 表面</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Shipped Day surfaces</span>
        </h3>
        <ul className="flex flex-col">
          {DAY_LINKS.map((d, idx) => (
            <li
              key={d.href}
              className="flex flex-col gap-1 py-4"
              style={{
                borderTop:
                  idx === 0 ? '1px solid var(--color-hairline)' : 'none',
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="font-mono"
                  style={{
                    color: 'var(--color-ink-3)',
                    fontSize: '11px',
                    width: '2.5rem',
                    fontFeatureSettings: "'onum' 1",
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <Link
                  href={d.href}
                  className="font-serif underline-offset-4 hover:underline"
                  style={{
                    color: 'var(--color-accent-moss)',
                    fontSize: '17px',
                  }}
                  lang="zh"
                >
                  {d.zh}
                </Link>
                <span
                  className="font-serif"
                  style={{
                    color: 'var(--color-ink-2)',
                    fontSize: '15px',
                    fontStyle: 'italic',
                  }}
                  lang="en"
                >
                  {d.en}
                </span>
                <span
                  className="ml-auto font-mono"
                  style={{
                    color: 'var(--color-ink-3)',
                    fontSize: '11px',
                  }}
                >
                  {d.href}
                </span>
              </div>
              <p
                className="font-serif"
                style={{
                  color: 'var(--color-ink-2)',
                  fontSize: '15px',
                  lineHeight: 1.7,
                  paddingLeft: '3.5rem',
                }}
                lang="zh"
              >
                {d.intentZh}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <HairlineRule />

      <p
        className="font-serif"
        style={{
          color: 'var(--color-ink-3)',
          fontSize: '13px',
          lineHeight: 1.7,
          fontStyle: 'italic',
        }}
      >
        <span lang="zh">
          Day artifact atomic units = claim · evidence · manuscript · code · data。
          contribution-graph attribution 跨三层共享 —— 论文不再"独占"
          authorship。
        </span>
      </p>
    </article>
  );
}
