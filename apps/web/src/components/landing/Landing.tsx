// Public-facing landing page (Server Component).
//
// Visual contract — see plan0/Design.md, especially §6.3 (Landing
// layout) and §11 (reject criteria). Don't break:
//   • paper bg + warm-near-black ink + single accent (`--accent-ink`)
//   • body serif on hero + pillar titles, sans on chrome / nav / CTAs
//   • hairline rule dividers — never filled cards / shadow boxes
//   • CJK-first headline + Latin italic counterpart, both 一等公民
//   • no zinc / blue-500 / rounded-{lg,xl,2xl} / drop-shadow
//
// Content is locale-driven; pillar diagrams are fixed-width ASCII so
// they hold up across CJK and Latin glyph widths without bespoke
// SVGs.

import * as React from 'react';
import Link from 'next/link';

import type { LocaleDict } from '@/lib/i18n/types';
import { TriadicMockup } from './TriadicMockup';
import { NightArtifactCard } from './NightArtifactCard';
import { BridgeArtifactCard } from './BridgeArtifactCard';
import { LineageGraph } from './LineageGraph';

const REPO_URL = 'https://github.com/watterfall/collaborationtool';

export function Landing({ t }: { t: LocaleDict }) {
  const hero = t.landing.hero;
  const pillars = t.landing.pillars;
  const attribution = t.landing.attribution;
  const manifesto = t.landing.manifesto;
  const diff = t.landing.differentiation;
  const specimens = t.landing.specimens;
  const arch = t.landing.architecture;
  const navL = t.landing.nav;
  const footer = t.landing.footer;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-20 px-6 py-16 lg:max-w-6xl"
      style={{ color: 'var(--color-ink)' }}
    >
      {/* Hero — v4 triadic. Desktop: 2 列（左文字 1.1fr · 右 mockup 0.9fr，
          asymmetric per Design.md §6.3 同款）。Mobile: stack 单列。 */}
      <section className="flex flex-col gap-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-x-12">
        {/* 左半 — Hero copy */}
        <div className="flex flex-col gap-6">
          <p className="label-cap">{hero.eyebrow}</p>
          <h1
            className="whitespace-pre-line font-serif text-5xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-6xl lg:text-7xl"
            style={{ color: 'var(--color-ink)' }}
            data-prose="bilingual"
          >
            {hero.headline}
          </h1>
          <p
            className="max-w-prose font-serif text-lg italic leading-[1.55] sm:text-xl"
            style={{ color: 'var(--color-ink-2)' }}
            data-prose="bilingual"
          >
            {hero.sub}
          </p>
          <p
            className="font-sans text-sm leading-[1.6]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {hero.tagline}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-primary">
              {hero.ctaPrimary}
            </Link>
            <a
              href={`${REPO_URL}/blob/main/docs/SELF_HOST.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              {hero.ctaSecondary}
            </a>
          </div>
        </div>
        {/* 右半 — TriadicMockup */}
        <div className="lg:pt-2">
          <TriadicMockup t={t} />
        </div>
      </section>

      {/* Manifesto transition (v8 C1) — single-line philosophical pull-quote
          between Hero and Pillars. Rules above and below for editorial
          treatment. Big italic serif 2xl→3xl on lg. */}
      <section>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <hr className="rule" />
          <p
            className="font-serif text-2xl italic leading-[1.35] sm:text-3xl"
            style={{ color: 'var(--color-ink)' }}
            data-prose="bilingual"
          >
            {manifesto.body}
          </p>
          <hr className="rule" />
        </div>
      </section>

      {/* Pillars — v4: 3 个空间（想点子 / 做原型 / 写论文），删 v3 的
          4 个 ASCII 微图（实现路径写法）。grid 在 ≥md 是 3 列，让"三层"
          视觉权重对齐。 */}
      <section>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
          <header className="flex flex-col gap-2">
            <p className="label-cap">{pillars.heading}</p>
            <h2
              className="font-serif text-3xl font-medium"
              style={{
                color: 'var(--color-ink)',
                letterSpacing: '-0.005em',
              }}
              data-prose="bilingual"
            >
              {pillars.sub}
            </h2>
          </header>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <Pillar
              title={pillars.thinking.title}
              desc={pillars.thinking.desc}
            />
            <Pillar
              title={pillars.prototyping.title}
              desc={pillars.prototyping.desc}
            />
            <Pillar
              title={pillars.paper.title}
              desc={pillars.paper.desc}
            />
          </div>
        </div>
      </section>

      {/* Attribution — v4 新节，反 first-author. 独立 visual 节，
          不并入 pillars grid（spec §3.3 第 4 节）。 */}
      <section>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <p className="label-cap">{attribution.heading}</p>
          <p
            className="max-w-prose font-serif text-[16px] leading-[1.78]"
            style={{ color: 'var(--color-ink)' }}
            data-prose="bilingual"
          >
            {attribution.desc}
          </p>
        </div>
      </section>

      {/* Specimens — v4: 3 张三层视角图（替代 v3 的 typst/timeline/dag
          这 3 张 Day-视角图）。Source: /public/demo/landing-specimen-
          {night,bridge,lineage}.svg。
          T7: 提前到 Differentiation 之前（spec §3.4 节顺序：访客看完
          pillar 文字立刻看到三层实物）。 */}
      <section>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="label-cap">{specimens.heading}</p>
            <p
              className="font-serif text-base italic leading-[1.6]"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              {specimens.sub}
            </p>
          </header>
          <div className="flex flex-col gap-8">
            <SpecimenBlock caption={specimens.nightCaption}>
              <NightArtifactCard />
            </SpecimenBlock>
            <SpecimenBlock caption={specimens.bridgeCaption}>
              <BridgeArtifactCard />
            </SpecimenBlock>
            <SpecimenBlock caption={specimens.lineageCaption}>
              <LineageGraph />
            </SpecimenBlock>
          </div>
        </div>
      </section>

      {/* Differentiation — 5 hairline-separated rows comparing the
          adjacent tools. ADR-0016 says the 5-year anchor is claim-level
          ORCID-signed review DAGs; this section names the contrast
          directly so a researcher landing here knows what they're
          getting that they wouldn't elsewhere.
          T7: 下沉到第 5 节（在 Specimens 之后），服务"已经感兴趣、要做
          横向比较"的访客。 */}
      <section>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="label-cap">{diff.heading}</p>
            <h2
              className="font-serif text-3xl font-medium"
              style={{
                color: 'var(--color-ink)',
                letterSpacing: '-0.005em',
              }}
              data-prose="bilingual"
            >
              {diff.sub}
            </h2>
          </header>
          <ul className="flex flex-col">
            {diff.rows.map((row, i) => (
              <li
                key={row.competitor}
                className="grid gap-x-6 gap-y-2 py-4 md:grid-cols-[120px_1fr]"
                style={
                  i > 0
                    ? { borderTop: '1px solid var(--color-hairline)' }
                    : undefined
                }
              >
                <p
                  className="font-sans text-sm"
                  style={{ color: 'var(--color-ink-2)' }}
                >
                  vs {row.competitor}
                </p>
                <div className="flex flex-col gap-1">
                  <p
                    className="font-serif text-[15px] italic leading-[1.7]"
                    style={{ color: 'var(--color-ink-3)' }}
                    data-prose="bilingual"
                  >
                    {row.theyDo}
                  </p>
                  <p
                    className="font-serif text-[15px] leading-[1.7]"
                    style={{ color: 'var(--color-ink)' }}
                    data-prose="bilingual"
                  >
                    {row.weDo}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p
            className="font-sans text-xs"
            style={{ color: 'var(--color-ink-3)' }}
            data-prose="bilingual"
          >
            {diff.footnote}
          </p>
        </div>
      </section>

      {/* Architecture — ascii diagram on a left rule (hairline-thick
          variant), serif caption sized down. */}
      <section>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <header className="flex flex-col gap-1">
            <p className="label-cap">{arch.heading}</p>
            <p
              className="font-serif text-base italic leading-[1.6]"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              {arch.sub}
            </p>
          </header>
          <pre
            className="overflow-x-auto py-2 pl-4 font-mono text-[12px] leading-[1.55]"
            style={{
              color: 'var(--color-ink-2)',
              borderLeft: '2px solid var(--color-pencil)',
            }}
            aria-label={arch.heading}
          >
            {arch.ascii.join('\n')}
          </pre>
          <p
            className="max-w-prose font-serif text-sm leading-[1.7]"
            style={{ color: 'var(--color-ink-2)' }}
            data-prose="bilingual"
          >
            {arch.caption}
          </p>
        </div>
      </section>

      {/* nav — pt-8 outer-section padding（不像其他 sections 那样
          全 className 下沉到 inner div）：rule + label 之间需要额外
          breath，节级 padding 比 inner div 自己加更干净。 */}
      <section className="pt-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <hr className="rule" />
          <p className="label-cap mt-3">{navL.heading}</p>
          <ul
            className="flex flex-wrap gap-x-6 gap-y-2 font-sans text-sm"
            style={{ color: 'var(--color-ink-2)' }}
          >
            <li>
              <a
                href={`${REPO_URL}/blob/main/README.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {navL.readme}
              </a>
            </li>
            <li>
              <a
                href={`${REPO_URL}/blob/main/plan0/ADR-INDEX.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {navL.adrIndex}
              </a>
            </li>
            <li>
              <a
                href={`${REPO_URL}/blob/main/docs/USER_GUIDE.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {navL.userGuide}
              </a>
            </li>
            <li>
              <a
                href={`${REPO_URL}/blob/main/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {navL.license}
              </a>
            </li>
          </ul>
        </div>
      </section>

      <footer className="pb-8">
        <div
          className="mx-auto flex w-full max-w-3xl flex-col gap-1 font-sans text-xs"
          style={{ color: 'var(--color-ink-3)' }}
        >
          <p>{footer.tagline}</p>
          <p>{footer.built}</p>
        </div>
      </footer>
    </main>
  );
}

// v6: specimens 改为 React HTML 组件渲染（NightArtifactCard /
// BridgeArtifactCard / LineageGraph），不再用 <img src=svg>。SpecimenBlock
// 只负责 wrap + 提供 serif italic figcaption。
function SpecimenBlock({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-2">
      {children}
      <figcaption
        className="font-serif text-sm italic leading-[1.55]"
        style={{ color: 'var(--color-ink-2)' }}
        data-prose="bilingual"
      >
        {caption}
      </figcaption>
    </figure>
  );
}

function Pillar({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <article className="flex flex-col gap-3">
      <h3
        className="font-serif text-lg font-medium leading-[1.35]"
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {title}
      </h3>
      <p
        className="font-serif text-[15px] leading-[1.78]"
        style={{ color: 'var(--color-ink-2)' }}
        data-prose="bilingual"
      >
        {desc}
      </p>
    </article>
  );
}
