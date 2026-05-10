// Phase 4 W7.4: coordinator dispatch loop step-boundary flush.
// Verifies that flushPendingProposals fires exactly once per loop step
// and that ProposalBuffer drains into a single persist call regardless
// of how many proposals piled up during the step.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ProposalBuffer,
  runCoordinatorLoop,
  type AsyncHandoffEnqueuer,
  type CoordinatorJobInput,
  type CoordinatorStepRunner,
  type SyncHandoffRunner,
} from '../src/coordinator';
import type {
  PersistProposalInput,
  PersistProposalResult,
} from '../src/provenance-writer';
import type { SkillMeta } from '../src/skills-loader';
import type { AgentProposal } from '../src/types';

const baseJob: CoordinatorJobInput = {
  kind: 'coordinator',
  documentId: 'doc:phase4-w74' as never,
  triggeringPrincipalId: 'principal:user-1' as never,
  goal: 'verify §3 + tone review + citation polish',
  maxSteps: 10,
};

function jsonStep(decision: {
  rationale: string;
  handoffs: Array<{
    toAgentKind: 'citation' | 'editor' | 'reviewer' | 'researcher' | 'custom';
    goal: string;
    mode: 'sync' | 'async';
    hints?: Record<string, unknown>;
  }>;
  scratchpad?: string;
}): string {
  return [
    '```json',
    JSON.stringify({
      rationale: decision.rationale,
      handoffs: decision.handoffs.map((h) => ({ hints: {}, ...h })),
      ...(decision.scratchpad ? { scratchpad: decision.scratchpad } : {}),
    }),
    '```',
  ].join('\n');
}

function makeStepRunner(scripted: string[]): CoordinatorStepRunner {
  let i = 0;
  return async () => {
    const text = scripted[i++] ?? scripted[scripted.length - 1] ?? '';
    return { assistantText: text };
  };
}

function makeFakeProposalInput(idx: number): PersistProposalInput {
  const skill: SkillMeta = {
    skillId: 'reviewer-tone',
    name: 'reviewer-tone',
    description: '',
    allowedMcpServers: [],
    requiredCapabilities: [],
    bodyMarkdown: '# fixture',
    promptHash: 'h'.repeat(64),
    promptTemplateId: 'reviewer-tone@hhhhhhhhhhhh',
    contentBytes: 32,
  };
  const proposal: AgentProposal = {
    proposalRationale: `proposal ${idx}`,
    revisedFragments: [{ originalText: 'a', replacementText: 'b' }],
    uncertainties: [],
    toolCalls: [],
    agentContext: {
      agentId: `reviewer-${idx}`,
      skillId: 'reviewer-tone',
      promptTemplateId: skill.promptTemplateId,
      promptHash: skill.promptHash,
      modelId: 'claude-sonnet-4',
    } as unknown as AgentProposal['agentContext'],
    startedAt: '2026-05-10T00:00:00.000Z' as AgentProposal['startedAt'],
    finishedAt: '2026-05-10T00:00:01.000Z' as AgentProposal['finishedAt'],
  };
  return { proposal, skill, documentId: `doc:phase4-w74-${idx}` };
}

describe('runCoordinatorLoop flushPendingProposals', () => {
  it('flushes a ProposalBuffer once per step boundary', async () => {
    // 3 steps; each step's sync handoff produces 4 proposals.
    const stepRunner = makeStepRunner([
      jsonStep({
        rationale: 'step 1',
        handoffs: [{ toAgentKind: 'reviewer', goal: 'a', mode: 'sync' }],
      }),
      jsonStep({
        rationale: 'step 2',
        handoffs: [{ toAgentKind: 'reviewer', goal: 'b', mode: 'sync' }],
      }),
      jsonStep({
        rationale: 'step 3',
        handoffs: [{ toAgentKind: 'reviewer', goal: 'c', mode: 'sync' }],
        scratchpad: '[final]',
      }),
    ]);

    // Track persistFn calls to assert single batch per step.
    const persistCalls: Array<{ inputCount: number }> = [];
    const persistFn = async (
      inputs: PersistProposalInput[],
    ): Promise<PersistProposalResult[]> => {
      persistCalls.push({ inputCount: inputs.length });
      return inputs.map((_, i) => ({
        revisionId: `rev-${persistCalls.length}-${i}` as never,
        provenanceId: `prov-${persistCalls.length}-${i}` as never,
        promptTemplateId: inputs[i]!.skill.promptTemplateId,
      }));
    };
    const buffer = new ProposalBuffer(persistFn);

    let proposalCounter = 0;
    const syncRunner: SyncHandoffRunner = async (h) => {
      // Simulate the sub-agent producing 4 proposals during this handoff.
      for (let k = 0; k < 4; k++) {
        buffer.add(makeFakeProposalInput(proposalCounter++));
      }
      return { summary: `${h.toAgentKind} 4 proposals queued` };
    };
    const asyncEnqueuer: AsyncHandoffEnqueuer = async () => ({
      childJobId: 'unused',
    });

    const flushObservations: number[] = [];
    const report = await runCoordinatorLoop({
      job: baseJob,
      stepRunner,
      syncRunner,
      asyncEnqueuer,
      flushPendingProposals: async (decision) => {
        flushObservations.push(decision.step);
        await buffer.drainAndPersist();
      },
    });

    // 3 steps ran.
    assert.equal(report.steps.length, 3);
    // Flush hook fired once per step.
    assert.deepEqual(flushObservations, [1, 2, 3]);
    // persistFn called >= 1 (batching strategy = once per step boundary).
    assert.ok(
      persistCalls.length >= 1,
      `expected >= 1 persist call, got ${persistCalls.length}`,
    );
    // Specifically: 3 steps × 4 proposals per step = 3 batches × 4 each.
    assert.equal(persistCalls.length, 3, 'one persist call per step');
    for (const c of persistCalls) {
      assert.equal(c.inputCount, 4, 'each batch carries 4 proposals');
    }
    // Total proposals persisted = 12.
    assert.equal(proposalCounter, 12);
    assert.equal(buffer.flushHistory.length, 3);
    assert.equal(buffer.size(), 0, 'buffer drained after final step');
  });

  it('skips persistFn when buffer is empty', async () => {
    // Step that does nothing buffer-side; flush should be safe to call.
    const stepRunner = makeStepRunner([
      jsonStep({
        rationale: 'no proposals this step',
        handoffs: [{ toAgentKind: 'citation', goal: 'x', mode: 'sync' }],
        scratchpad: '[final]',
      }),
    ]);
    let persistCallCount = 0;
    const buffer = new ProposalBuffer(async (inputs) => {
      persistCallCount++;
      return [];
    });
    await runCoordinatorLoop({
      job: baseJob,
      stepRunner,
      syncRunner: async () => ({ summary: 'noop' }),
      asyncEnqueuer: async () => ({ childJobId: 'x' }),
      flushPendingProposals: async () => {
        await buffer.drainAndPersist();
      },
    });
    assert.equal(persistCallCount, 0, 'empty buffer should not call persistFn');
  });
});
