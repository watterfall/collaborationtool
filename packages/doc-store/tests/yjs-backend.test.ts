// Phase 4 W7.1 — YjsDocumentHandle round-trip tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Y from 'yjs';

import { YjsDocumentHandle } from '../src/yjs-backend';

describe('YjsDocumentHandle', () => {
  it('getText returns a working Y.Text', () => {
    const handle = new YjsDocumentHandle({ id: 'doc-1' });
    const text = handle.getText('body');
    text.insert(0, 'hello 中文');
    assert.equal(text.toString(), 'hello 中文');
    assert.equal(handle.getText('body').toString(), 'hello 中文');
  });

  it('getMap shares state with getMap of same name', () => {
    const handle = new YjsDocumentHandle({ id: 'doc-2' });
    const m1 = handle.getMap<string>('crossRefs');
    m1.set('a', 'figure-1');
    const m2 = handle.getMap<string>('crossRefs');
    assert.equal(m2.get('a'), 'figure-1');
  });

  it('transact batches writes into one update', () => {
    const handle = new YjsDocumentHandle({ id: 'doc-3' });
    const updates: Uint8Array[] = [];
    const sub = handle.observe((u) => updates.push(u));
    handle.transact(() => {
      handle.getText('a').insert(0, 'x');
      handle.getMap('m').set('k', 1);
    });
    sub.dispose();
    assert.equal(updates.length, 1, 'one transaction = one update');
  });

  it('encodeStateAsUpdate + applyUpdate round-trip', () => {
    const src = new YjsDocumentHandle({ id: 'src' });
    src.transact(() => {
      src.getXmlFragment('body').insert(0, [new Y.XmlElement('paragraph')]);
      src.getMap('meta').set('title', 'Test');
    });
    const update = src.encodeStateAsUpdate();
    assert.ok(update.byteLength > 0);

    const dst = new YjsDocumentHandle({ id: 'dst' });
    dst.applyUpdate(update);
    assert.equal(
      JSON.stringify(dst.getXmlFragment('body').toJSON()),
      JSON.stringify(src.getXmlFragment('body').toJSON()),
    );
    assert.equal(dst.getMap('meta').get('title'), 'Test');
  });

  it('observe disposable detaches the listener', () => {
    const handle = new YjsDocumentHandle({ id: 'doc-4' });
    let count = 0;
    const sub = handle.observe(() => count++);
    handle.transact(() => handle.getText('a').insert(0, 'x'));
    sub.dispose();
    handle.transact(() => handle.getText('a').insert(0, 'y'));
    assert.equal(count, 1, 'second update must not fire after dispose');
  });

  it('encodeStateVector grows after a write', () => {
    const handle = new YjsDocumentHandle({ id: 'doc-5' });
    const sv1 = handle.encodeStateVector();
    handle.transact(() => handle.getMap('m').set('k', 'v'));
    const sv2 = handle.encodeStateVector();
    assert.notDeepEqual(Array.from(sv1), Array.from(sv2));
  });

  it('exposes raw yDoc as escape hatch', () => {
    const handle = new YjsDocumentHandle({ id: 'doc-6' });
    assert.ok(handle.yDoc instanceof Y.Doc);
    // Writes to the raw doc are visible through the abstract surface.
    handle.yDoc.getText('hatch').insert(0, 'raw');
    assert.equal(handle.getText('hatch').toString(), 'raw');
  });
});
