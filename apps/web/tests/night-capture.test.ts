// Wave A2 — pure-logic tests for the night thought draft builder.
// 时间与 uuid 注入式，断言 draft 与 discovery-graph codec 双向一致。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseThoughtVaultFile } from '@collaborationtool/discovery-graph';

import { buildThoughtDraft, ANONYMOUS_AUTHOR } from '../src/lib/night-capture';

const BASE = {
  title: '  相分离液滴  ',
  bodyMarkdown: '无膜的组织方式。',
  modeTags: ['metaphor'] as const,
  authorKey: 'ed25519:cafe01',
  nowIso: '2026-07-18T03:00:00.000Z',
  uuid: '0000-test-uuid',
};

describe('buildThoughtDraft', () => {
  it('builds a draft whose content parses back to the same thought', () => {
    const draft = buildThoughtDraft(BASE);
    assert.equal(draft.relativePath.startsWith('night/2026-07-18-'), true);
    const { thought, errors } = parseThoughtVaultFile(draft.content);
    assert.deepEqual(errors, []);
    assert.equal(thought?.title, '相分离液滴');
    assert.equal(thought?.authorPrincipalId, 'ed25519:cafe01');
    assert.equal(thought?.visibility, 'private');
    assert.equal(thought?.id, 'night-thought-0000-test-uuid');
    assert.equal(thought?.provenanceId, 'prov-local-0000-test-uuid');
    assert.deepEqual(thought?.modeTags, ['metaphor']);
    assert.equal(thought?.bodyMarkdown, BASE.bodyMarkdown);
  });

  it('falls back to local:anonymous without a vault identity', () => {
    const draft = buildThoughtDraft({ ...BASE, authorKey: null });
    const { thought } = parseThoughtVaultFile(draft.content);
    assert.equal(thought?.authorPrincipalId, ANONYMOUS_AUTHOR);
  });

  it('created and updated stamps equal the injected now', () => {
    const { thought } = parseThoughtVaultFile(buildThoughtDraft(BASE).content);
    assert.equal(thought?.createdAt, BASE.nowIso);
    assert.equal(thought?.updatedAt, BASE.nowIso);
  });
});
