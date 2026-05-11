// Wave D-4 (ADR-0020 §2.7) — Triadic UI sub-layout.
//
// Renders a 4-tab nav under the standard app chrome. The 4 surfaces map
// 1:1 to the 4 roles declared in `@collaborationtool/discovery-graph`
// (Explorer→/discover, Bridge-builder→/translate, Validator→/manuscript,
// Connector→/network). Tabs are visually *equal-prominent* per ADR-0020
// §2.1 "three equal outputs" — none is "the main one".
//
// Design.md compliance:
//   - hairline divider under nav (not box-shadow)
//   - serif label + sans subtitle bilingual per §3.4
//   - no rounded-* / no bg-zinc-* / no shadow-* (reject §11)
//   - 999px pill exception not used here — active link uses
//     1.5px ink underline (§5.1 button-link pattern)

import Link from 'next/link';
import type { ReactNode } from 'react';

import { HairlineRule } from '@/components/design';

const TABS: ReadonlyArray<{
  href: string;
  zh: string;
  en: string;
  role: string;
}> = [
  { href: '/triadic', zh: '总览', en: 'Overview', role: '所有角色 · all roles' },
  {
    href: '/triadic/discover',
    zh: '探索',
    en: 'Discover',
    role: 'Explorer · 夜科学家',
  },
  {
    href: '/triadic/translate',
    zh: '桥接',
    en: 'Translate',
    role: 'Bridge-builder · 桥接者',
  },
  {
    href: '/triadic/manuscript',
    zh: '论文',
    en: 'Manuscript',
    role: 'Validator · 日科学家',
  },
  {
    href: '/triadic/network',
    zh: '联通',
    en: 'Network',
    role: 'Connector · 边界穿越者',
  },
];

export default function TriadicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="flex flex-col gap-3">
        <p
          className="font-sans uppercase tracking-widest"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          ADR-0020 · Night-Bridge-Day Triadic Architecture
        </p>
        <h1
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '30px',
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
          }}
        >
          <span lang="zh">三层等价知识产出</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Three Equal Outputs
          </span>
        </h1>
        <p
          className="font-serif"
          style={{
            color: 'var(--color-ink-2)',
            fontSize: '17px',
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}
        >
          <span lang="zh">夜科学探索 · 桥接转化 · 日科学验证 —— 各有 attribution、各有 archive、各有 citation。</span>
          <br />
          <span lang="en">
            Night exploration / Bridge translation / Day validation — each
            with its own attribution, archive, and citation.
          </span>
        </p>
      </header>
      <HairlineRule className="my-6" />
      <nav
        aria-label="Triadic surfaces"
        className="flex flex-wrap gap-x-6 gap-y-2 font-sans"
        style={{ fontSize: '13px', color: 'var(--color-ink-2)' }}
      >
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="underline-offset-4 hover:underline"
            style={{ color: 'var(--color-ink-2)' }}
          >
            <span lang="zh">{t.zh}</span>
            <span aria-hidden="true"> · </span>
            <span lang="en">{t.en}</span>
            <span
              className="ml-2"
              style={{
                color: 'var(--color-ink-3)',
                fontSize: '11px',
              }}
            >
              {t.role}
            </span>
          </Link>
        ))}
      </nav>
      <HairlineRule className="mt-6 mb-8" />
      {/* React 19 + Next.js 15 typing workaround — see comment in
       * `apps/web/src/app/layout.tsx`. */}
      <>{children}</>
    </div>
  );
}
