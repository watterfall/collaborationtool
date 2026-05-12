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

  it('zh meta description carries the inquiry-studio claim', () => {
    assert.match(zh.landing.meta.description, /创造工作台|工作室|创造过程/);
    assert.match(zh.landing.meta.description, /桌面端|本地/);
  });

  it('en meta description carries the inquiry-studio claim', () => {
    assert.match(en.landing.meta.description, /creative|studio|workbench/i);
    assert.match(en.landing.meta.description, /desktop-first|local/i);
  });
});

describe('landing — v7 hero copy (Inquiry Studio · 探索工作室)', () => {
  it('zh headline mentions 科研创造过程 + 工作室', () => {
    assert.match(zh.landing.hero.headline, /科研创造过程|创造过程/);
    assert.match(zh.landing.hero.headline, /工作室/);
  });
  it('zh headline still mentions 想法、原型、论文', () => {
    assert.match(zh.landing.hero.headline, /想法/);
    assert.match(zh.landing.hero.headline, /原型/);
    assert.match(zh.landing.hero.headline, /论文/);
  });
  it('en headline mentions creative process of science', () => {
    assert.match(en.landing.hero.headline, /creative\s+process|process of science/i);
  });
  it('en headline mentions ideas, prototypes, papers', () => {
    assert.match(en.landing.hero.headline, /Ideas/i);
    assert.match(en.landing.hero.headline, /prototypes/i);
    assert.match(en.landing.hero.headline, /papers/i);
  });
  it('zh hero sub explicitly contrasts paper tool vs creative workbench', () => {
    assert.match(zh.landing.hero.sub, /不是.*论文写作工具|创造工作台/);
  });
  it('en hero sub mentions creative workbench', () => {
    assert.match(en.landing.hero.sub, /not a paper-writing tool|creative\s+workbench/i);
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
});

describe('landing — v4 pillars (3 spaces) + attribution', () => {
  it('all three pillars (thinking/prototyping/paper) are translated', () => {
    for (const k of ['thinking', 'prototyping', 'paper'] as const) {
      const z = zh.landing.pillars[k].title;
      const e = en.landing.pillars[k].title;
      assert.notEqual(z, '', `zh.landing.pillars.${k}.title empty`);
      assert.notEqual(e, '', `en.landing.pillars.${k}.title empty`);
      assert.notEqual(z, e, `pillar ${k}: zh and en titles must differ`);
    }
  });
  it('zh thinking-space pillar mentions 3am + 草图 + 矛盾', () => {
    assert.match(zh.landing.pillars.thinking.desc, /3am/);
    assert.match(zh.landing.pillars.thinking.desc, /草图|矛盾/);
  });
  it('en thinking-space pillar mentions 3am + sketch + contradiction', () => {
    assert.match(en.landing.pillars.thinking.desc, /3am/);
    assert.match(en.landing.pillars.thinking.desc, /sketch|contradiction/i);
  });
  it('attribution section rejects first-author framing', () => {
    assert.match(zh.landing.attribution.desc, /first author|排第几/);
    assert.match(en.landing.attribution.desc, /first author/i);
  });
});

describe('landing — Landing component module shape', () => {
  it('exports a Landing function', async () => {
    const mod = await import('../src/components/landing/Landing');
    assert.equal(typeof mod.Landing, 'function');
  });
});

describe('landing — TriadicMockup module shape', () => {
  it('exports a TriadicMockup function', async () => {
    const mod = await import('../src/components/landing/TriadicMockup');
    assert.equal(typeof mod.TriadicMockup, 'function');
  });
});

describe('landing — v6 specimens use HTML components (not <img src=svg>)', () => {
  it('Landing.tsx imports 3 triadic specimen components', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'components/landing/Landing.tsx'),
      'utf8',
    );
    assert.match(src, /from ['"]\.\/NightArtifactCard['"]/);
    assert.match(src, /from ['"]\.\/BridgeArtifactCard['"]/);
    assert.match(src, /from ['"]\.\/LineageGraph['"]/);
  });
  it('Landing.tsx no longer uses <img src=landing-specimen-*.svg>', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'components/landing/Landing.tsx'),
      'utf8',
    );
    // v6 dropped SVG <img> in favor of React components for real typography
    assert.doesNotMatch(src, /landing-specimen-night\.svg/);
    assert.doesNotMatch(src, /landing-specimen-bridge\.svg/);
    assert.doesNotMatch(src, /landing-specimen-lineage\.svg/);
    // v3 specimens (typst/timeline/dag) also still gone
    assert.doesNotMatch(src, /landing-specimen-typst\.svg/);
    assert.doesNotMatch(src, /landing-specimen-timeline\.svg/);
    assert.doesNotMatch(src, /desci-review-pilot-fig1\.svg/);
  });
  it('the 3 specimen components export a callable', async () => {
    const night = await import('../src/components/landing/NightArtifactCard');
    const bridge = await import('../src/components/landing/BridgeArtifactCard');
    const lineage = await import('../src/components/landing/LineageGraph');
    assert.equal(typeof night.NightArtifactCard, 'function');
    assert.equal(typeof bridge.BridgeArtifactCard, 'function');
    assert.equal(typeof lineage.LineageGraph, 'function');
  });
  it('zh specimen captions describe night/bridge/lineage content', () => {
    assert.match(zh.landing.specimens.nightCaption, /矛盾|隐喻|半成品/);
    assert.match(zh.landing.specimens.bridgeCaption, /原型|参数|假设/);
    assert.match(zh.landing.specimens.lineageCaption, /3am|连接|lineage|转化/);
  });
});

describe('landing — v4 differentiation (5 rows)', () => {
  it('zh has exactly 5 differentiation rows', () => {
    assert.equal(zh.landing.differentiation.rows.length, 5);
  });
  it('en has exactly 5 differentiation rows', () => {
    assert.equal(en.landing.differentiation.rows.length, 5);
  });
  it('zh heading is "和别的工具有啥不同"', () => {
    assert.equal(zh.landing.differentiation.heading, '和别的工具有啥不同');
  });
  it('one of the rows is "first author"-framing rejection', () => {
    const zhFirstAuthor = zh.landing.differentiation.rows.find(r =>
      r.competitor.includes('first author'),
    );
    const enFirstAuthor = en.landing.differentiation.rows.find(r =>
      r.competitor.toLowerCase().includes('first author'),
    );
    assert.ok(zhFirstAuthor, 'zh missing first-author row');
    assert.ok(enFirstAuthor, 'en missing first-author row');
  });
});

describe('landing — heroMockup locale carries triadic content', () => {
  it('zh heroMockup names all three layers (NIGHT / BRIDGE / DAY)', () => {
    assert.match(zh.landing.heroMockup.nightLabel, /NIGHT/);
    assert.match(zh.landing.heroMockup.bridgeLabel, /BRIDGE/);
    assert.match(zh.landing.heroMockup.dayLabel, /DAY/);
  });
  it('en heroMockup names all three layers', () => {
    assert.match(en.landing.heroMockup.nightLabel, /NIGHT/);
    assert.match(en.landing.heroMockup.bridgeLabel, /BRIDGE/);
    assert.match(en.landing.heroMockup.dayLabel, /DAY/);
  });
  it('edge modes are valid InteractionMode values from ADR-0020 §2.3', () => {
    const valid = new Set([
      'hypothesis-output',
      'anomaly-input',
      'constraint-transfer',
      'metaphor-bridge',
      'question-return',
      'method-transfer',
    ]);
    assert.ok(valid.has(zh.landing.heroMockup.edge1Mode), 'edge1Mode zh');
    assert.ok(valid.has(zh.landing.heroMockup.edge2Mode), 'edge2Mode zh');
    assert.ok(valid.has(en.landing.heroMockup.edge1Mode), 'edge1Mode en');
    assert.ok(valid.has(en.landing.heroMockup.edge2Mode), 'edge2Mode en');
  });
  it('edge modes are identical strings in zh and en (not translated, internal enum)', () => {
    // edge mode names are InteractionMode enum values from ADR-0020 §2.3.
    // They are NOT user-facing translatable strings — must be byte-identical.
    assert.strictEqual(zh.landing.heroMockup.edge1Mode, en.landing.heroMockup.edge1Mode);
    assert.strictEqual(zh.landing.heroMockup.edge2Mode, en.landing.heroMockup.edge2Mode);
  });
  it('Landing.tsx + TriadicMockup do not use rounded-lg/xl/2xl, shadow, blue, zinc, or hex literals', async () => {
    const triadicSrc = readFileSync(
      path.join(repoWebSrc, 'components/landing/TriadicMockup.tsx'),
      'utf8',
    );
    const landingSrc = readFileSync(
      path.join(repoWebSrc, 'components/landing/Landing.tsx'),
      'utf8',
    );
    for (const [name, src] of [
      ['TriadicMockup.tsx', triadicSrc],
      ['Landing.tsx', landingSrc],
    ] as const) {
      assert.doesNotMatch(
        src,
        /rounded-(lg|xl|2xl|full)/,
        `${name}: Design.md §11 #2 — no large radius`,
      );
      assert.doesNotMatch(
        src,
        /shadow-(sm|md|lg|xl)/,
        `${name}: Design.md §11 #12 — no box-shadow`,
      );
      assert.doesNotMatch(
        src,
        /bg-blue-(500|600|700)/,
        `${name}: Design.md §11 #1 — no saturated blue`,
      );
      assert.doesNotMatch(
        src,
        /bg-zinc-(50|100|200)/,
        `${name}: Design.md §11 — no zinc backgrounds`,
      );
      assert.doesNotMatch(
        src,
        /#(3B82F6|2563EB|0EA5E9)/i,
        `${name}: Design.md §11 — no hex literal saturated blues`,
      );
    }
  });
});

describe('landing — v4 architecture (three-way)', () => {
  it('zh architecture heading is "装好之后长这样"', () => {
    assert.equal(zh.landing.architecture.heading, '装好之后长这样');
  });
  it('zh architecture sub mentions 桌面端 + 协作', () => {
    assert.match(zh.landing.architecture.sub, /桌面端/);
    assert.match(zh.landing.architecture.sub, /协作|合作/);
    assert.match(zh.landing.architecture.caption, /桌面|本地|服务器/);
  });
  it('en architecture sub mentions Desktop-first + collaborator', () => {
    assert.match(en.landing.architecture.sub, /Desktop-first/i);
    assert.match(en.landing.architecture.sub, /collaborat/i);
  });
  it('ascii has 3-way structure (3 boxes per row)', () => {
    // Count ┌ and ┐ in top border row to confirm 3 boxes
    const zhTopBorder = zh.landing.architecture.ascii[1] ?? '';
    const enTopBorder = en.landing.architecture.ascii[1] ?? '';
    const zhBoxCount = (zhTopBorder.match(/┌/g) || []).length;
    const enBoxCount = (enTopBorder.match(/┌/g) || []).length;
    assert.equal(zhBoxCount, 3, 'zh ascii top border should have 3 boxes');
    assert.equal(enBoxCount, 3, 'en ascii top border should have 3 boxes');
  });
  it('caption is plain — no Editor/Sync/Snapshot/Agent Worker jargon', () => {
    assert.doesNotMatch(zh.landing.architecture.caption, /Editor.*Sync.*Snapshot.*Agent Worker/);
    assert.doesNotMatch(zh.landing.architecture.caption, /pgboss|WAL-G/);
    assert.doesNotMatch(en.landing.architecture.caption, /pgboss|WAL-G/);
  });
});
