// Phase 4 W6.1 — InlineAgentMenu pure helpers.
//
// `.brainstorm/role-user.md §2` + `.brainstorm/role-ai.md §2`：旧 AgentPanel
// 折叠侧边栏要求用户手动粘贴段落 + 选 kind + 点 Run。这里把 trigger 改成
// PM mark + ⌘K floating menu。本测试锁住的是：
//   - chip 表格有 4 条且带中英双语 label
//   - buildInvokeRequestBody 按 kind 构造正确 POST body
//   - chipVisualLevel 在 claim / citationRef 上把对应 chip 升级为 primary
//   - MENU_STRINGS 中英双语 + 关键提示存在
//
// React 渲染 + 浮层定位由 e2e (Playwright) 覆盖；本测用 node:test 跑纯
// 逻辑（同 share-dialog-fallback.test.ts pattern）。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AgentSelectionContext } from '@collaborationtool/editor-core';

import {
  AGENT_CHIPS,
  MENU_STRINGS,
  buildInvokeRequestBody,
  chipVisualLevel,
} from '../src/lib/inline-agent-menu';

const baseCtx: AgentSelectionContext = {
  passage: 'Hello world.',
  blockId: 'block-1',
  blockKind: 'paragraph',
  from: 1,
  to: 13,
  empty: false,
};

describe('AGENT_CHIPS — vocabulary + bilingual labels', () => {
  it('exposes exactly 4 chips covering inline-editor / citation / researcher / reviewer', () => {
    assert.equal(AGENT_CHIPS.length, 4);
    const kinds = AGENT_CHIPS.map((c) => c.kind).sort();
    assert.deepEqual(kinds, ['citation', 'inline-editor', 'researcher', 'reviewer']);
  });

  it('every chip label has 中英双语 (CJK + Latin) split by " / "', () => {
    for (const chip of AGENT_CHIPS) {
      assert.match(chip.label, /[一-鿿]/, `${chip.kind}: expected CJK in label`);
      assert.match(chip.label, /[A-Za-z]/, `${chip.kind}: expected Latin in label`);
      assert.match(chip.label, / \/ /, `${chip.kind}: expected " / " separator`);
    }
  });

  it('inline-editor + citation chips are routeSupported=true; researcher / reviewer are WIP', () => {
    const supported = AGENT_CHIPS.filter((c) => c.routeSupported).map((c) => c.kind).sort();
    const wip = AGENT_CHIPS.filter((c) => !c.routeSupported).map((c) => c.kind).sort();
    assert.deepEqual(supported, ['citation', 'inline-editor']);
    assert.deepEqual(wip, ['researcher', 'reviewer']);
  });

  it('every chip has a stable testId (ASCII, kebab) for e2e selectors', () => {
    for (const chip of AGENT_CHIPS) {
      assert.match(chip.testId, /^chip-[a-z-]+$/);
    }
    const ids = new Set(AGENT_CHIPS.map((c) => c.testId));
    assert.equal(ids.size, AGENT_CHIPS.length, 'no duplicate testId');
  });
});

