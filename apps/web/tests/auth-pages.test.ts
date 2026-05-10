// Phase 4 W8.2 — login + signup page contract tests.
//
// We can't render React Server / Client components under node:test
// without a heavy harness, so these tests pin the load-bearing source
// shapes:
//   • Design.md §6.5 — 1fr 1fr grid, 400px form column, specimen aside
//   • Design.md §11 reject criteria — no bg-blue / rounded-lg+ / shadow / chatbot blue
//   • i18n auth keys parity (already covered by i18n.test.ts shape walk
//     but we add semantic asserts)
//   • OrcidSignIn component renders btn-primary when enabled, btn-ghost when not.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { en } from '../src/lib/i18n/locales/en';
import { zh } from '../src/lib/i18n/locales/zh';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoWebSrc = path.resolve(__dirname, '../src');

const loginSrc = readFileSync(
  path.join(repoWebSrc, 'app/(auth)/login/page.tsx'),
  'utf8',
);
const signupSrc = readFileSync(
  path.join(repoWebSrc, 'app/(auth)/signup/page.tsx'),
  'utf8',
);
const orcidSrc = readFileSync(
  path.join(repoWebSrc, 'components/orcid-sign-in.tsx'),
  'utf8',
);
const specimenSrc = readFileSync(
  path.join(repoWebSrc, 'components/specimen-quote.tsx'),
  'utf8',
);

// ────────────────────────────────────────────────────────────────────
// Layout: 1fr 1fr grid + 400px form + specimen aside
// ────────────────────────────────────────────────────────────────────

