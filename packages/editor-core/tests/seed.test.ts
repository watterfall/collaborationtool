// Phase 4 W6.2 — seedDocumentFromPmJson + isDocumentFragmentEmpty unit tests.
// W7.1 收口：测试改用 DocumentHandle，但仍可通过 handle.yDoc 验证底层
// Y.Doc 状态作为 escape-hatch 回归断言。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  YjsDocumentHandle,
  yEncodeStateAsUpdate,
} from '@collaborationtool/doc-store';

import {
  isDocumentFragmentEmpty,
  seedDocumentFromPmJson,
} from '../src/seed';

describe('isDocumentFragmentEmpty', () => {
  it('returns true on a fresh DocumentHandle', () => {
    const handle = new YjsDocumentHandle({ id: 'fresh' });
    assert.equal(isDocumentFragmentEmpty(handle), true);
  });
});

describe('seedDocumentFromPmJson', () => {
  it('seeds a doc with a single paragraph', () => {
    const handle = new YjsDocumentHandle({ id: 'p' });
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello, world.' }],
        },
      ],
    };
    seedDocumentFromPmJson(handle, json);
    assert.equal(isDocumentFragmentEmpty(handle), false);
  });

  it('seeds a doc with a claim block', () => {
    const handle = new YjsDocumentHandle({ id: 'c' });
    const json = {
      type: 'doc',
      content: [
        {
          type: 'claim',
          attrs: {
            blockId: 'b1',
            claimId: 'c1',
            claimType: 'main',
            status: 'human-reviewed',
            confidence: 'high',
          },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Some claim.' }],
            },
          ],
        },
      ],
    };
    seedDocumentFromPmJson(handle, json);
    assert.equal(isDocumentFragmentEmpty(handle), false);
  });

  it('throws on PM JSON that does not validate against paperSchema', () => {
    const handle = new YjsDocumentHandle({ id: 'bad' });
    const json = {
      type: 'doc',
      content: [{ type: 'totally-unknown-node' }],
    };
    assert.throws(() => seedDocumentFromPmJson(handle, json));
  });

  it('produces non-empty Yjs update', () => {
    const handle = new YjsDocumentHandle({ id: 'u' });
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x' }],
        },
      ],
    };
    seedDocumentFromPmJson(handle, json);
    // escape hatch: byte-level assertion via handle.yDoc.
    const update = yEncodeStateAsUpdate(handle.yDoc);
    assert.ok(update.byteLength > 0);
  });
});
