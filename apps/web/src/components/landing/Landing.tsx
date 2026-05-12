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
  const diff = t.landing.differentiation;
  const specimens = t.landing.specimens;
  const arch = t.landing.architecture;
  const navL = t.landing.nav;
  const footer = t.landing.footer;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-20 px-6 py-16"
      style={{ color: 'var(--color-ink)' }}
    >
      {/* Hero — v4 triadic positioning. H1 巨号 display serif，
          拆 3 行（whitespace-pre-line 解析 \n）。tagline 是新字段，
          放在 H1 + sub 之间。Mockup 在 Task 3 加，本 task hero
          仍单列。 */}
      <section className="flex flex-col gap-6">
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

      {/* Differentiation — 4 hairline-separated rows comparing the
          adjacent tools. ADR-0016 says the 5-year anchor is claim-level
          ORCID-signed review DAGs; this section names the contrast
          directly so a researcher landing here knows what they're
          getting that they wouldn't elsewhere. */}
      <section className="flex flex-col gap-6">
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
      </section>

      {/* Specimens — 3 image figures showing real outputs. Local SVGs
          shipped from /public/demo/ so the landing renders even with
          JS off. Each figure is a hairline-bordered <figure> + serif
          caption. Image links open the source SVG in a new tab so
          designers can copy / inspect. */}
      <section className="flex flex-col gap-6">
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
          <SpecimenFigure
            src="/demo/landing-specimen-typst.svg"
            alt={specimens.typstAlt}
            caption={specimens.typstCaption}
            aspectRatio="480 / 600"
          />
          <SpecimenFigure
            src="/demo/landing-specimen-timeline.svg"
            alt={specimens.timelineAlt}
            caption={specimens.timelineCaption}
            aspectRatio="480 / 360"
          />
          <SpecimenFigure
            src="/demo/desci-review-pilot-fig1.svg"
            alt={specimens.dagAlt}
            caption={specimens.dagCaption}
            aspectRatio="720 / 360"
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

function SpecimenFigure({
  src,
  alt,
  caption,
  aspectRatio,
}: {
  src: string;
  alt: string;
  caption: string;
  aspectRatio: string;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <a href={src} target="_blank" rel="noopener noreferrer">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio,
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-paper)',
          }}
        />
      </a>
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
