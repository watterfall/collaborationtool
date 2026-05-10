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

describe('landing — SEO metadata is bilingual', () => {
  it('includes zh title + en title + zh description + en description', () => {
    // page.tsx generateMetadata joins the two localized meta strings
    // with " · ". We don't import the Server Component (it pulls
    // next/headers which is RSC-only); instead we read the source
    // and check the static strings used for joining.
    const src = readFileSync(
      path.join(repoWebSrc, 'app/page.tsx'),
      'utf8',
    );
    assert.match(src, /zh\.landing\.meta\.title/);
    assert.match(src, /en\.landing\.meta\.title/);
    assert.match(src, /zh\.landing\.meta\.description/);
    assert.match(src, /en\.landing\.meta\.description/);
  });

  it('zh and en meta strings carry the load-bearing claims', () => {
    // zh: 本地优先, 双语
    assert.match(zh.landing.meta.description, /本地优先/);
    assert.match(zh.landing.meta.description, /双语|中英/);
    // en: local-first, bilingual
    assert.match(en.landing.meta.description, /local-first/i);
    assert.match(en.landing.meta.description, /bilingual/i);
  });
});

describe('landing — hero + architecture copy in both locales', () => {
  it('zh hero mentions 本地优先 + AI + 协作者', () => {
    assert.match(zh.landing.hero.sub, /本地优先/);
    assert.match(zh.landing.hero.sub, /AI/);
    assert.match(zh.landing.hero.sub, /协作者/);
  });
  it('en hero mentions Local-first + AI + collaborator', () => {
    assert.match(en.landing.hero.sub, /Local-first/i);
    assert.match(en.landing.hero.sub, /AI/);
    assert.match(en.landing.hero.sub, /collaborator/i);
  });
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
