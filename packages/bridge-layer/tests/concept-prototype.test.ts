// Wave D-2 — Unit tests for ConceptPrototype Bridge atomic unit.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  ConceptPrototype,
  PrototypeMaturity,
} from '../src/concept-prototype';
import { isConceptPrototype, type BridgeArtifact } from '../src/bridge-artifact';

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

describe('ConceptPrototype (Bridge atomic unit)', () => {
  it('compiles with all required fields', () => {
    const cp: ConceptPrototype = {
      ...base,
      id: 'bridge:cp:1',
      kind: 'concept-prototype',
      title: '相分离液滴 viscosity demo',
      bodyMarkdown: 'notebook 复现 Brangwynne 2009 surface tension 测量',
      maturity: 'reproducible',
      demonstrationClaim:
        'membrane-less organelle 表观粘度可被光镊精确测出',
      artifactRef: 'github:lab/phase-sep-demo@v0.3',
      reproductionNotes: 'python 3.11 + scikit-image + jupyter',
      knownLimitations: '只验证 P granule，未推广到其他无膜细胞器',
    };
    assert.equal(isConceptPrototype(cp), true);
    assert.equal(cp.maturity, 'reproducible');
  });

  it('accepts all 4 PrototypeMaturity levels', () => {
    const levels: PrototypeMaturity[] = [
      'sketch',
      'demo',
      'reproducible',
      'production-candidate',
    ];
    for (const m of levels) {
      const cp: ConceptPrototype = {
        ...base,
        id: `bridge:cp:${m}`,
        kind: 'concept-prototype',
        title: m,
        bodyMarkdown: '',
        maturity: m,
        demonstrationClaim: 'x',
        artifactRef: 'y',
      };
      assert.equal(cp.maturity, m);
    }
  });

  it('round-trips through JSON unchanged', () => {
    const cp: ConceptPrototype = {
      ...base,
      id: 'bridge:cp:rt',
      kind: 'concept-prototype',
      title: 't',
      bodyMarkdown: 'b',
      maturity: 'demo',
      demonstrationClaim: 'd',
      artifactRef: 'r',
    };
    const json = JSON.stringify(cp);
    const parsed: ConceptPrototype = JSON.parse(json);
    assert.deepEqual(parsed, cp);
  });

  it('narrows BridgeArtifact union via isConceptPrototype', () => {
    const cp: BridgeArtifact = {
      ...base,
      id: 'bridge:cp:n',
      kind: 'concept-prototype',
      title: '',
      bodyMarkdown: '',
      maturity: 'sketch',
      demonstrationClaim: '',
      artifactRef: '',
    };
    if (isConceptPrototype(cp)) {
      assert.equal(cp.maturity, 'sketch');
    } else {
      assert.fail('expected concept-prototype narrowing to succeed');
    }
  });

  it('records sourceNightArtifactIds when promoted from Night', () => {
    const cp: ConceptPrototype = {
      ...base,
      id: 'bridge:cp:lineage',
      kind: 'concept-prototype',
      title: '',
      bodyMarkdown: '',
      maturity: 'demo',
      demonstrationClaim: '',
      artifactRef: '',
      sourceNightArtifactIds: ['night:m:1', 'night:c:2'],
    };
    assert.equal(cp.sourceNightArtifactIds?.length, 2);
  });
});
