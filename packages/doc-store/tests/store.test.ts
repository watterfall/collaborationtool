// Phase 4 W7.1 — DocStore lifecycle / cache tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DocStore } from '../src/store';
import { YjsDocumentHandle } from '../src/yjs-backend';

describe('DocStore', () => {
  it('getDocument caches by id', () => {
    const store = new DocStore();
    const a = store.getDocument('doc-1');
    const b = store.getDocument('doc-1');
    assert.strictEqual(a, b, 'same id returns same handle');
    assert.notStrictEqual(a, store.getDocument('doc-2'));
  });

  it('createDocument is idempotent', () => {
    const store = new DocStore();
    const a = store.createDocument('doc-1');
    const b = store.createDocument('doc-1');
    assert.strictEqual(a, b);
    assert.equal(store.size, 1);
  });

  it('createDocument adopts an existing handle', () => {
    const store = new DocStore();
    const external = new YjsDocumentHandle({ id: 'doc-1' });
    const adopted = store.createDocument('doc-1', { existing: external });
    assert.strictEqual(adopted, external);
    assert.strictEqual(store.getDocument('doc-1'), external);
  });

  it('releaseDocument evicts from cache', () => {
    const store = new DocStore();
    const a = store.getDocument('doc-1');
    a.getText('body').insert(0, 'x');
    store.releaseDocument('doc-1');
    assert.equal(store.has('doc-1'), false);
    const b = store.getDocument('doc-1');
    assert.notStrictEqual(a, b, 'fresh handle after release');
    // The evicted Y.Doc has been destroyed; the new one is empty.
    assert.equal(b.getText('body').toString(), '');
  });

  it('releaseDocument is no-op on unknown id', () => {
    const store = new DocStore();
    store.releaseDocument('never-existed');
    assert.equal(store.size, 0);
  });

  it('factory override creates non-default handles', () => {
    let calls = 0;
    const store = new DocStore({
      factory: (id) => {
        calls++;
        return new YjsDocumentHandle({ id });
      },
    });
    store.getDocument('doc-1');
    store.getDocument('doc-1'); // cached
    store.getDocument('doc-2');
    assert.equal(calls, 2);
  });
});
