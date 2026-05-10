// Phase 4 W7.1 — Subdocument helper tests (ADR-0014 W5 alignment).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  encodeSubdocumentState,
  openSubdocument,
} from '../src/subdocument';
import { YjsDocumentHandle } from '../src/yjs-backend';

describe('subdocument', () => {
  it('parent.getSubdocument(name).yDoc is distinct from parent.yDoc', () => {
    const parent = new YjsDocumentHandle({ id: 'root' });
    const child = parent.getSubdocument('intro');
    assert.notStrictEqual(child.yDoc, parent.yDoc);
    assert.equal(child.id, 'root/intro');
  });

  it('parent.getSubdocument(name) is idempotent on the same name', () => {
    const parent = new YjsDocumentHandle({ id: 'root' });
    const a = parent.getSubdocument('intro');
    const b = parent.getSubdocument('intro');
    assert.strictEqual(a, b, 'same name returns same handle');
    assert.notStrictEqual(a, parent.getSubdocument('methods'));
  });

  it('subdocument writes do not appear in parent.encodeStateAsUpdate replay state', () => {
    const parent = new YjsDocumentHandle({ id: 'root' });
    const child = parent.getSubdocument('intro');
    child.getText('body').insert(0, 'child-only text');

    // Replay parent state into a fresh handle and confirm the child
    // text doesn't surface there — subdocs are separate Y.Docs.
    const replay = new YjsDocumentHandle({ id: 'replay' });
    replay.applyUpdate(parent.encodeStateAsUpdate());
    const replayChild = replay.getSubdocument('intro');
    assert.equal(
      replayChild.getText('body').toString(),
      '',
      'subdoc body must travel separately',
    );
  });

  it('openSubdocument applies update on open', () => {
    const src = new YjsDocumentHandle({ id: 'a' });
    const child = src.getSubdocument('intro');
    child.getText('body').insert(0, '中文 subdoc');
    const childUpdate = encodeSubdocumentState(src, 'intro');

    const dst = new YjsDocumentHandle({ id: 'b' });
    const restored = openSubdocument(dst, 'intro', childUpdate);
    assert.equal(restored.getText('body').toString(), '中文 subdoc');
  });
});
