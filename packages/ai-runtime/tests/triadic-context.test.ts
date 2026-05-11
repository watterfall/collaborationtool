// Wave D-3 — contract tests for the Triadic context extension wired
// onto AgentExecutionContext jsonb (without DB migration).
//
// Source: ADR-0020 §2.3 / Wave D-3 deliverable / improvement-plan §十二.
// What's locked:
//   - withTriadicContext returns a new object, doesn't mutate input
//   - Empty crossLayerReferences is rejected at write time
//   - readTriadicContext round-trips through JSON (PG jsonb path)
//   - TRIADIC_CONTEXT_KEY is the single source of truth for the field
//     name (consumers grep this constant)
//   - Base AgentExecutionContext fields survive the merge unchanged

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AgentExecutionContext } from '@collaborationtool/schema';
import type {
  CrossLayerReference,
  InteractionMode,
} from '@collaborationtool/discovery-graph';

import {
  withTriadicContext,
  readTriadicContext,
  TRIADIC_CONTEXT_KEY,
  type TriadicContextExtension,
} from '../src/provenance-writer';

const baseCtx: AgentExecutionContext = {
  agentId: 'agent:citation' as AgentExecutionContext['agentId'],
  modelId: 'claude-opus-4-7',
  modelProvider: 'anthropic',
  promptTemplateId: 'tmpl_abc',
  promptHash: 'sha256:deadbeef',
  inputSkillIds: ['skill:metaphor-formalise'],
};

const sampleRef: CrossLayerReference = {
  id: 'edge:e1',
  fromArtifactId: 'night:m:phase-sep',
  fromLayer: 'night',
  toArtifactId: 'bridge:hf:phase-sep',
  toLayer: 'bridge',
  mode: 'metaphor-bridge' as InteractionMode,
  recordedBy: 'principal:jili',
  recordedAt: '2026-05-12T00:00:00Z',
};

describe('Triadic context extension (Wave D-3)', () => {
  it('TRIADIC_CONTEXT_KEY is the literal "triadic"', () => {
    assert.equal(TRIADIC_CONTEXT_KEY, 'triadic');
  });

  it('withTriadicContext merges triadic block without mutating base', () => {
    const triadic: TriadicContextExtension = {
      interactionMode: 'metaphor-bridge',
      crossLayerReferences: [sampleRef],
      note: 'Bridge formalisation of phase-sep metaphor',
    };
    const merged = withTriadicContext(baseCtx, triadic);
    // base survived
    assert.equal(merged.agentId, baseCtx.agentId);
    assert.equal(merged.modelId, baseCtx.modelId);
    // triadic attached
    assert.equal(merged.triadic?.interactionMode, 'metaphor-bridge');
    assert.equal(merged.triadic?.crossLayerReferences.length, 1);
    // input not mutated
    assert.equal(
      (baseCtx as unknown as Record<string, unknown>).triadic,
      undefined,
    );
  });

  it('withTriadicContext rejects empty crossLayerReferences', () => {
    assert.throws(() => {
      withTriadicContext(baseCtx, {
        interactionMode: 'metaphor-bridge',
        crossLayerReferences: [],
      });
    }, /crossLayerReferences must be non-empty/);
  });

  it('round-trips through JSON unchanged (jsonb storage contract)', () => {
    const triadic: TriadicContextExtension = {
      interactionMode: 'hypothesis-output',
      crossLayerReferences: [
        sampleRef,
        {
          ...sampleRef,
          id: 'edge:e2',
          fromArtifactId: 'bridge:hf:phase-sep',
          fromLayer: 'bridge',
          toArtifactId: 'day:claim:phase-sep',
          toLayer: 'day',
          mode: 'hypothesis-output',
        },
      ],
    };
    const merged = withTriadicContext(baseCtx, triadic);
    const json = JSON.stringify(merged);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const recovered = readTriadicContext(parsed);
    assert.ok(recovered, 'readTriadicContext should return triadic block');
    assert.equal(recovered!.interactionMode, 'hypothesis-output');
    assert.equal(recovered!.crossLayerReferences.length, 2);
    assert.deepEqual(recovered, triadic);
  });

  it('readTriadicContext returns undefined for Phase 1-4 (pre-Wave-D) rows', () => {
    // Existing rows with no triadic key — Wave D-3 must be backward
    // compatible (4 ADR review log impact).
    const oldRow: Record<string, unknown> = {
      agentId: 'agent:reviewer',
      modelId: 'claude-opus-4-7',
      modelProvider: 'anthropic',
      promptTemplateId: 'tmpl_x',
      promptHash: 'sha256:y',
      inputSkillIds: [],
    };
    assert.equal(readTriadicContext(oldRow), undefined);
  });

  it('readTriadicContext returns undefined for null/undefined input', () => {
    assert.equal(readTriadicContext(null), undefined);
    assert.equal(readTriadicContext(undefined), undefined);
  });

  it('readTriadicContext returns undefined when triadic field is non-object', () => {
    assert.equal(readTriadicContext({ triadic: 'not-an-object' }), undefined);
    assert.equal(readTriadicContext({ triadic: null }), undefined);
  });

  it('multiple cross-layer refs survive the round trip', () => {
    const triadic: TriadicContextExtension = {
      interactionMode: 'method-transfer',
      crossLayerReferences: [
        { ...sampleRef, id: 'a' },
        { ...sampleRef, id: 'b' },
        { ...sampleRef, id: 'c' },
      ],
    };
    const merged = withTriadicContext(baseCtx, triadic);
    const json = JSON.stringify(merged);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const recovered = readTriadicContext(parsed);
    assert.equal(recovered?.crossLayerReferences.length, 3);
  });
});
