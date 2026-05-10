// Phase 2 W2 ADR-0008: type-only tests for agent_job pipeline.
//
// We don't yet have a real PG / pgboss in the unit-test sandbox, so
// these tests verify shape contracts only. PG round-trip is exercised
// in apps/agent-worker via DATABASE_URL-gated integration test (TBD)
// and in W7 e2e.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AgentJobKind,
  AgentJobStatus,
  AnyJobInput,
  JobEventPayload,
  ReviewerJobInput,
  ResearcherJobInput,
} from '../src/job-types';

describe('AgentJobKind discriminated union', () => {
  it('reviewer + researcher are valid kinds', () => {
    const kinds: AgentJobKind[] = ['reviewer', 'researcher'];
    assert.equal(kinds.length, 2);
  });

  it('ReviewerJobInput accepts the documented fields', () => {
    const input: ReviewerJobInput = {
      kind: 'reviewer',
      documentId: 'doc-1' as ReviewerJobInput['documentId'],
      triggeringPrincipalId: 'user:1' as ReviewerJobInput['triggeringPrincipalId'],
      pluginPath: '/path/to/plugin',
      skillId: 'reviewer-style',
      focusBlockIds: ['blk-1'],
    };
    assert.equal(input.kind, 'reviewer');
    assert.deepEqual(input.focusBlockIds, ['blk-1']);
  });

  it('ResearcherJobInput accepts the documented fields', () => {
    const input: ResearcherJobInput = {
      kind: 'researcher',
      documentId: 'doc-2' as ResearcherJobInput['documentId'],
      triggeringPrincipalId: 'user:2' as ResearcherJobInput['triggeringPrincipalId'],
      query: 'foundation models for math reasoning',
      allowedMcpServerIds: ['crossref', 'arxiv'],
      pluginPath: '/path/to/researcher',
      skillId: 'literature-review',
    };
    assert.equal(input.kind, 'researcher');
    assert.deepEqual(input.allowedMcpServerIds, ['crossref', 'arxiv']);
  });

  it('AnyJobInput discriminates by kind', () => {
    const inputs: AnyJobInput[] = [
      {
        kind: 'reviewer',
        documentId: 'd' as ReviewerJobInput['documentId'],
        triggeringPrincipalId: 'p' as ReviewerJobInput['triggeringPrincipalId'],
        pluginPath: '/p',
        skillId: 's',
      },
      {
        kind: 'researcher',
        documentId: 'd' as ResearcherJobInput['documentId'],
        triggeringPrincipalId: 'p' as ResearcherJobInput['triggeringPrincipalId'],
        query: 'q',
        allowedMcpServerIds: [],
        pluginPath: '/p',
        skillId: 's',
      },
      {
        kind: 'maintenance-scan',
        triggeringPrincipalId: 'p' as ReviewerJobInput['triggeringPrincipalId'],
        scope: 'vault',
        vaultPrincipalId: 'p' as ReviewerJobInput['triggeringPrincipalId'],
      },
    ];
    assert.equal(inputs.length, 3);
  });
});

describe('JobEventPayload', () => {
  it('all 4 kinds covered', () => {
    const events: JobEventPayload[] = [
      { kind: 'progress', fraction: 0.3, message: 'reading doc' },
      { kind: 'partial', revisionId: 'rev-1', note: 'first batch' },
      {
        kind: 'done',
        outputRevisionIds: ['rev-1', 'rev-2'],
        outputThreadIds: ['t-1'],
        cost: { inputTokens: 1000, outputTokens: 500, usdMilli: 50 },
      },
      { kind: 'error', errorClass: 'TimeoutError', errorMessage: 'over 5min' },
    ];
    assert.equal(events.length, 4);
    assert.equal(events.filter((e) => e.kind === 'progress').length, 1);
  });
});

describe('AgentJobStatus enum values', () => {
  it('matches PG enum literals (queued/running/done/error/cancelled)', () => {
    const values: AgentJobStatus[] = [
      'queued',
      'running',
      'done',
      'error',
      'cancelled',
    ];
    assert.equal(values.length, 5);
  });
});
