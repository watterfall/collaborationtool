// Role bundle integrity — every verb in every bundle must be a known
// capability; every default role bundle must align with the matrix in
// ADR-0002 §2.2.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CAPABILITY_SET } from '../src/capabilities';
import {
  DEFAULT_ROLE_BUNDLES,
  DEFAULT_ROLE_IDS,
  getRoleBundle,
  isDefaultRoleId,
} from '../src/roles';

describe('default role bundles', () => {
  it('exposes 5 default role IDs (ADR-0002 §2.2)', () => {
    assert.equal(DEFAULT_ROLE_IDS.length, 5);
    assert.deepEqual(
      [...DEFAULT_ROLE_IDS].sort(),
      [
        'citation-agent',
        'commenter',
        'inline-editor-agent',
        'paper-author',
        'paper-reviewer',
      ],
    );
  });

  it('every verb in every bundle is a known capability', () => {
    for (const role of DEFAULT_ROLE_IDS) {
      const bundle = DEFAULT_ROLE_BUNDLES[role];
      for (const v of bundle) {
        assert.ok(
          CAPABILITY_SET.has(v),
          `role ${role} contains unknown capability ${v}`,
        );
      }
    }
  });

  it('paper-author has block.commit; paper-reviewer does NOT', () => {
    assert.ok(DEFAULT_ROLE_BUNDLES['paper-author'].includes('block.commit'));
    assert.ok(!DEFAULT_ROLE_BUNDLES['paper-reviewer'].includes('block.commit'));
    // ADR-0002 §2.2 explicit: reviewer goes through propose → owner accept
    assert.ok(DEFAULT_ROLE_BUNDLES['paper-reviewer'].includes('block.propose'));
    assert.ok(DEFAULT_ROLE_BUNDLES['paper-reviewer'].includes('block.review'));
  });

  it('paper-author does NOT include owner-only verbs (transfer / publish)', () => {
    // §2.2 routes these via document.owner_principal_id, not the role bundle.
    const author = DEFAULT_ROLE_BUNDLES['paper-author'];
    assert.ok(!author.includes('document.transfer-ownership' as never));
    assert.ok(!author.includes('document.publish' as never));
  });

  it('commenter has no write capability beyond annotations', () => {
    const commenter = DEFAULT_ROLE_BUNDLES['commenter'];
    assert.ok(!commenter.includes('block.commit' as never));
    assert.ok(!commenter.includes('block.propose' as never));
    assert.ok(!commenter.includes('block.create' as never));
    assert.ok(commenter.includes('annotation.create'));
    assert.ok(commenter.includes('annotation.reply'));
  });

  it('inline-editor-agent is propose-only (no commit) and only invokes editor', () => {
    const a = DEFAULT_ROLE_BUNDLES['inline-editor-agent'];
    assert.ok(a.includes('block.propose'));
    assert.ok(!a.includes('block.commit' as never));
    assert.ok(a.includes('agent.invoke:editor'));
    assert.ok(!a.includes('agent.invoke:citation' as never));
  });

  it('citation-agent has narrow citation scope', () => {
    const c = DEFAULT_ROLE_BUNDLES['citation-agent'];
    assert.ok(c.includes('citation.read'));
    assert.ok(c.includes('citation.create'));
    assert.ok(c.includes('citation.update'));
    assert.ok(c.includes('citation.bind'));
    assert.ok(c.includes('agent.invoke:citation'));
    assert.ok(!c.includes('block.commit' as never));
  });

  it('getRoleBundle / isDefaultRoleId are consistent', () => {
    for (const r of DEFAULT_ROLE_IDS) {
      assert.ok(isDefaultRoleId(r));
      assert.equal(getRoleBundle(r).length, DEFAULT_ROLE_BUNDLES[r].length);
    }
    assert.equal(isDefaultRoleId('admin'), false);
    assert.equal(isDefaultRoleId(''), false);
  });

  it('bundles are frozen (mutation rejected)', () => {
    assert.throws(() => {
      // @ts-expect-error -- we explicitly test runtime immutability
      DEFAULT_ROLE_BUNDLES['paper-author'] = [];
    });
  });
});
