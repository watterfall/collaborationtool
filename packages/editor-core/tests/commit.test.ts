// Commit boundary serialiser round-trip tests.
// Pure (no PG, no browser); proves bytes preserve PM step + Yjs delta semantics.
//
// W7.1 收口：Yjs primitive 通过 @collaborationtool/doc-store 拿
// (YDoc / YXmlElement / YXmlText / yEncodeStateAsUpdate / yTransact)；
// 直接 `import * as Y from 'yjs'` 已从 editor-core 全部下线。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ySyncPlugin, prosemirrorJSONToYDoc, yDocToProsemirror } from 'y-prosemirror';
import { EditorState, type Transaction } from '@tiptap/pm/state';

import {
  YDoc,
  YXmlElement,
  YXmlText,
  YjsDocumentHandle,
  yApplyUpdate,
  yEncodeStateAsUpdate,
  yTransact,
} from '@collaborationtool/doc-store';

import {
  applyYjsUpdate,
  buildCommitPayload,
  deserializeSteps,
  nextStateVector,
} from '../src/commit';
import { paperSchema } from '../src/schema';

describe('commit boundary', () => {
  it('builds a payload with non-empty bytes', async () => {
    const schema = paperSchema();
    const baseDoc = new YDoc();
    const resultDoc = new YDoc();
    // seed result doc with a tiny update so the diff isn't zero-length
    yTransact(resultDoc, () => {
      resultDoc.getXmlFragment('body').insert(0, [new YXmlElement('paragraph')]);
    });

    const state = EditorState.create({
      schema,
      plugins: [ySyncPlugin(resultDoc.getXmlFragment('body'))],
    });
    const tr = state.tr.insertText('hello', 1);
    const payload = buildCommitPayload({
      steps: tr.steps,
      baseDoc,
      resultDoc,
    });

    assert.ok(payload.pmStepsBinary.byteLength > 0);
    assert.ok(payload.yjsUpdateBinary.byteLength > 0);
    assert.ok(payload.baseStateVector.byteLength > 0);
  });

  it('PM steps round-trip via deserializeSteps', async () => {
    const schema = paperSchema();
    const baseDoc = new YDoc();
    const resultDoc = new YDoc();
    yTransact(resultDoc, () => {
      resultDoc.getXmlFragment('body').insert(0, [new YXmlElement('paragraph')]);
    });

    const state = EditorState.create({
      schema,
      plugins: [ySyncPlugin(resultDoc.getXmlFragment('body'))],
    });

    // Build a transaction that does multiple things: insert text + add bold mark.
    let tr: Transaction = state.tr.insertText('双语 hello', 1);
    tr = tr.addMark(1, tr.doc.content.size, schema.marks['bold']!.create());

    const payload = buildCommitPayload({
      steps: tr.steps,
      baseDoc,
      resultDoc,
    });

    const restored = await deserializeSteps({
      pmStepsBinary: payload.pmStepsBinary,
      schema,
    });

    // Re-serialise and compare JSON shapes — direct equality on Step
    // instances would require deep PM internal comparison.
    const original = tr.steps.map((s) => s.toJSON());
    const reSer = restored.map((s) => s.toJSON());
    assert.deepEqual(reSer, original);
  });

  it('Yjs update round-trip applies cleanly to a fresh handle', () => {
    const baseDoc = new YjsDocumentHandle({ id: 'base' });
    const resultDoc = new YjsDocumentHandle({ id: 'result' });

    resultDoc.transact(() => {
      const fragment = resultDoc.getXmlFragment('body');
      const p = new YXmlElement('paragraph');
      p.insert(0, [new YXmlText('hello world')]);
      fragment.insert(0, [p]);
    });

    const payload = buildCommitPayload({
      steps: [],
      baseDoc,
      resultDoc,
    });

    // Apply to a fresh handle; should converge to same JSON.
    const fresh = new YjsDocumentHandle({ id: 'fresh' });
    applyYjsUpdate({ doc: fresh, yjsUpdateBinary: payload.yjsUpdateBinary });

    assert.deepEqual(
      fresh.getXmlFragment('body').toJSON(),
      resultDoc.getXmlFragment('body').toJSON(),
    );
  });

  it('nextStateVector grows as document grows', () => {
    const handle = new YjsDocumentHandle({ id: 'sv' });
    const sv1 = nextStateVector(handle);

    handle.transact(() => {
      handle.getMap('m').set('k', 'v');
    });
    const sv2 = nextStateVector(handle);

    // Yjs state vectors are clientId → clock; after a write the bytes differ.
    assert.notDeepEqual(Array.from(sv1), Array.from(sv2));
  });

  it('y-prosemirror PM JSON round-trips through Yjs binary', () => {
    const schema = paperSchema();

    // PM doc → Y.Doc → PM doc; this is the path the editor takes when
    // a fresh user joins and gets the body history replay.
    const initialJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '中文段落 ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
          ],
        },
      ],
    };

    const ydoc = prosemirrorJSONToYDoc(schema, initialJson);
    const update = yEncodeStateAsUpdate(ydoc);

    const restored = new YDoc();
    yApplyUpdate(restored, update);
    const restoredJson = yDocToProsemirror(schema, restored);

    assert.deepEqual(restoredJson.toJSON(), initialJson);
  });
});
