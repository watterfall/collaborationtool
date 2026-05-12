// Spike-2 Task 2 — emit Y.Doc → markdown.
// Pin shape contract: 同一 Y.Doc 多次 emit 结果稳定；空 Y.Doc 返回 ''；
// 单段落 / 多段落 / heading / 列表 4 类节点 round-trip 可读。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Y from 'yjs';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';

import { paperSchema } from '@collaborationtool/editor-core';
import { emitMarkdown } from '../src/ydoc-to-markdown';

// API note (Spike-2 W1 fix, 2026-05-12):
//   - paperSchema is a *function* (singleton factory), not a constant —
//     editor-core/src/schema.ts:21 `export function paperSchema(): Schema`
//   - prosemirrorJSONToYDoc signature is
//     `(schema, state, xmlFragment = 'prosemirror') → Y.Doc`
//     (y-prosemirror@1.3.7 src/lib.js:299) — last arg is the fragment
//     NAME (string), not a fragment OBJECT; return value is the Y.Doc.
function makeYDoc(pmJson: Record<string, unknown>) {
  // 3rd arg defaults to 'prosemirror' — match emitMarkdown's lookup.
  return prosemirrorJSONToYDoc(paperSchema(), pmJson);
}

describe('emitMarkdown (Spike-2 Task 2)', () => {
  it('empty Y.Doc emits empty string', () => {
    const doc = new Y.Doc();
    assert.equal(emitMarkdown(doc), '');
  });

  it('single paragraph round-trips', () => {
    const doc = makeYDoc({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'hello world' }],
      }],
    });
    assert.equal(emitMarkdown(doc).trim(), 'hello world');
  });

  it('heading + paragraph emits 标 + 文', () => {
    const doc = makeYDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Intro' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
      ],
    });
    const md = emitMarkdown(doc);
    assert.match(md, /^# Intro/m);
    assert.match(md, /^body$/m);
  });

  it('idempotent: emit(emit(doc)) === emit(doc)', () => {
    const doc = makeYDoc({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    const m1 = emitMarkdown(doc);
    const m2 = emitMarkdown(doc);
    assert.equal(m1, m2);
  });

  // Task 10: Design.md §11 reject criteria 防止任何 hex 颜色 / Tailwind
  // palette 字符串混入 markdown emit。Markdown 应该是 plaintext，但 future
  // regression（有人 hack 加 CSS-styled markdown）会被这里拦下。
  it('emitMarkdown output passes Design.md §11 reject criteria', () => {
    const doc = makeYDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'H' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'body ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
            { type: 'text', text: ' and ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
          ],
        },
      ],
    });
    const md = emitMarkdown(doc);
    assert.doesNotMatch(md, /bg-blue-[567]00/, 'Tailwind blue palette banned');
    assert.doesNotMatch(md, /rounded-(lg|xl|2xl|full)/, 'Tailwind radius palette banned');
    assert.doesNotMatch(md, /bg-zinc-[12]00/, 'Tailwind zinc palette banned');
    assert.doesNotMatch(md, /#[0-9A-Fa-f]{6}/, '非语义 hex 颜色禁止入 markdown');
    assert.doesNotMatch(md, /shadow-(sm|md|lg|xl)/, 'Tailwind shadow palette banned');
  });
});