describe('buildInvokeRequestBody — POST shape per kind', () => {
  it('citation: body has flaggedDoiCandidates: [] (agent crawls passage)', () => {
    const body = buildInvokeRequestBody({
      kind: 'citation',
      documentId: 'doc-1',
      context: baseCtx,
    });
    assert.equal(body['kind'], 'citation');
    assert.equal(body['documentId'], 'doc-1');
    assert.equal(body['blockId'], 'block-1');
    assert.equal(body['passage'], 'Hello world.');
    assert.deepEqual(body['flaggedDoiCandidates'], []);
  });

  it('inline-editor: instructions absent → default "rephrase for clarity"', () => {
    const body = buildInvokeRequestBody({
      kind: 'inline-editor',
      documentId: 'doc-1',
      context: baseCtx,
    });
    assert.equal(body['userInstruction'], 'rephrase for clarity');
  });

  it('inline-editor: explicit instructions are passed verbatim (trimmed)', () => {
    const body = buildInvokeRequestBody({
      kind: 'inline-editor',
      documentId: 'doc-1',
      context: baseCtx,
      instructions: '  more formal, please  ',
    });
    assert.equal(body['userInstruction'], 'more formal, please');
  });

  it('researcher / reviewer: passes blockId + passage but no extra fields (route 400 today)', () => {
    for (const kind of ['researcher', 'reviewer'] as const) {
      const body = buildInvokeRequestBody({
        kind,
        documentId: 'doc-1',
        context: baseCtx,
      });
      assert.equal(body['kind'], kind);
      assert.equal(body['blockId'], 'block-1');
      assert.equal(body['passage'], 'Hello world.');
      assert.equal(body['userInstruction'], undefined);
      assert.equal(body['flaggedDoiCandidates'], undefined);
    }
  });

  it('passage stays empty if context.passage is empty (route validates downstream)', () => {
    const body = buildInvokeRequestBody({
      kind: 'inline-editor',
      documentId: 'doc-1',
      context: { ...baseCtx, passage: '', empty: true },
    });
    assert.equal(body['passage'], '');
  });
});

describe('chipVisualLevel — selection-aware chip emphasis', () => {
  it('researcher chip = primary inside a claim block', () => {
    const ctx = { ...baseCtx, blockKind: 'claim' };
    assert.equal(chipVisualLevel(ctx, 'researcher'), 'primary');
  });

  it('citation chip = primary inside a citationRef atom', () => {
    const ctx = { ...baseCtx, blockKind: 'citationRef' };
    assert.equal(chipVisualLevel(ctx, 'citation'), 'primary');
  });

  it('inline-editor chip = secondary when there is selection text', () => {
    assert.equal(chipVisualLevel(baseCtx, 'inline-editor'), 'secondary');
  });

  it('inline-editor chip = normal when passage is empty (cursor-only, no block text)', () => {
    const ctx = { ...baseCtx, passage: '', empty: true };
    assert.equal(chipVisualLevel(ctx, 'inline-editor'), 'normal');
  });

  it('reviewer chip stays normal regardless of context (no special signals yet)', () => {
    assert.equal(chipVisualLevel(baseCtx, 'reviewer'), 'normal');
    assert.equal(
      chipVisualLevel({ ...baseCtx, blockKind: 'claim' }, 'reviewer'),
      'normal',
    );
  });
});

describe('MENU_STRINGS — bilingual UX copy', () => {
  it('every string has both CJK and Latin halves separated by " / "', () => {
    const fields: Array<keyof typeof MENU_STRINGS> = [
      'title',
      'emptyHint',
      'instructionsLabel',
      'instructionsPlaceholder',
      'unsupportedHint',
      'pendingHint',
      'closeLabel',
    ];
    for (const f of fields) {
      const v = MENU_STRINGS[f];
      assert.match(v, /[一-鿿]/, `${f} missing CJK: ${v}`);
      assert.match(v, /[A-Za-z]/, `${f} missing Latin: ${v}`);
    }
  });

  it('title mentions AI 协作 / agent action', () => {
    assert.match(MENU_STRINGS.title, /AI 协作动作/);
    assert.match(MENU_STRINGS.title, /agent action/i);
  });

  it('emptyHint instructs the user to position cursor or select text', () => {
    assert.match(MENU_STRINGS.emptyHint, /光标|选中/);
    assert.match(MENU_STRINGS.emptyHint, /cursor|select/i);
  });

  it('unsupportedHint flags the route-not-yet-enabled state for researcher / reviewer', () => {
    assert.match(MENU_STRINGS.unsupportedHint, /路由暂不支持|接通中/);
    assert.match(MENU_STRINGS.unsupportedHint, /route|wiring/i);
  });
});
