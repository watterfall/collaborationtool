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

import Link from 'next/link';

import type { LocaleDict } from '@/lib/i18n/types';

const REPO_URL = 'https://github.com/watterfall/collaborationtool';

export function Landing({ t }: { t: LocaleDict }) {
  const hero = t.landing.hero;
  const pillars = t.landing.pillars;
  const arch = t.landing.architecture;
  const navL = t.landing.nav;
  const footer = t.landing.footer;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-20 px-6 py-16"
      style={{ color: 'var(--color-ink)' }}
    >
      {/* Hero — eyebrow label-cap + display serif headline + italic lede
          + 2 CTA. Asymmetric on a single column for the marketing
          surface; the editor/docs surfaces use the wider 1.1fr · 0.9fr
          asymmetric grid (Design.md §6.3). */}
      <section className="flex flex-col gap-6">
        <p className="label-cap">vol. 01 · issue 00 · pre-release</p>
        <h1
          className="font-serif text-4xl font-medium leading-[1.1] sm:text-5xl"
          style={{ color: 'var(--color-ink)', letterSpacing: '-0.01em' }}
          data-prose="bilingual"
        >
          {hero.headline}
        </h1>
        <p
          className="max-w-prose font-serif text-lg italic leading-[1.55]"
          style={{ color: 'var(--color-ink-2)' }}
          data-prose="bilingual"
        >
          {hero.sub}
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
        <p
          className="font-sans text-xs leading-[1.6]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          本地优先 · Markdown / MyST / Typst 为源文件 · ORCID 登录
        </p>
      </section>

      {/* Pillars — hairline-separated rows, not card grid. Each row is
          a small editorial spread: serif title + serif body + mono
          ASCII diagram on the left rule. */}
      <section className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="label-cap">{pillars.heading}</p>
          <h2
            className="font-serif text-3xl font-medium"
            style={{
              color: 'var(--color-ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {pillars.sub}
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <Pillar
            title={pillars.editor.title}
            desc={pillars.editor.desc}
            diagram={pillars.editor.diagram}
          />
          <Pillar
            title={pillars.ai.title}
            desc={pillars.ai.desc}
            diagram={pillars.ai.diagram}
          />
          <Pillar
            title={pillars.provenance.title}
            desc={pillars.provenance.desc}
            diagram={pillars.provenance.diagram}
          />
          <Pillar
            title={pillars.bilingual.title}
            desc={pillars.bilingual.desc}
            diagram={pillars.bilingual.diagram}
          />
        </div>
      </section>

      {/* Architecture — ascii diagram on a left rule (hairline-thick
          variant), serif caption sized down. */}
      <section className="flex flex-col gap-4">
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
      </section>

      {/* Bottom nav — single-line link list; hairline divider above. */}
      <section className="flex flex-col gap-3 pt-8">
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
      </section>

      <footer
        className="flex flex-col gap-1 pb-8 font-sans text-xs"
        style={{ color: 'var(--color-ink-3)' }}
      >
        <p>{footer.tagline}</p>
        <p>{footer.built}</p>
      </footer>
    </main>
  );
}

function Pillar({
  title,
  desc,
  diagram,
}: {
  title: string;
  desc: string;
  diagram: string;
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
      <pre
        className="py-1 pl-3 font-mono text-[11px] leading-[1.5]"
        style={{
          color: 'var(--color-ink-3)',
          borderLeft: '1px solid var(--color-hairline)',
        }}
      >
        {diagram}
      </pre>
    </article>
  );
}
