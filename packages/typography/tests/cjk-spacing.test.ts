import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyCjkSpacing } from '../src/cjk-spacing';

describe('applyCjkSpacing', () => {
  it('inserts a space between Han and Latin', () => {
    assert.equal(applyCjkSpacing('中文hello'), '中文 hello');
    assert.equal(applyCjkSpacing('hello中文'), 'hello 中文');
  });

  it('is idempotent (does not double-space)', () => {
    assert.equal(applyCjkSpacing('中文 hello'), '中文 hello');
    assert.equal(applyCjkSpacing('hello 中文'), 'hello 中文');
  });

  it('handles digits like Latin (treated identically)', () => {
    assert.equal(applyCjkSpacing('准确率76'), '准确率 76');
    assert.equal(applyCjkSpacing('76准确率'), '76 准确率');
  });

  it('does not insert space across non-Latin punctuation between Han and digits', () => {
    // Phase 1 conservative: % is non-Latin/non-Han, so it acts as a
    // separator without forcing a space. Phase 1.5 may extend the rule
    // to treat unit symbols as Latin runs.
    assert.equal(applyCjkSpacing('76%准确率'), '76%准确率');
  });

  it('leaves pure Latin and pure CJK untouched', () => {
    assert.equal(applyCjkSpacing('hello world'), 'hello world');
    assert.equal(applyCjkSpacing('协作论文平台'), '协作论文平台');
  });

  it('handles multiple boundaries in a paragraph', () => {
    assert.equal(
      applyCjkSpacing('用GPT写论文与Claude对比'),
      '用 GPT 写论文与 Claude 对比',
    );
  });

  it('respects a custom thin-space separator', () => {
    const out = applyCjkSpacing('中文hello', { separator: ' ' });
    assert.equal(out, '中文 hello');
  });

  it('returns short input as-is', () => {
    assert.equal(applyCjkSpacing(''), '');
    assert.equal(applyCjkSpacing('a'), 'a');
  });
});
