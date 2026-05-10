// Phase 4 W6.2 — seedYDocFromPmJson + isYDocFragmentEmpty unit tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Y from 'yjs';

import {
  isYDocFragmentEmpty,
  seedYDocFromPmJson,
} from '../src/seed';

describe('isYDocFragmentEmpty', () => {
  it('returns true on a fresh Y.Doc', () => {
    const ydoc = new Y.Doc();
    assert.equal(isYDocFragmentEmpty(ydoc), true);
  });
});

describe('seedYDocFromPmJson', () => {
  it('seeds a doc with a single paragraph', () => {
    const ydoc = new Y.Doc();
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello, world.' }],
        },
      ],
    };
    seedYDocFromPmJson(ydoc, json);
    assert.equal(isYDocFragmentEmpty(ydoc), false);
  });

  it('seeds a doc with a claim block', () => {
    const ydoc = new Y.Doc();
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
    seedYDocFromPmJson(ydoc, json);
    assert.equal(isYDocFragmentEmpty(ydoc), false);
  });

  it('throws on PM JSON that does not validate against paperSchema', () => {
    const ydoc = new Y.Doc();
    const json = {
      type: 'doc',
      content: [{ type: 'totally-unknown-node' }],
    };
    assert.throws(() => seedYDocFromPmJson(ydoc, json));
  });

  it('produces non-empty Yjs update', () => {
    const ydoc = new Y.Doc();
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x' }],
        },
      ],
    };
    seedYDocFromPmJson(ydoc, json);
    const update = Y.encodeStateAsUpdate(ydoc);
    assert.ok(update.byteLength > 0);
  });
});
