// Pure tests for the theme module.
//
// We can't render the React tree under `node --test`, so we test the
// pure cookie resolver, the FOUC inline script (string contents), and
// the type guards.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PREF,
  FOUC_SCRIPT,
  resolveServerPref,
  resolveServerTheme,
} from '../src/lib/theme/get-theme';
import {
  DEFAULT_THEME,
  isTheme,
  isThemePref,
  THEMES,
} from '../src/lib/theme/types';

describe('resolveServerTheme — cookie reading', () => {
  it('returns dark when cookie says dark', () => {
    assert.equal(resolveServerTheme('dark'), 'dark');
  });
  it('returns light when cookie says light', () => {
    assert.equal(resolveServerTheme('light'), 'light');
  });
  it('falls back to DEFAULT_THEME when cookie says system', () => {
    // Server cannot read prefers-color-scheme, so DEFAULT_THEME is
    // the only sensible SSR default; the FOUC script flips before
    // paint when the OS prefers dark.
    assert.equal(resolveServerTheme('system'), DEFAULT_THEME);
  });
  it('falls back to DEFAULT_THEME when cookie is null/undefined/empty/garbage', () => {
    assert.equal(resolveServerTheme(null), DEFAULT_THEME);
    assert.equal(resolveServerTheme(undefined), DEFAULT_THEME);
    assert.equal(resolveServerTheme(''), DEFAULT_THEME);
    assert.equal(resolveServerTheme('not-a-theme'), DEFAULT_THEME);
  });
});

describe('resolveServerPref — preserves user choice including system', () => {
  it('preserves all three valid values', () => {
    assert.equal(resolveServerPref('light'), 'light');
    assert.equal(resolveServerPref('dark'), 'dark');
    assert.equal(resolveServerPref('system'), 'system');
  });
  it('falls back to DEFAULT_PREF (system) for missing/invalid', () => {
    assert.equal(resolveServerPref(null), DEFAULT_PREF);
    assert.equal(resolveServerPref(''), DEFAULT_PREF);
    assert.equal(resolveServerPref('xyz'), DEFAULT_PREF);
  });
});

describe('FOUC inline script contract', () => {
  it('reads the theme cookie before <body> paints', () => {
    // The hot path: the script must reference the cookie name and
    // the dark class — these are the load-bearing strings the layout
    // depends on. We check inclusion rather than exact bytes so we
    // can refactor the script without breaking the test on cosmetic
    // changes.
    assert.match(FOUC_SCRIPT, /cookie/);
    assert.match(FOUC_SCRIPT, /theme=/);
    assert.match(FOUC_SCRIPT, /classList/);
    assert.match(FOUC_SCRIPT, /'dark'/);
    assert.match(FOUC_SCRIPT, /prefers-color-scheme/);
  });

  it('is wrapped in IIFE + try/catch so a parse error never breaks render', () => {
    assert.match(FOUC_SCRIPT, /\(\(\)=>\{try\{/);
    assert.match(FOUC_SCRIPT, /catch\(e\)\{\}/);
  });

  it('is small enough to inline (<512 bytes)', () => {
    assert.ok(
      FOUC_SCRIPT.length < 512,
      `FOUC script ${FOUC_SCRIPT.length} bytes — keep it under 512`,
    );
  });
});

describe('THEMES + type guards', () => {
  it('THEMES contains exactly light + dark', () => {
    assert.deepEqual([...THEMES].sort(), ['dark', 'light']);
  });
  it('isTheme rejects "system" (system is a pref, not a theme)', () => {
    assert.equal(isTheme('light'), true);
    assert.equal(isTheme('dark'), true);
    assert.equal(isTheme('system'), false);
    assert.equal(isTheme(null), false);
  });
  it('isThemePref accepts system but rejects junk', () => {
    assert.equal(isThemePref('system'), true);
    assert.equal(isThemePref('light'), true);
    assert.equal(isThemePref('dark'), true);
    assert.equal(isThemePref(''), false);
    assert.equal(isThemePref('auto'), false);
  });
});
