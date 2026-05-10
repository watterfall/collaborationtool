// Pure tests for the file-based i18n module.
//
// We don't render React here — the test harness is `node --test` with
// tsx, no jsdom. The tests that matter are about the pure helpers:
// dictionary shape parity, locale resolution precedence, and the
// Accept-Language parser.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { en } from '../src/lib/i18n/locales/en';
import { zh } from '../src/lib/i18n/locales/zh';
import {
  parseAcceptLanguage,
  resolveLocale,
} from '../src/lib/i18n/get-locale';
import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
} from '../src/lib/i18n/types';

/**
 * Walks two objects recursively and asserts they have the exact same
 * key shape (same nested keys at every level). Used to keep en.ts in
 * lockstep with zh.ts — the critical guarantee for "no fallback
 * 'Coming soon' placeholders".
 */
function assertSameShape(a: unknown, b: unknown, path = '$'): void {
  if (typeof a !== typeof b) {
    throw new Error(`shape mismatch at ${path}: ${typeof a} vs ${typeof b}`);
  }
  if (a === null || b === null) {
    assert.equal(a, b, `null mismatch at ${path}`);
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    assert.equal(
      Array.isArray(a),
      Array.isArray(b),
      `array-vs-object mismatch at ${path}`,
    );
    return;
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    assert.deepEqual(ak, bk, `key set mismatch at ${path}`);
    for (const k of ak) {
      assertSameShape(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
      );
    }
  }
}

describe('locale dictionary shape parity', () => {
  it('zh and en have identical key shapes', () => {
    assertSameShape(zh, en);
  });

  it('every leaf is a non-empty string in both dicts', () => {
    function walk(node: unknown, path: string): void {
      if (typeof node === 'string') {
        assert.notEqual(
          node.trim(),
          '',
          `empty string at ${path} — no fallback placeholders allowed`,
        );
        return;
      }
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          walk(node[i], `${path}[${i}]`);
        }
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          walk(v, `${path}.${k}`);
        }
      }
    }
    walk(zh, 'zh');
    walk(en, 'en');
  });

  it('hero and meta strings differ between locales (translation actually happened)', () => {
    assert.notEqual(zh.landing.hero.headline, en.landing.hero.headline);
    assert.notEqual(zh.landing.hero.sub, en.landing.hero.sub);
    assert.notEqual(zh.landing.meta.description, en.landing.meta.description);
  });
});

describe('LOCALES + isLocale guard', () => {
  it('LOCALES holds zh and en', () => {
    assert.deepEqual([...LOCALES].sort(), ['en', 'zh']);
  });
  it('isLocale rejects unknown values', () => {
    assert.equal(isLocale('zh'), true);
    assert.equal(isLocale('en'), true);
    assert.equal(isLocale('jp'), false);
    assert.equal(isLocale(null), false);
    assert.equal(isLocale(undefined), false);
    assert.equal(isLocale(''), false);
  });
});

describe('parseAcceptLanguage', () => {
  it('returns DEFAULT_LOCALE when header is null/empty', () => {
    assert.equal(parseAcceptLanguage(null), DEFAULT_LOCALE);
    assert.equal(parseAcceptLanguage(undefined), DEFAULT_LOCALE);
    assert.equal(parseAcceptLanguage(''), DEFAULT_LOCALE);
  });
  it('matches zh when first tag starts with zh', () => {
    assert.equal(parseAcceptLanguage('zh-CN,en-US;q=0.5'), 'zh');
    assert.equal(parseAcceptLanguage('zh-Hans-CN'), 'zh');
    assert.equal(parseAcceptLanguage('zh'), 'zh');
  });
  it('matches en when only en is present', () => {
    assert.equal(parseAcceptLanguage('en-US,en;q=0.9'), 'en');
    assert.equal(parseAcceptLanguage('en-GB'), 'en');
  });
  it('falls back to DEFAULT_LOCALE for unsupported scripts', () => {
    assert.equal(parseAcceptLanguage('jp,ko'), DEFAULT_LOCALE);
    assert.equal(parseAcceptLanguage('fr-FR'), DEFAULT_LOCALE);
  });
  it('is case-insensitive', () => {
    assert.equal(parseAcceptLanguage('ZH-cn'), 'zh');
    assert.equal(parseAcceptLanguage('EN'), 'en');
  });
});

describe('resolveLocale precedence', () => {
  it('cookie wins over Accept-Language', () => {
    assert.equal(
      resolveLocale({ cookieValue: 'en', acceptLanguage: 'zh-CN' }),
      'en',
    );
    assert.equal(
      resolveLocale({ cookieValue: 'zh', acceptLanguage: 'en-US' }),
      'zh',
    );
  });
  it('falls through to Accept-Language when cookie missing/invalid', () => {
    assert.equal(
      resolveLocale({ cookieValue: null, acceptLanguage: 'en-US' }),
      'en',
    );
    assert.equal(
      resolveLocale({ cookieValue: 'fr', acceptLanguage: 'zh-Hans' }),
      'zh',
    );
  });
  it('returns DEFAULT_LOCALE when both are absent/unsupported', () => {
    assert.equal(
      resolveLocale({ cookieValue: null, acceptLanguage: null }),
      DEFAULT_LOCALE,
    );
    assert.equal(
      resolveLocale({ cookieValue: undefined, acceptLanguage: 'fr' }),
      DEFAULT_LOCALE,
    );
  });
});
