import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escapeTypstMarkup, escapeTypstString } from '../src/escape';

describe('escapeTypstMarkup', () => {
  it('escapes Typst markup metacharacters', () => {
    assert.equal(escapeTypstMarkup('a*b'), 'a\\*b');
    assert.equal(escapeTypstMarkup('a#b'), 'a\\#b');
    assert.equal(escapeTypstMarkup('a$b'), 'a\\$b');
    assert.equal(escapeTypstMarkup('a_b'), 'a\\_b');
    assert.equal(escapeTypstMarkup('a/b'), 'a\\/b');
    assert.equal(escapeTypstMarkup('a`b'), 'a\\`b');
    assert.equal(escapeTypstMarkup('a@b'), 'a\\@b');
    assert.equal(escapeTypstMarkup('a~b'), 'a\\~b');
    assert.equal(escapeTypstMarkup('a<b'), 'a\\<b');
    assert.equal(escapeTypstMarkup('a>b'), 'a\\>b');
  });

  it('escapes backslashes by doubling them', () => {
    assert.equal(escapeTypstMarkup('a\\b'), 'a\\\\b');
  });

  it('passes through CJK characters unchanged', () => {
    assert.equal(escapeTypstMarkup('协作论文'), '协作论文');
  });

  it('handles empty string', () => {
    assert.equal(escapeTypstMarkup(''), '');
  });
});

describe('escapeTypstString', () => {
  it('escapes quotes and backslashes for "..." literal', () => {
    assert.equal(escapeTypstString('a"b'), 'a\\"b');
    assert.equal(escapeTypstString('a\\b'), 'a\\\\b');
  });

  it('does not escape markup metas (those are markup-context only)', () => {
    assert.equal(escapeTypstString('hash#dollar$'), 'hash#dollar$');
  });
});
