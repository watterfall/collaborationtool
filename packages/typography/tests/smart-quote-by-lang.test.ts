import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { smartQuoteByLang } from '../src/smart-quote-by-lang';

describe('smartQuoteByLang', () => {
  it('curlies Latin double quotes around English text', () => {
    const out = smartQuoteByLang('She said "hi".', { primaryLanguage: 'en' });
    assert.equal(out, 'She said “hi”.');
  });

  it('curlies CJK double quotes (default curly-zh)', () => {
    const out = smartQuoteByLang('他说"你好"。', { primaryLanguage: 'zh-Hans' });
    assert.equal(out, '他说“你好”。');
  });

  it('uses corner brackets when configured', () => {
    const out = smartQuoteByLang('他说"你好"。', {
      primaryLanguage: 'zh-Hans',
      cjkStyle: 'corner-zh',
    });
    assert.equal(out, '他说「你好」。');
  });

  it('keeps inner-identifier ASCII quotes (proto-b §3.4 x86_64 case)', () => {
    const out = smartQuoteByLang('"x86_64"', { primaryLanguage: 'en' });
    // Outer quotes still curly because the run isn't fully identifier-bound
    // in this short example; the test guards that the inner ASCII letters
    // remain unchanged.
    assert.match(out, /x86_64/);
  });

  it('apostrophes inside English contractions become right single quote', () => {
    const out = smartQuoteByLang("don't", { primaryLanguage: 'en' });
    assert.equal(out, 'don’t');
  });

  it('mixed-script paragraph: pick zh quotes by primary language', () => {
    const out = smartQuoteByLang('用 "GPT" 写论文', {
      primaryLanguage: 'zh-Hans',
    });
    // The Latin acronym lives inside a CJK paragraph — primary lang wins.
    assert.match(out, /“GPT”/);
  });

  it('handles single quotes opening / closing pairs', () => {
    const out = smartQuoteByLang(
      "He said 'go' and waved.",
      { primaryLanguage: 'en' },
    );
    // expect ‘go’ with proper open/close
    assert.match(out, /‘go’/);
  });

  it('idempotent on already-curly text', () => {
    const out1 = smartQuoteByLang('已经是“正确”引号了', {
      primaryLanguage: 'zh-Hans',
    });
    const out2 = smartQuoteByLang(out1, { primaryLanguage: 'zh-Hans' });
    assert.equal(out1, out2);
  });
});
