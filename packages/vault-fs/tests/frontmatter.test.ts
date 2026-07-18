// Frontmatter split/join — ADR-0021 §3 保全原语测试。
// 核心 invariant：join(split(x)) === x 对任意输入成立（原样字节段 + 纯拼接）。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitFrontmatter, joinFrontmatter } from '../src/frontmatter';

describe('splitFrontmatter', () => {
  it('splits a well-formed block, fences + trailing newline included', () => {
    const content = '---\nnight: thought\ntitle: 相分离\n---\n正文第一行。\n';
    const { frontmatter, body } = splitFrontmatter(content);
    assert.equal(frontmatter, '---\nnight: thought\ntitle: 相分离\n---\n');
    assert.equal(body, '正文第一行。\n');
  });

  it('returns null frontmatter for plain markdown', () => {
    for (const content of ['just text', '# heading\n---\nnot frontmatter', '']) {
      const split = splitFrontmatter(content);
      assert.equal(split.frontmatter, null);
      assert.equal(split.body, content);
    }
  });

  it('does not treat an unterminated fence as frontmatter', () => {
    const content = '---\nkey: value\nno closing fence';
    assert.equal(splitFrontmatter(content).frontmatter, null);
  });

  it('handles closing fence at EOF without trailing newline', () => {
    const content = '---\nid: n-1\n---';
    const { frontmatter, body } = splitFrontmatter(content);
    assert.equal(frontmatter, content);
    assert.equal(body, '');
  });

  it('a thematic break in the body stays in the body', () => {
    const content = '---\nid: n-1\n---\nabove\n\n---\n\nbelow\n';
    const { frontmatter, body } = splitFrontmatter(content);
    assert.equal(frontmatter, '---\nid: n-1\n---\n');
    assert.match(body, /above\n\n---\n\nbelow/);
  });
});

describe('joinFrontmatter round-trip invariant', () => {
  it('join(split(x)) === x for every shape', () => {
    const samples = [
      '---\na: 1\n---\nbody\n',
      '---\na: 1\n---\n',
      '---\na: 1\n---',
      'no frontmatter at all\n',
      '',
      '---\nnot closed',
      '---\n中英 mixed: 值\n---\n\n# 标题\n正文。\n',
    ];
    for (const sample of samples) {
      const { frontmatter, body } = splitFrontmatter(sample);
      assert.equal(joinFrontmatter(frontmatter, body), sample);
    }
  });
});
