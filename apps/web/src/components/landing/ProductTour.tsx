// ProductTour (Design.md v2 §6.3) — the abstract→concrete fix for the
// landing. Three REAL product screenshots in a problem→solution rhythm,
// shown right after the hero so a stranger sees the actual tool before any
// philosophy. Replaces the concept-facsimile specimens as the lead exhibit.
//
// Screenshots live in apps/web/public/screens/ (regenerate when chrome
// changes — stale screenshots are a P2, Design.md §5.9). Captions are
// locale-swapped (single language per locale), so no captionEn here.

import * as React from 'react';

import { Icon, ProductFrame, type IconName } from '@/components/design';
import type { LocaleDict } from '@/lib/i18n/types';

export function ProductTour({ t }: { t: LocaleDict }) {
  const pt = t.landing.productTour;

  const steps: {
    src: string;
    alt: string;
    caption: string;
    icon: IconName;
    prov?: string;
  }[] = [
    {
      src: '/screens/docs-workspace.png',
      alt: pt.step1Alt,
      caption: pt.step1Caption,
      icon: 'idea',
    },
    {
      src: '/screens/docs-new.png',
      alt: pt.step2Alt,
      caption: pt.step2Caption,
      icon: 'prototype',
    },
    {
      src: '/screens/editor-readiness.png',
      alt: pt.step3Alt,
      caption: pt.step3Caption,
      icon: 'paper',
      prov: 'AI · agent',
    },
  ];

  return (
    <section>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 lg:max-w-5xl">
        <header className="flex flex-col gap-2">
          <p className="label-cap">{pt.heading}</p>
          <p
            className="font-serif text-base italic leading-[1.6]"
            style={{ color: 'var(--color-ink-2)' }}
            data-prose="bilingual"
          >
            {pt.sub}
          </p>
        </header>

        <ol className="m-0 flex list-none flex-col gap-12 p-0">
          {steps.map((s, i) => (
            <li
              key={s.src}
              className="grid gap-4 lg:grid-cols-[44px_1fr] lg:gap-7"
            >
              <div
                className="flex items-center gap-3 lg:flex-col lg:gap-2 lg:pt-1"
                style={{ color: 'var(--color-ink-3)' }}
              >
                <span
                  className="font-mono text-xs tabular-nums"
                  style={{ fontFeatureSettings: '"onum" 1' }}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Icon name={s.icon} size="md" />
              </div>
              <ProductFrame
                src={s.src}
                alt={s.alt}
                width={1300}
                height={880}
                caption={s.caption}
                provenanceLabel={s.prov}
                provenanceKind="agent"
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default ProductTour;
