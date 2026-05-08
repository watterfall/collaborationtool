// Commit boundary serialiser round-trip tests.
// Pure (no PG, no browser); proves bytes preserve PM step + Yjs delta semantics.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ySyncPlugin, prosemirrorJSONToYDoc, yDocToProsemirror } from 'y-prosemirror';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import * as Y from 'yjs';

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
    const baseDoc = new Y.Doc();
    const resultDoc = new Y.Doc();
    // seed result doc with a tiny update so the diff isn't zero-length
    Y.transact(resultDoc, () => {
      resultDoc.getXmlFragment('body').insert(0, [new Y.XmlElement('paragraph')]);
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
    const baseDoc = new Y.Doc();
    const resultDoc = new Y.Doc();
    Y.transact(resultDoc, () => {
      resultDoc.getXmlFragment('body').insert(0, [new Y.XmlElement('paragraph')]);
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

  it('Yjs update round-trip applies cleanly to a fresh doc', () => {
    const baseDoc = new Y.Doc();
    const resultDoc = new Y.Doc();

    Y.transact(resultDoc, () => {
      const fragment = resultDoc.getXmlFragment('body');
      const p = new Y.XmlElement('paragraph');
      p.insert(0, [new Y.XmlText('hello world')]);
      fragment.insert(0, [p]);
    });

    const payload = buildCommitPayload({
      steps: [],
      baseDoc,
      resultDoc,
    });

    // Apply to a fresh doc; should converge to same JSON.
    const fresh = new Y.Doc();
    applyYjsUpdate({ doc: fresh, yjsUpdateBinary: payload.yjsUpdateBinary });

    assert.deepEqual(
      fresh.getXmlFragment('body').toJSON(),
      resultDoc.getXmlFragment('body').toJSON(),
    );
  });

  it('nextStateVector grows as document grows', () => {
    const doc = new Y.Doc();
    const sv1 = nextStateVector(doc);

    Y.transact(doc, () => {
      doc.getMap('m').set('k', 'v');
    });
    const sv2 = nextStateVector(doc);

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
    const update = Y.encodeStateAsUpdate(ydoc);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, update);
    const restoredJson = yDocToProsemirror(schema, restored);

    assert.deepEqual(restoredJson.toJSON(), initialJson);
  });
});