describe('login — Design.md §6.5 layout', () => {
  it('uses a 1fr 1fr grid on md+ breakpoints', () => {
    assert.match(loginSrc, /grid-cols-1\s+md:grid-cols-2/);
  });

  it('form column caps at 400px max width', () => {
    assert.match(loginSrc, /max-w-\[400px\]/);
  });

  it('specimen aside is hidden below md (single column on small)', () => {
    assert.match(loginSrc, /hidden\s+md:flex/);
    assert.match(loginSrc, /SpecimenQuote/);
  });

  it('imports SpecimenQuote from components/', () => {
    assert.match(
      loginSrc,
      /from ['"]@\/components\/specimen-quote['"]/,
    );
  });
});

describe('signup — Design.md §6.5 layout', () => {
  it('uses a 1fr 1fr grid on md+ breakpoints', () => {
    assert.match(signupSrc, /grid-cols-1\s+md:grid-cols-2/);
  });

  it('form column caps at 400px max width', () => {
    assert.match(signupSrc, /max-w-\[400px\]/);
  });

  it('hides specimen aside below md', () => {
    assert.match(signupSrc, /hidden\s+md:flex/);
  });
});

// ────────────────────────────────────────────────────────────────────
// ORCID primary CTA
// ────────────────────────────────────────────────────────────────────

describe('OrcidSignIn — primary CTA when enabled', () => {
  it('uses btn-primary class for the active state', () => {
    assert.match(orcidSrc, /className="btn-primary"/);
  });

  it('falls back to btn-ghost when ORCID env is missing (not hidden)', () => {
    assert.match(orcidSrc, /className="btn-ghost"/);
    // The disabled hint string must be reachable so users see it.
    assert.match(orcidSrc, /管理员未配置 ORCID 凭据/);
    assert.match(orcidSrc, /ORCID credentials not configured/);
  });

  it('button text is bilingual ORCID CTA', () => {
    assert.match(orcidSrc, /用 ORCID 登录 · Continue with ORCID/);
  });

  it('keeps the ORCID-green disc as the only saturated colour (icon only)', () => {
    // The 16px iD glyph keeps the brand green; everywhere else uses
    // accent-ink. The hex is documented as a Design.md §11 exception.
    assert.match(orcidSrc, /#a6ce39/i);
    // No other high-saturation hex should appear in the component.
    const otherHex = orcidSrc.match(/#[0-9a-f]{6}/gi) ?? [];
    const allowed = new Set(['#a6ce39', '#ffffff', '#fff']);
    for (const hex of otherHex) {
      const lower = hex.toLowerCase();
      // 3- or 6-digit; the iD label uses '#fff' which is fine.
      if (!allowed.has(lower) && lower !== '#fff') {
        assert.fail(`unexpected hex colour ${hex} in orcid-sign-in.tsx`);
      }
    }
  });

  it('main CTA fills with accent-ink (AI/agent token), not ORCID green', () => {
    assert.match(
      orcidSrc,
      /background:\s*['"]var\(--color-accent-ink\)['"]/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// Email/password collapsed behind ghost toggle
// ────────────────────────────────────────────────────────────────────

describe('login — email & password is collapsed by default', () => {
  it('renders a ghost toggle that opens the email form', () => {
    assert.match(loginSrc, /login-email-toggle/);
    assert.match(loginSrc, /login-email-form/);
    assert.match(loginSrc, /邮箱密码 · Email & password/);
  });
});

describe('signup — email & password is collapsed by default', () => {
  it('renders a ghost toggle that opens the email form', () => {
    assert.match(signupSrc, /signup-email-toggle/);
    assert.match(signupSrc, /signup-email-form/);
    assert.match(signupSrc, /邮箱密码 · Email & password/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Specimen quote
// ────────────────────────────────────────────────────────────────────

describe('SpecimenQuote — visual anchor only (md+)', () => {
  it('exports the component', async () => {
    const mod = await import('../src/components/specimen-quote');
    assert.equal(typeof mod.default, 'function');
  });

  it('shows bilingual paragraphs with CJK + Latin specimen content', () => {
    assert.match(specimenSrc, /specimen-paragraph-zh/);
    assert.match(specimenSrc, /specimen-paragraph-en/);
    assert.match(specimenSrc, /Y\.Doc CRDT/);
    assert.match(specimenSrc, /heterogeneous content graph/);
  });

  it('shows an inline equation specimen (KaTeX-shaped mono block)', () => {
    assert.match(specimenSrc, /specimen-equation/);
    assert.match(specimenSrc, /ρ\(t\)/);
  });

  it('byline carries an ORCID iri (visual anchor for the auth surface)', () => {
    assert.match(specimenSrc, /0000-0002-1825-0097/);
    assert.match(specimenSrc, /ORCID/);
  });

  it('uses paper-2 as the right-column background', () => {
    assert.match(loginSrc, /var\(--color-paper-2\)/);
    assert.match(signupSrc, /var\(--color-paper-2\)/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Design.md §11 reject criteria (P1)
// ────────────────────────────────────────────────────────────────────

describe('Design.md §11 reject criteria — auth surfaces', () => {
  const surfaces = [
    { name: 'login', src: loginSrc },
    { name: 'signup', src: signupSrc },
    { name: 'orcid-sign-in', src: orcidSrc },
    { name: 'specimen-quote', src: specimenSrc },
  ];

  for (const { name, src } of surfaces) {
    it(`${name}: no chatbot-blue tints (#3B82F6/#2563EB/#0EA5E9)`, () => {
      assert.doesNotMatch(src, /#3b82f6|#2563eb|#0ea5e9/i);
    });

    it(`${name}: no bg-blue-* / bg-amber-* / bg-zinc-50|100|200 banner fills`, () => {
      assert.doesNotMatch(src, /bg-blue-\d{2,3}/);
      assert.doesNotMatch(src, /bg-amber-\d{2,3}/);
      assert.doesNotMatch(src, /bg-zinc-(50|100|200)\b/);
    });

    it(`${name}: no rounded-lg|xl|2xl (radius cap is 4px per Design.md §4.2)`, () => {
      assert.doesNotMatch(src, /rounded-(?:lg|xl|2xl|3xl)\b/);
    });

    it(`${name}: no shadow-* utilities (Design.md §4.3 — focus uses outline)`, () => {
      assert.doesNotMatch(src, /\bshadow-(?:sm|md|lg|xl|2xl|inner|none)\b/);
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// i18n auth keys (shape parity is already enforced by i18n.test.ts;
// here we pin the semantic content)
// ────────────────────────────────────────────────────────────────────

describe('i18n — auth dictionary keys', () => {
  it('zh.auth.login carries the ORCID primary CTA copy', () => {
    assert.match(zh.auth.login.orcidPrimary, /ORCID/);
    assert.match(zh.auth.login.orcidPrimary, /用 ORCID 登录/);
  });

  it('en.auth.login carries the bilingual ORCID CTA copy', () => {
    assert.match(en.auth.login.orcidPrimary, /ORCID/);
    assert.match(en.auth.login.orcidPrimary, /用 ORCID 登录/);
  });

  it('signup ledes mention ORCID is recommended', () => {
    assert.match(zh.auth.signup.lede, /ORCID/);
    assert.match(zh.auth.signup.lede, /推荐/);
    assert.match(en.auth.signup.lede, /ORCID/);
    assert.match(en.auth.signup.lede, /recommended/i);
  });

  it('login + signup share the same orcid-disabled-hint string', () => {
    assert.equal(
      zh.auth.login.orcidDisabledHint,
      zh.auth.signup.orcidDisabledHint,
    );
    assert.equal(
      en.auth.login.orcidDisabledHint,
      en.auth.signup.orcidDisabledHint,
    );
  });
});
