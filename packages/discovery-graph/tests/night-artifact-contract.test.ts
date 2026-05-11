// Wave D-1 — Contract tests for the 6 Night atomic units.
// Pins the shape + JSON serialisation contract so future schema changes
// break by design. PG / Yjs storage depends on stable shape.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  NIGHT_ARTIFACT_KINDS,
  isNightArtifactKind,
  isThought,
  isQuestion,
  isMetaphor,
  isSketch,
  isContradiction,
  isThoughtExperiment,
  type Thought,
  type Question,
  type Metaphor,
  type Sketch,
  type Contradiction,
  type ThoughtExperiment,
  type NightArtifact,
} from '../src/index';

const baseShape = {
  authorPrincipalId: 'principal:jili',
  createdAt: '2026-05-12T00:00:00Z',
  updatedAt: '2026-05-12T00:00:00Z',
  visibility: 'private' as const,
  status: 'active' as const,
  language: 'zh-Hans' as const,
  provenanceId: 'prov:001',
  modeTags: [] as readonly never[],
};

describe('NightArtifact discriminated union (ADR-0020 §2.1)', () => {
  it('has exactly 6 kinds', () => {
    assert.equal(NIGHT_ARTIFACT_KINDS.length, 6);
  });

  it('isNightArtifactKind validates the 6 kinds', () => {
    for (const k of NIGHT_ARTIFACT_KINDS) {
      assert.equal(isNightArtifactKind(k), true);
    }
    assert.equal(isNightArtifactKind('bridge-artifact'), false);
    assert.equal(isNightArtifactKind('day-artifact'), false);
    assert.equal(isNightArtifactKind(null), false);
    assert.equal(isNightArtifactKind(undefined), false);
  });

  it('Thought shape compiles and narrows via isThought', () => {
    const t: Thought = {
      ...baseShape,
      id: 'night:thought:1',
      kind: 'thought',
      title: '关于 metabolism 的初想',
      bodyMarkdown: '科学是连续的代谢循环，输入是 observations / papers / data...',
    };
    assert.equal(isThought(t), true);
    assert.equal(isQuestion(t), false);
  });

  it('Question with full lifecycle open', () => {
    const q: Question = {
      ...baseShape,
      id: 'night:q:1',
      kind: 'question',
      title: 'P = NP?',
      bodyMarkdown: '...',
      lifecycle: 'open',
    };
    assert.equal(isQuestion(q), true);
    assert.equal(q.lifecycle, 'open');
  });

  it('Question with resolution data', () => {
    const q: Question = {
      ...baseShape,
      id: 'night:q:2',
      kind: 'question',
      title: '镭从哪里来?',
      bodyMarkdown: '为何沥青铀矿放射性比纯铀强?',
      lifecycle: 'resolved',
      resolution: {
        resolvedAt: '1898-12-26T00:00:00Z',
        resolvedBy: 'principal:curie',
        resolutionNote: '从沥青铀矿中分离出新元素镭',
      },
    };
    assert.equal(q.lifecycle, 'resolved');
    assert.equal(q.resolution?.resolvedBy, 'principal:curie');
  });

  it('Metaphor with source + target domain', () => {
    const m: Metaphor = {
      ...baseShape,
      id: 'night:m:1',
      kind: 'metaphor',
      title: '相分离液滴',
      bodyMarkdown: 'P 颗粒不是固态，而是液滴 — Brangwynne 2009',
      sourceDomain: 'liquid droplets',
      targetDomain: 'intracellular condensates',
      mappingDescription:
        'membrane-less organelle behaves like phase-separated droplet',
    };
    assert.equal(isMetaphor(m), true);
    assert.equal(m.sourceDomain, 'liquid droplets');
  });

  it('Sketch with various media', () => {
    const s: Sketch = {
      ...baseShape,
      id: 'night:s:1',
      kind: 'sketch',
      title: 'metabolism diagram',
      bodyMarkdown: '',
      medium: 'whiteboard-photo',
      contentRef: 'sketch://blob/abc',
      caption: 'Night-Bridge-Day 三层流动图',
      context: 'lab notebook 周二早晨',
    };
    assert.equal(isSketch(s), true);
    assert.equal(s.medium, 'whiteboard-photo');
  });

  it('Contradiction with two poles', () => {
    const c: Contradiction = {
      ...baseShape,
      id: 'night:c:1',
      kind: 'contradiction',
      title: 'Griffith 转化',
      bodyMarkdown: '死菌能转化无害菌',
      contradictionType: 'data-vs-theory',
      poleA: { description: '蛋白质是遗传物质' },
      poleB: { description: 'DNA 是遗传物质' },
      significance: '改变遗传物质 paradigm',
      resolutionStatus: 'resolved',
    };
    assert.equal(isContradiction(c), true);
    assert.ok(c.poleA.description.length > 0);
  });

  it('ThoughtExperiment with multiple outcomes', () => {
    const te: ThoughtExperiment = {
      ...baseShape,
      id: 'night:te:1',
      kind: 'thought-experiment',
      title: '薛定谔的猫',
      bodyMarkdown: '盒子里 50% 概率衰变...',
      premise: 'A cat in a sealed box with a radioactive atom that has 50% decay probability.',
      outcomes: [
        {
          label: '猫活着',
          reasoning: '原子核未衰变',
          interpretation: '宏观系统应该有 definite 状态',
        },
        {
          label: '猫死了',
          reasoning: '原子核衰变',
          interpretation: '量子叠加态在宏观尺度也成立?',
        },
      ],
      realWorldImplication: '量子退相干理论 / 多世界诠释',
    };
    assert.equal(isThoughtExperiment(te), true);
    assert.equal(te.outcomes.length, 2);
    assert.equal(te.outcomes[0]!.label, '猫活着');
  });

  it('all 6 kinds round-trip through JSON unchanged', () => {
    const all: NightArtifact[] = [
      {
        ...baseShape,
        id: 'a',
        kind: 'thought',
        title: 'a',
        bodyMarkdown: 'a',
      },
      {
        ...baseShape,
        id: 'b',
        kind: 'question',
        title: 'b',
        bodyMarkdown: 'b',
        lifecycle: 'open',
      },
      {
        ...baseShape,
        id: 'c',
        kind: 'metaphor',
        title: 'c',
        bodyMarkdown: 'c',
        sourceDomain: 'x',
        targetDomain: 'y',
        mappingDescription: 'z',
      },
      {
        ...baseShape,
        id: 'd',
        kind: 'sketch',
        title: 'd',
        bodyMarkdown: 'd',
        medium: 'svg',
        contentRef: '<svg/>',
        caption: 'x',
      },
      {
        ...baseShape,
        id: 'e',
        kind: 'contradiction',
        title: 'e',
        bodyMarkdown: 'e',
        contradictionType: 'data-vs-theory',
        poleA: { description: 'x' },
        poleB: { description: 'y' },
        significance: 'z',
        resolutionStatus: 'open',
      },
      {
        ...baseShape,
        id: 'f',
        kind: 'thought-experiment',
        title: 'f',
        bodyMarkdown: 'f',
        premise: 'p',
        outcomes: [],
      },
    ];
    for (const a of all) {
      const json = JSON.stringify(a);
      const parsed: NightArtifact = JSON.parse(json);
      assert.deepEqual(parsed, a);
    }
  });

  it('discriminated union narrows by kind at compile-time', () => {
    const a: NightArtifact = {
      ...baseShape,
      id: 'q1',
      kind: 'question',
      title: 'x',
      bodyMarkdown: 'y',
      lifecycle: 'open',
    };
    // TypeScript narrows `a` to `Question` inside the conditional.
    if (a.kind === 'question') {
      assert.equal(a.lifecycle, 'open');
    } else {
      assert.fail('expected kind === question');
    }
  });

  it('NIGHT_ARTIFACT_KINDS lists 6 kinds in deterministic order', () => {
    assert.deepEqual(NIGHT_ARTIFACT_KINDS as readonly string[], [
      'thought',
      'question',
      'metaphor',
      'sketch',
      'contradiction',
      'thought-experiment',
    ]);
  });
});
