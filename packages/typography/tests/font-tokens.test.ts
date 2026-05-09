import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fontTokensToCss,
  fontTokensToTypst,
  getFontTokens,
} from '../src/font-tokens';

describe('getFontTokens', () => {
  it('puts CJK families first for zh-Hans', () => {
    const t = getFontTokens('zh-Hans');
    assert.equal(t.serif[0], 'Source Han Serif SC');
    assert.equal(t.sans[0], 'Source Han Sans SC');
    assert.match(t.serif.join(','), /Songti SC/);
  });

  it('uses TC family for zh-Hant', () => {
    const t = getFontTokens('zh-Hant');
    assert.equal(t.serif[0], 'Source Han Serif TC');
    assert.equal(t.sans[0], 'Source Han Sans TC');
  });

  it('Latin-first chain for en still includes CJK fallbacks', () => {
    const t = getFontTokens('en');
    assert.equal(t.serif[0], 'ui-serif');
    assert.match(t.serif.join(','), /Source Han Serif/);
  });

  it('mono is identical across languages', () => {
    assert.deepEqual(
      getFontTokens('zh-Hans').mono,
      getFontTokens('en').mono,
    );
  });
});

describe('font token formatters', () => {
  it('CSS quotes multi-word names', () => {
    const css = fontTokensToCss(['Source Han Serif SC', 'Songti SC', 'serif']);
    assert.equal(css, '"Source Han Serif SC", "Songti SC", serif');
  });

  it('Typst emits an array of quoted strings', () => {
    const typst = fontTokensToTypst(['Source Han Serif SC', 'New CM']);
    assert.equal(typst, '("Source Han Serif SC", "New CM")');
  });
});
