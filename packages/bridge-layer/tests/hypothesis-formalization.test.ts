// Wave D-2 — Unit tests for HypothesisFormalization Bridge atomic unit.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  HypothesisFormalization,
  FormalizationOutcome,
  FormalizedVariable,
} from '../src/hypothesis-formalization';
import { isHypothesisFormalization } from '../src/bridge-artifact';

const base = {
  authorPrincipalId: 'principal:jili',
  createdAt: '2026-05-12T00:00:00Z',
  updatedAt: '2026-05-12T00:00:00Z',
  visibility: 'collaborator' as const,
  status: 'active' as const,
  language: 'zh-Hans' as const,
  provenanceId: 'prov:1',
  modeTags: [] as readonly never[],
};

describe('HypothesisFormalization (Bridge atomic unit)', () => {
  it('compiles with full structure', () => {
    const vars: FormalizedVariable[] = [
      {
        name: 'temperature',
        role: 'independent',
        operationalization: 'thermocouple K-type ±0.1°C',
      },
      {
        name: 'condensate surface tension',
        role: 'dependent',
        operationalization: 'optical tweezer + Laplace pressure',
      },
    ];
    const hf: HypothesisFormalization = {
      ...base,
      id: 'bridge:hf:1',
      kind: 'hypothesis-formalization',
      title: '相分离液滴 → 测试 claim',
      bodyMarkdown: '',
      sourceNightArtifactId: 'night:m:1',
      informalIdea: 'P 颗粒是相分离液滴',
      testableClaim:
        '在 4-25°C 范围, P 颗粒表观表面张力随温度单调增加且 R^2 > 0.9',
      variables: vars,
      falsificationCondition: 'R^2 < 0.5 或斜率 < 0',
      outcome: 'formalizable',
    };
    assert.equal(isHypothesisFormalization(hf), true);
    assert.equal(hf.variables.length, 2);
    assert.equal(hf.variables[0]!.role, 'independent');
  });

  it('records failed formalization with blocking note (anti-publication-bias)', () => {
    const hf: HypothesisFormalization = {
      ...base,
      id: 'bridge:hf:blocked',
      kind: 'hypothesis-formalization',
      title: '"集体智能"形式化失败',
      bodyMarkdown: '',
      sourceNightArtifactId: 'night:t:7',
      informalIdea: '群体讨论时智能涌现',
      testableClaim: '...',
      variables: [],
      falsificationCondition: 'N/A',
      outcome: 'not-formalizable',
      blockingNote: '"集体智能"概念在跨学科上未达成共识；先回到 Night 层 reframe',
    };
    assert.equal(hf.outcome, 'not-formalizable');
    assert.ok(hf.blockingNote);
  });

  it('accepts all 4 FormalizationOutcome values', () => {
    const outcomes: FormalizationOutcome[] = [
      'formalizable',
      'requires-new-method',
      'underdetermined',
      'not-formalizable',
    ];
    for (const o of outcomes) {
      const hf: HypothesisFormalization = {
        ...base,
        id: `bridge:hf:${o}`,
        kind: 'hypothesis-formalization',
        title: o,
        bodyMarkdown: '',
        sourceNightArtifactId: 'night:x',
        informalIdea: '',
        testableClaim: '',
        variables: [],
        falsificationCondition: '',
        outcome: o,
      };
      assert.equal(hf.outcome, o);
    }
  });

  it('round-trips through JSON unchanged', () => {
    const hf: HypothesisFormalization = {
      ...base,
      id: 'bridge:hf:rt',
      kind: 'hypothesis-formalization',
      title: 't',
      bodyMarkdown: 'b',
      sourceNightArtifactId: 'night:source',
      informalIdea: 'i',
      testableClaim: 'c',
      variables: [
        { name: 'v', role: 'covariate', operationalization: 'o' },
      ],
      falsificationCondition: 'f',
      outcome: 'requires-new-method',
    };
    const json = JSON.stringify(hf);
    const parsed: HypothesisFormalization = JSON.parse(json);
    assert.deepEqual(parsed, hf);
  });
});
