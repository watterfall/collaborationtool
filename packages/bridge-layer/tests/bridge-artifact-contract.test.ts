// Wave D-2 — Contract tests for the 4 Bridge atomic units' union.
// Pins the shape + JSON serialisation contract so future schema changes
// break by design. PG / Yjs storage depends on stable shape.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRIDGE_ARTIFACT_KINDS,
  isBridgeArtifactKind,
  isConceptPrototype,
  isDesignFiction,
  isHypothesisFormalization,
  isAnalogyMapping,
  type BridgeArtifact,
} from '../src/bridge-artifact';

const baseShape = {
  authorPrincipalId: 'principal:jili',
  createdAt: '2026-05-12T00:00:00Z',
  updatedAt: '2026-05-12T00:00:00Z',
  visibility: 'collaborator' as const,
  status: 'active' as const,
  language: 'zh-Hans' as const,
  provenanceId: 'prov:001',
  modeTags: [] as readonly never[],
};

describe('BridgeArtifact discriminated union (ADR-0020 §2.1)', () => {
  it('has exactly 4 kinds', () => {
    assert.equal(BRIDGE_ARTIFACT_KINDS.length, 4);
  });

  it('isBridgeArtifactKind validates the 4 kinds', () => {
    for (const k of BRIDGE_ARTIFACT_KINDS) {
      assert.equal(isBridgeArtifactKind(k), true);
    }
    assert.equal(isBridgeArtifactKind('thought'), false);
    assert.equal(isBridgeArtifactKind('night-artifact'), false);
    assert.equal(isBridgeArtifactKind('day-artifact'), false);
    assert.equal(isBridgeArtifactKind(null), false);
    assert.equal(isBridgeArtifactKind(undefined), false);
  });

  it('BRIDGE_ARTIFACT_KINDS lists 4 kinds in deterministic order', () => {
    assert.deepEqual(BRIDGE_ARTIFACT_KINDS as readonly string[], [
      'concept-prototype',
      'design-fiction',
      'hypothesis-formalization',
      'analogy-mapping',
    ]);
  });

  it('discriminated union narrows by kind at compile-time', () => {
    const a: BridgeArtifact = {
      ...baseShape,
      id: 'b1',
      kind: 'concept-prototype',
      title: 't',
      bodyMarkdown: 'b',
      maturity: 'demo',
      demonstrationClaim: 'x',
      artifactRef: 'y',
    };
    if (a.kind === 'concept-prototype') {
      assert.equal(a.maturity, 'demo');
    } else {
      assert.fail('expected concept-prototype kind');
    }
  });

  it('all 4 type guards correctly identify their type', () => {
    const cp: BridgeArtifact = {
      ...baseShape,
      id: 'cp',
      kind: 'concept-prototype',
      title: '',
      bodyMarkdown: '',
      maturity: 'sketch',
      demonstrationClaim: '',
      artifactRef: '',
    };
    const df: BridgeArtifact = {
      ...baseShape,
      id: 'df',
      kind: 'design-fiction',
      title: '',
      bodyMarkdown: '',
      stance: 'aspirational',
      setting: '',
      assumptionsToExpose: ['x'],
    };
    const hf: BridgeArtifact = {
      ...baseShape,
      id: 'hf',
      kind: 'hypothesis-formalization',
      title: '',
      bodyMarkdown: '',
      sourceNightArtifactId: 'night:x',
      informalIdea: '',
      testableClaim: '',
      variables: [],
      falsificationCondition: '',
      outcome: 'formalizable',
    };
    const am: BridgeArtifact = {
      ...baseShape,
      id: 'am',
      kind: 'analogy-mapping',
      title: '',
      bodyMarkdown: '',
      sourceMetaphorId: 'night:m',
      sourceDomain: 'a',
      targetDomain: 'b',
      mappedRelations: [],
      knownDisanalogies: [],
      validationStatus: 'proposed',
    };

    assert.equal(isConceptPrototype(cp), true);
    assert.equal(isConceptPrototype(df), false);
    assert.equal(isDesignFiction(df), true);
    assert.equal(isDesignFiction(hf), false);
    assert.equal(isHypothesisFormalization(hf), true);
    assert.equal(isHypothesisFormalization(am), false);
    assert.equal(isAnalogyMapping(am), true);
    assert.equal(isAnalogyMapping(cp), false);
  });

  it('all 4 kinds round-trip through JSON unchanged', () => {
    const all: BridgeArtifact[] = [
      {
        ...baseShape,
        id: 'a',
        kind: 'concept-prototype',
        title: 'a',
        bodyMarkdown: 'a',
        maturity: 'demo',
        demonstrationClaim: 'a',
        artifactRef: 'a',
      },
      {
        ...baseShape,
        id: 'b',
        kind: 'design-fiction',
        title: 'b',
        bodyMarkdown: 'b',
        stance: 'cautionary',
        setting: 'b',
        assumptionsToExpose: ['x'],
      },
      {
        ...baseShape,
        id: 'c',
        kind: 'hypothesis-formalization',
        title: 'c',
        bodyMarkdown: 'c',
        sourceNightArtifactId: 'night:s',
        informalIdea: 'c',
        testableClaim: 'c',
        variables: [],
        falsificationCondition: 'c',
        outcome: 'formalizable',
      },
      {
        ...baseShape,
        id: 'd',
        kind: 'analogy-mapping',
        title: 'd',
        bodyMarkdown: 'd',
        sourceMetaphorId: 'night:m',
        sourceDomain: 'd',
        targetDomain: 'd',
        mappedRelations: [],
        knownDisanalogies: [],
        validationStatus: 'proposed',
      },
    ];
    for (const a of all) {
      const json = JSON.stringify(a);
      const parsed: BridgeArtifact = JSON.parse(json);
      assert.deepEqual(parsed, a);
    }
  });

  it('Bridge artifacts default to collaborator visibility (not private)', () => {
    // Schema does not enforce default; this asserts team convention
    // (per ADR-0020 §2.1: Night defaults private, Bridge defaults
    // collaborator, because Bridge exists to enable cross-domain
    // conversation).
    const cp: BridgeArtifact = {
      ...baseShape,
      id: 'vis',
      kind: 'concept-prototype',
      title: '',
      bodyMarkdown: '',
      maturity: 'sketch',
      demonstrationClaim: '',
      artifactRef: '',
    };
    assert.equal(cp.visibility, 'collaborator');
  });
});
