// Phase 5 Wave A A3 — contract tests for the extended
// AgentExecutionContext shape. Schema package has no test runner; we
// pin the contract here because ai-runtime is the canonical producer
// (provenance-writer + agent-runner + 4 ModelProvider adapters all
// construct this type).
//
// What's locked:
//   - 4 new fields exist + are optional
//   - RetryRecord exported + has 5 required-or-noted fields
//   - Roundtrip through a jsonb-like serialise/parse stays lossless
//     (Provenance.agentContext is a jsonb column; we must keep it
//     JSON-serialisable forever).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AgentExecutionContext,
  RetryRecord,
} from '@collaborationtool/schema';

describe('AgentExecutionContext A3 extension', () => {
  it('accepts the minimal Phase 1-4 shape (no A3 fields)', () => {
    const ctx: AgentExecutionContext = {
      agentId: 'agent:citation' as AgentExecutionContext['agentId'],
      modelId: 'claude-opus-4-7',
      modelProvider: 'anthropic',
      promptTemplateId: 'tmpl_abc',
      promptHash: 'sha256:deadbeef',
      inputSkillIds: ['skill:citation-lookup'],
    };
    assert.equal(ctx.actualIterations, undefined);
    assert.equal(ctx.promptTokens, undefined);
    assert.equal(ctx.completionTokens, undefined);
    assert.equal(ctx.retries, undefined);
  });

  it('accepts the populated A3 shape (telemetry fields filled)', () => {
    const ctx: AgentExecutionContext = {
      agentId: 'agent:reviewer' as AgentExecutionContext['agentId'],
      modelId: 'claude-sonnet-4-6',
      modelProvider: 'anthropic',
      promptTemplateId: 'tmpl_xyz',
      promptHash: 'sha256:cafebabe',
      inputSkillIds: ['skill:reviewer'],
      temperature: 0.2,
      maxTokens: 8192,
      actualIterations: 5,
      promptTokens: 12_300,
      completionTokens: 2_100,
      retries: [
        {
          attempt: 1,
          errorClass: 'rate-limit',
          delayedMs: 1000,
          occurredAt: '2026-05-12T10:00:00.000Z',
        },
        {
          attempt: 2,
          errorClass: '5xx',
          errorMessage: '503 Service Unavailable',
          delayedMs: 2000,
          occurredAt: '2026-05-12T10:00:03.000Z',
        },
      ],
    };
    assert.equal(ctx.actualIterations, 5);
    assert.equal(ctx.promptTokens, 12_300);
    assert.equal(ctx.completionTokens, 2_100);
    assert.equal(ctx.retries?.length, 2);
    assert.equal(ctx.retries?.[0]?.errorClass, 'rate-limit');
    assert.equal(ctx.retries?.[1]?.errorMessage, '503 Service Unavailable');
  });

  it('survives JSON roundtrip lossless (Provenance.agentContext is jsonb)', () => {
    const original: AgentExecutionContext = {
      agentId: 'agent:researcher' as AgentExecutionContext['agentId'],
      modelId: 'gpt-4',
      modelProvider: 'openai',
      promptTemplateId: 'tmpl_q',
      promptHash: 'sha256:1234',
      inputSkillIds: ['skill:literature-search'],
      actualIterations: 3,
      promptTokens: 8000,
      completionTokens: 1500,
      retries: [
        {
          attempt: 1,
          errorClass: 'tool-call-malformed',
          delayedMs: 0,
          occurredAt: '2026-05-12T11:00:00.000Z',
        },
      ],
    };
    const parsed = JSON.parse(JSON.stringify(original)) as AgentExecutionContext;
    assert.deepEqual(parsed, original);
  });
});

describe('RetryRecord shape', () => {
  it('minimal record (no errorMessage) is valid', () => {
    const r: RetryRecord = {
      attempt: 1,
      errorClass: 'rate-limit',
      delayedMs: 500,
      occurredAt: '2026-05-12T10:00:00.000Z',
    };
    assert.equal(r.attempt, 1);
    assert.equal(r.errorMessage, undefined);
  });

  it('retries[] empty-array is allowed (zero retries on happy path)', () => {
    const retries: RetryRecord[] = [];
    assert.equal(retries.length, 0);
  });
});
