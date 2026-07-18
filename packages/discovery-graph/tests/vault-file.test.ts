// Thought ↔ vault file codec tests — ADR-0021 §2（Wave A2 垂直切片）。
// 锁死：序列化 → 解析 round-trip 保全所有 NightArtifactBase 字段；
// 约束文法 strict 解析（坏 enum / 缺字段 → errors 不是 throw）。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildNightFileName,
  serializeThoughtVaultFile,
  parseThoughtVaultFile,
  serializeNightArtifactVaultFile,
  parseNightArtifactVaultFile,
  NIGHT_DIR,
} from '../src/vault-file';
import type { Thought } from '../src/thought';
import type { Question } from '../src/question';
import type { Metaphor } from '../src/metaphor';
import type { Sketch } from '../src/sketch';
import type { Contradiction } from '../src/contradiction';
import type { ThoughtExperiment } from '../src/thought-experiment';
import type { NightArtifact } from '../src/night-artifact';
import type {
  PrincipalId,
  IsoDateTime,
  ProvenanceId,
} from '../src/_shared';

const COMMON = {
  authorPrincipalId: 'ed25519:abcd1234' as PrincipalId,
  createdAt: '2026-07-18T03:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-07-18T03:05:00.000Z' as IsoDateTime,
  visibility: 'private' as const,
  status: 'active' as const,
  provenanceId: 'prov-local-0001' as ProvenanceId,
  modeTags: [] as const,
};

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

// A2.3 — all 6 Night kinds round-trip through the generic codec.

const QUESTION: Question = {
  ...COMMON,
  kind: 'question',
  id: 'night-question-01',
  title: '为什么无膜细胞器能选择性富集分子？',
  bodyMarkdown: '相分离是否足以解释？',
  lifecycle: 'contested',
  childQuestionIds: ['night-question-02', 'night-question-03'],
  resolution: {
    resolvedAt: '2026-07-19T00:00:00.000Z' as IsoDateTime,
    resolvedBy: 'ed25519:aa' as PrincipalId,
    resolutionNote: '部分由 valency 决定',
  },
  reopenedAt: ['2026-07-20T00:00:00.000Z' as IsoDateTime],
};

const METAPHOR: Metaphor = {
  ...COMMON,
  kind: 'metaphor',
  id: 'night-metaphor-01',
  title: '细胞如液滴',
  bodyMarkdown: '无膜的组织方式。',
  sourceDomain: 'liquid droplets',
  targetDomain: 'intracellular condensates',
  mappingDescription: '表面张力 ↔ 界面能；聚并 ↔ 融合。',
  knownDisanalogies: '液滴无内部结构，凝聚体有。',
};

const SKETCH: Sketch = {
  ...COMMON,
  kind: 'sketch',
  id: 'night-sketch-01',
  title: '相图草图',
  bodyMarkdown: '',
  medium: 'ascii-diagram',
  contentRef: 'C ---o--- dilute | dense',
  caption: '浓度 vs 温度的两相边界',
  context: '在 lab notebook 上画的',
};

const CONTRADICTION: Contradiction = {
  ...COMMON,
  kind: 'contradiction',
  id: 'night-contradiction-01',
  title: '死菌让活菌致病',
  bodyMarkdown: 'Griffith 转化实验。',
  contradictionType: 'data-vs-theory',
  poleA: { description: '死的 S 型菌不该有活性', supportingReferences: ['doi:10.x'] },
  poleB: { description: '活的 R 型菌变成致病 S 型' },
  significance: '暗示存在可转移的遗传物质（后来的 DNA）。',
  resolutionStatus: 'resolved',
};

const THOUGHT_EXPERIMENT: ThoughtExperiment = {
  ...COMMON,
  kind: 'thought-experiment',
  id: 'night-te-01',
  title: '薛定谔的猫',
  bodyMarkdown: '密封盒 + 放射性原子。',
  premise: 'Imagine a cat in a sealed box with a radioactive atom.',
  outcomes: [
    { label: '活', reasoning: '原子未衰变', interpretation: '经典态' },
    { label: '既死又活', reasoning: '叠加未坍缩', interpretation: '量子叠加悖论' },
  ],
  realWorldImplication: '量子退相干边界问题',
  empiricalFollowUp: '腔量子电动力学实验',
};

describe('all 6 kinds — generic serialize → parse round-trip', () => {
  const cases: NightArtifact[] = [
    QUESTION,
    METAPHOR,
    SKETCH,
    CONTRADICTION,
    THOUGHT_EXPERIMENT,
  ];
  for (const artifact of cases) {
    it(`${artifact.kind} preserves every field`, () => {
      const content = serializeNightArtifactVaultFile(artifact);
      const { artifact: parsed, errors } = parseNightArtifactVaultFile(content);
      assert.deepEqual(errors, []);
      assert.deepEqual(parsed, artifact);
    });
  }

  it('question with only lifecycle (no optional fields) round-trips', () => {
    const bare: Question = {
      ...COMMON,
      kind: 'question',
      id: 'q-bare',
      title: 'q',
      bodyMarkdown: '',
      lifecycle: 'open',
    };
    const { artifact, errors } = parseNightArtifactVaultFile(
      serializeNightArtifactVaultFile(bare),
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(artifact, bare);
  });

  it('body with a --- thematic break survives (frontmatter split is greedy-safe)', () => {
    const withBreak: Metaphor = {
      ...METAPHOR,
      bodyMarkdown: 'above\n\n---\n\nbelow',
    };
    const { artifact } = parseNightArtifactVaultFile(
      serializeNightArtifactVaultFile(withBreak),
    );
    assert.equal(artifact?.bodyMarkdown, 'above\n\n---\n\nbelow');
  });
});

describe('generic parser strictness', () => {
  it('rejects an unknown night kind', () => {
    const { artifact, errors } = parseNightArtifactVaultFile(
      '---\nnight: dream\nid: x\n---\nbody',
    );
    assert.equal(artifact, null);
    assert.ok(errors.some((e) => e.includes('unknown night kind')));
  });

  it('rejects invalid question lifecycle', () => {
    const bad = serializeNightArtifactVaultFile(QUESTION).replace(
      'lifecycle: contested',
      'lifecycle: pondering',
    );
    assert.ok(parseNightArtifactVaultFile(bad).errors.some((e) => e.includes('lifecycle')));
  });

  it('rejects invalid sketch medium', () => {
    const bad = serializeNightArtifactVaultFile(SKETCH).replace(
      'sketch-medium: ascii-diagram',
      'sketch-medium: hologram',
    );
    assert.ok(parseNightArtifactVaultFile(bad).errors.some((e) => e.includes('sketch-medium')));
  });

  it('rejects a malformed data JSON line', () => {
    const bad = serializeNightArtifactVaultFile(METAPHOR).replace(
      /data: .*/,
      'data: {not json',
    );
    assert.ok(parseNightArtifactVaultFile(bad).errors.some((e) => e.includes('JSON')));
  });

  it('serializer throws if a line field contains a newline', () => {
    const evil: Metaphor = { ...METAPHOR, sourceDomain: 'a\nb' };
    assert.throws(() => serializeNightArtifactVaultFile(evil), /single-line/);
  });
});
