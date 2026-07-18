// Thought ↔ vault file codec tests — ADR-0021 §2（Wave A2 垂直切片）。
// 锁死：序列化 → 解析 round-trip 保全所有 NightArtifactBase 字段；
// 约束文法 strict 解析（坏 enum / 缺字段 → errors 不是 throw）。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildNightFileName,
  serializeThoughtVaultFile,
  parseThoughtVaultFile,
  NIGHT_DIR,
} from '../src/vault-file';
import type { Thought } from '../src/thought';
import type {
  PrincipalId,
  IsoDateTime,
  ProvenanceId,
} from '../src/_shared';

const THOUGHT: Thought = {
  kind: 'thought',
  id: 'night-thought-0001',
  authorPrincipalId: 'ed25519:abcd1234' as PrincipalId,
  createdAt: '2026-07-18T03:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-07-18T03:05:00.000Z' as IsoDateTime,
  visibility: 'private',
  status: 'active',
  provenanceId: 'prov-local-0001' as ProvenanceId,
  modeTags: ['metaphor', 'cross-domain'],
  title: '相分离液滴与组织形成',
  bodyMarkdown: '无膜的组织方式——细胞里的"油滴"。\n\n参考 Hyman 2014。',
};

describe('buildNightFileName', () => {
  it('builds night/<date>-<slug>.md and strips unsafe characters', () => {
    const name = buildNightFileName(THOUGHT.createdAt, 'A/B: 相分离? *液滴*');
    assert.ok(name.startsWith(`${NIGHT_DIR}/2026-07-18-`));
    assert.ok(name.endsWith('.md'));
    // 前缀 night/ 之外不允许任何文件系统不安全字符。
    const fileName = name.slice(NIGHT_DIR.length + 1);
    assert.doesNotMatch(fileName, /[/\\:?"<>|#%\s]/);
  });

  it('falls back to "thought" for an empty title', () => {
    assert.equal(
      buildNightFileName(THOUGHT.createdAt, '???'),
      `${NIGHT_DIR}/2026-07-18-thought.md`,
    );
  });
});

describe('serialize → parse round-trip', () => {
  it('preserves every NightArtifactBase field + body', () => {
    const content = serializeThoughtVaultFile(THOUGHT);
    const { thought, errors } = parseThoughtVaultFile(content);
    assert.deepEqual(errors, []);
    assert.deepEqual(thought, THOUGHT);
  });

  it('omits mode-tags line when empty and still round-trips', () => {
    const bare: Thought = { ...THOUGHT, modeTags: [] };
    const content = serializeThoughtVaultFile(bare);
    assert.doesNotMatch(content, /mode-tags/);
    const { thought, errors } = parseThoughtVaultFile(content);
    assert.deepEqual(errors, []);
    assert.deepEqual(thought?.modeTags, []);
  });

  it('empty body round-trips to empty body', () => {
    const empty: Thought = { ...THOUGHT, bodyMarkdown: '' };
    const { thought } = parseThoughtVaultFile(serializeThoughtVaultFile(empty));
    assert.equal(thought?.bodyMarkdown, '');
  });
});

describe('strict parsing', () => {
  it('rejects non-thought night kinds', () => {
    const content = serializeThoughtVaultFile(THOUGHT).replace(
      'night: thought',
      'night: question',
    );
    const { thought, errors } = parseThoughtVaultFile(content);
    assert.equal(thought, null);
    assert.ok(errors.some((e) => e.includes('not a thought')));
  });

  it('rejects invalid visibility / status / mode tag', () => {
    const badVis = serializeThoughtVaultFile(THOUGHT).replace(
      'visibility: private',
      'visibility: everyone',
    );
    assert.ok(parseThoughtVaultFile(badVis).errors.length > 0);

    const badTag = serializeThoughtVaultFile(THOUGHT).replace(
      'mode-tags: metaphor, cross-domain',
      'mode-tags: metaphor, vibes',
    );
    assert.ok(
      parseThoughtVaultFile(badTag).errors.some((e) => e.includes('mode tag')),
    );
  });

  it('reports missing required fields instead of throwing', () => {
    const { thought, errors } = parseThoughtVaultFile('---\nnight: thought\n---\nbody');
    assert.equal(thought, null);
    assert.ok(errors.length >= 5);
  });

  it('rejects content without frontmatter', () => {
    const { thought, errors } = parseThoughtVaultFile('plain markdown');
    assert.equal(thought, null);
    assert.equal(errors.length, 1);
  });
});
