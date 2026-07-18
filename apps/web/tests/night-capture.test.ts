// Wave A2 — pure-logic tests for the night thought draft builder.
// 时间与 uuid 注入式，断言 draft 与 discovery-graph codec 双向一致。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseThoughtVaultFile,
  parseNightArtifactVaultFile,
} from '@collaborationtool/discovery-graph';

import {
  buildThoughtDraft,
  buildNightDraft,
  ANONYMOUS_AUTHOR,
} from '../src/lib/night-capture';

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

describe('buildNightDraft — all 6 kinds', () => {
  const common = {
    title: '标题',
    bodyMarkdown: 'body',
    modeTags: [] as const,
    authorKey: 'ed25519:cafe01',
    nowIso: '2026-07-18T03:00:00.000Z',
    uuid: 'u1',
  };

  it('builds a capture-state artifact that parses back per kind', () => {
    const cases = [
      { kind: 'thought' as const },
      { kind: 'question' as const },
      {
        kind: 'metaphor' as const,
        sourceDomain: 's',
        targetDomain: 't',
        mappingDescription: 'm',
      },
      {
        kind: 'sketch' as const,
        medium: 'ascii-diagram' as const,
        contentRef: 'c',
        caption: 'cap',
      },
      {
        kind: 'contradiction' as const,
        contradictionType: 'data-vs-theory' as const,
        poleA: 'a',
        poleB: 'b',
        significance: 'sig',
      },
      { kind: 'thought-experiment' as const, premise: 'imagine' },
    ];
    for (const fields of cases) {
      const draft = buildNightDraft({ ...common, fields });
      assert.ok(draft.relativePath.startsWith('night/2026-07-18-'));
      const { artifact, errors } = parseNightArtifactVaultFile(draft.content);
      assert.deepEqual(errors, [], `${fields.kind} should parse cleanly`);
      assert.equal(artifact?.kind, fields.kind);
      assert.deepEqual(artifact, draft.artifact);
    }
  });

  it('question starts open; TE outcomes start empty (capture 不逼完整化)', () => {
    const q = buildNightDraft({ ...common, fields: { kind: 'question' } });
    const qa = parseNightArtifactVaultFile(q.content).artifact;
    assert.ok(qa?.kind === 'question');
    assert.equal(qa.lifecycle, 'open');

    const te = buildNightDraft({
      ...common,
      fields: { kind: 'thought-experiment', premise: 'x' },
    });
    const ta = parseNightArtifactVaultFile(te.content).artifact;
    assert.ok(ta?.kind === 'thought-experiment');
    assert.equal(ta.outcomes.length, 0);
  });

  it('id encodes the kind (night-<kind>-<uuid>)', () => {
    const m = buildNightDraft({
      ...common,
      fields: { kind: 'metaphor', sourceDomain: 's', targetDomain: 't', mappingDescription: 'm' },
    });
    assert.equal(m.artifact.id, 'night-metaphor-u1');
  });
});
