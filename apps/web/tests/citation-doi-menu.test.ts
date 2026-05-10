// Phase 4 W6.3 — citation DOI chip + buildInvokeRequestBody narrowing.
//
// `.brainstorm/role-user.md §5 P2`：A 粘 DOI 自动核 + (B) `@` trigger 在
// InlineAgentMenu 里加 DOI 输入路径。本文件锁住 (B) 的纯 logic 层：
//   - chip-citation-doi 存在、mode='doi-direct'、bilingual label
//   - buildInvokeRequestBody({ kind: 'citation', mode: 'doi-direct', doi })
//     → POST body 含 doi + mode 字段，不含 flaggedDoiCandidates
//   - DOI 校验函数 isValidDoiInput 接受合法 DOI、拒绝 ISBN/junk
//   - DOI 错误文案中英双语
//   - 缺失 doi / 空字符串走 fallback path（flaggedDoiCandidates: []）
//
// React 渲染 + 浮层定位由 e2e (Playwright) 覆盖；此处 node:test 跑纯逻辑。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AgentSelectionContext } from '@collaborationtool/editor-core';

import {
  AGENT_CHIPS,
  MENU_STRINGS,
  buildInvokeRequestBody,
  isValidDoiInput,
} from '../src/lib/inline-agent-menu';

const baseCtx: AgentSelectionContext = {
  passage: 'Some surrounding paragraph.',
  blockId: 'block-1',
  blockKind: 'paragraph',
  from: 1,
  to: 28,
  empty: false,
};

describe('chip-citation-doi — chip metadata', () => {
  it('chip exists with stable testId chip-citation-doi', () => {
    const c = AGENT_CHIPS.find((x) => x.testId === 'chip-citation-doi');
    assert.ok(c, 'chip-citation-doi must exist in AGENT_CHIPS');
    assert.equal(c.kind, 'citation');
    assert.equal(c.mode, 'doi-direct');
    assert.equal(c.routeSupported, true);
  });

  it('label is bilingual: 插入引用 / Cite by DOI', () => {
    const c = AGENT_CHIPS.find((x) => x.testId === 'chip-citation-doi')!;
    assert.match(c.label, /插入引用/);
    assert.match(c.label, /Cite by DOI/i);
    assert.match(c.label, / \/ /);
  });
});

describe('buildInvokeRequestBody — citation doi-direct path', () => {
  it('with mode=doi-direct + valid doi: body has { doi, mode } and NO flaggedDoiCandidates', () => {
    const body = buildInvokeRequestBody({
      kind: 'citation',
      documentId: 'doc-1',
      context: baseCtx,
      doi: '10.1145/3531146.3533104',
      mode: 'doi-direct',
    });
    assert.equal(body['kind'], 'citation');
    assert.equal(body['documentId'], 'doc-1');
    assert.equal(body['blockId'], 'block-1');
    assert.equal(body['doi'], '10.1145/3531146.3533104');
    assert.equal(body['mode'], 'doi-direct');
    assert.equal(body['flaggedDoiCandidates'], undefined);
  });

  it('trims whitespace from DOI input', () => {
    const body = buildInvokeRequestBody({
      kind: 'citation',
      documentId: 'doc-1',
      context: baseCtx,
      doi: '  10.48550/arXiv.2310.06770  ',
      mode: 'doi-direct',
    });
    assert.equal(body['doi'], '10.48550/arXiv.2310.06770');
  });

  it('falls back to passage-crawl path when mode=doi-direct but doi is empty/missing', () => {
    // Defensive: UI should not submit, but if it does, route gets the
    // legacy flaggedDoiCandidates: [] shape and crawls the passage.
    const body = buildInvokeRequestBody({
      kind: 'citation',
      documentId: 'doc-1',
      context: baseCtx,
      doi: '',
      mode: 'doi-direct',
    });
    assert.equal(body['doi'], undefined);
    assert.equal(body['mode'], undefined);
    assert.deepEqual(body['flaggedDoiCandidates'], []);
  });

  it('legacy citation chip (no mode) keeps the existing flaggedDoiCandidates shape', () => {
    const body = buildInvokeRequestBody({
      kind: 'citation',
      documentId: 'doc-1',
      context: baseCtx,
    });
    assert.deepEqual(body['flaggedDoiCandidates'], []);
    assert.equal(body['doi'], undefined);
    assert.equal(body['mode'], undefined);
  });
});

describe('isValidDoiInput — DOI shape validation', () => {
  it('accepts canonical CrossRef DOIs', () => {
    assert.equal(isValidDoiInput('10.1145/3531146.3533104'), true);
    assert.equal(isValidDoiInput('10.48550/arXiv.2310.06770'), true);
    assert.equal(isValidDoiInput('10.1038/s41586-023-06924-6'), true);
  });

  it('accepts trimmed input (UI surface trims before validate)', () => {
    assert.equal(isValidDoiInput('  10.1145/3531146.3533104 '), true);
  });

  it('rejects ISBN / ISSN / arbitrary text', () => {
    assert.equal(isValidDoiInput('978-0-13-110362-7'), false);
    assert.equal(isValidDoiInput('ISBN 978-0-13-110362-7'), false);
    assert.equal(isValidDoiInput('hello world'), false);
    assert.equal(isValidDoiInput(''), false);
  });

  it('rejects DOIs whose registrant is too short (< 4 digits)', () => {
    assert.equal(isValidDoiInput('10.0/x'), false);
    assert.equal(isValidDoiInput('10.123/abc'), false);
  });
});

describe('MENU_STRINGS — DOI sub-mode bilingual copy', () => {
  it('every DOI string is bilingual (CJK + Latin) split by " / "; placeholder is a sample DOI', () => {
    const fields = [
      'doiInputLabel',
      'doiInputPlaceholder',
      'doiSubmitLabel',
      'doiInvalidError',
      'doiBackLabel',
    ] as const;
    for (const f of fields) {
      const v = MENU_STRINGS[f];
      // Placeholder is a DOI (no CJK); skip the CJK check for that one.
      if (f !== 'doiInputPlaceholder') {
        assert.match(v, /[一-鿿]/, `${f} missing CJK: ${v}`);
        assert.match(v, /[A-Za-z]/, `${f} missing Latin: ${v}`);
      } else {
        // The placeholder must look like a DOI sample (10.X/Y).
        assert.match(v, /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i);
      }
    }
  });

  it('doiInvalidError tells the user what is wrong (DOI 格式)', () => {
    assert.match(MENU_STRINGS.doiInvalidError, /DOI/);
    assert.match(MENU_STRINGS.doiInvalidError, /格式|invalid/i);
  });

  it('doiSubmitLabel uses an action verb in both languages (查找/look up)', () => {
    assert.match(MENU_STRINGS.doiSubmitLabel, /查找/);
    assert.match(MENU_STRINGS.doiSubmitLabel, /look up|insert/i);
  });

  it('doiBackLabel offers a way back to the chip grid (返回 / Back)', () => {
    assert.match(MENU_STRINGS.doiBackLabel, /返回/);
    assert.match(MENU_STRINGS.doiBackLabel, /back/i);
  });
});
