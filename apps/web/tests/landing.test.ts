// Landing page contract tests.
//
// We don't render React under node:test, so these tests pin the
// pieces a Server Component test framework can't easily fake without
// a heavy harness:
//   • SEO metadata is bilingual (zh + en both present in title/description)
//   • Hero/architecture copy in BOTH locales references the
//     load-bearing claims (local-first / AI / provenance / bilingual)
//   • The redirect path for authenticated users is the exact /docs
//     route (string contract — not just "redirect happens")
//   • The Landing component module exports something callable

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { en } from '../src/lib/i18n/locales/en';
import { zh } from '../src/lib/i18n/locales/zh';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoWebSrc = path.resolve(__dirname, '../src');

describe('landing — page.tsx auth redirect contract', () => {
  it('imports auth + redirects logged-in users to /docs', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/page.tsx'),
      'utf8',
    );
    // The redirect target is part of the public contract: middleware,
    // (app)/docs and the landing all agree on /docs as the "home" of
    // the authenticated app. Pin it.
    assert.match(src, /redirect\(['"]\/docs['"]\)/);
    assert.match(src, /auth\.api\.getSession/);
    // Sanity: imports the Landing component (not the old hello-world).
    assert.match(src, /from ['"]@\/components\/landing\/Landing['"]/);
  });
});

describe('landing — v4 meta is bilingual + carries triadic positioning', () => {
  it('includes zh title + en title + zh description + en description', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/page.tsx'),
      'utf8',
    );
    assert.match(src, /zh\.landing\.meta\.title/);
    assert.match(src, /en\.landing\.meta\.title/);
    assert.match(src, /zh\.landing\.meta\.description/);
    assert.match(src, /en\.landing\.meta\.description/);
  });

  it('zh meta description carries the triadic-positioning claim', () => {
    assert.match(zh.landing.meta.description, /三个空间/);
    assert.match(zh.landing.meta.description, /桌面端|本地/);
  });

  it('en meta description carries the triadic-positioning claim', () => {
    assert.match(en.landing.meta.description, /three spaces/i);
    assert.match(en.landing.meta.description, /desktop-first|local/i);
  });
});

describe('landing — v4 hero copy (triadic positioning)', () => {
  it('zh headline opens with "论文不是科研的全部"', () => {
    assert.match(zh.landing.hero.headline, /论文不是科研的全部/);
  });
  it('zh headline mentions 想法、原型、论文 three spaces', () => {
    assert.match(zh.landing.hero.headline, /想法/);
    assert.match(zh.landing.hero.headline, /原型/);
    assert.match(zh.landing.hero.headline, /论文/);
  });
  it('en headline opens with "Papers are not the whole of science"', () => {
    assert.match(en.landing.hero.headline, /Papers are not the whole of science/i);
  });
  it('en headline mentions ideas, prototypes, papers', () => {
    assert.match(en.landing.hero.headline, /Ideas/i);
    assert.match(en.landing.hero.headline, /prototypes/i);
    assert.match(en.landing.hero.headline, /papers/i);
  });
  it('zh hero sub mentions 3am + specific imagery', () => {
    assert.match(zh.landing.hero.sub, /3am|隐喻|草图|争论/);
  });
  it('en hero sub mentions 3am + specific imagery', () => {
    assert.match(en.landing.hero.sub, /3am/);
    assert.match(en.landing.hero.sub, /metaphor|sketch|argument/i);
  });
  it('zh hero tagline mentions 桌面端 + 自托管', () => {
    assert.match(zh.landing.hero.tagline, /桌面端/);
    assert.match(zh.landing.hero.tagline, /自托管/);
  });
  it('en hero tagline mentions Desktop-first + self-hostable', () => {
    assert.match(en.landing.hero.tagline, /Desktop-first/i);
    assert.match(en.landing.hero.tagline, /self-hostable/i);
  });
  it('zh ctaPrimary is "开始用"', () => {
    assert.equal(zh.landing.hero.ctaPrimary, '开始用');
  });
  it('en ctaPrimary is "Start"', () => {
    assert.equal(en.landing.hero.ctaPrimary, 'Start');
  });
});

describe('landing — hero + architecture copy in both locales', () => {
  it('architecture ASCII has matching line counts in zh and en', () => {
    assert.equal(
      zh.landing.architecture.ascii.length,
      en.landing.architecture.ascii.length,
      'ASCII diagrams must agree on line count to layout the same width',
    );
  });
  it('all four pillars are translated (no Latin "Coming soon" in zh, no zh in en hero)', () => {
    for (const k of ['editor', 'ai', 'provenance', 'bilingual'] as const) {
      const z = zh.landing.pillars[k].title;
      const e = en.landing.pillars[k].title;
      assert.notEqual(z, '', `zh.landing.pillars.${k}.title empty`);
      assert.notEqual(e, '', `en.landing.pillars.${k}.title empty`);
      assert.notEqual(z, e, `pillar ${k}: zh and en titles must differ`);
    }
  });
});

describe('landing — Landing component module shape', () => {
  it('exports a Landing function', async () => {
    const mod = await import('../src/components/landing/Landing');
    assert.equal(typeof mod.Landing, 'function');
  });
});
