// Phase 4 W3 ADR-0008 + Phase 3 W6 closeout: full coordinator loop tests.
// All LLM + handoff dependencies are stubbed; pure orchestration logic.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  runCoordinatorLoop,
  type AgentHandoff,
  type AsyncHandoffEnqueuer,
  type CoordinatorJobInput,
  type CoordinatorStepRunner,
  type SyncHandoffRunner,
} from '../src/coordinator';

const baseJob: CoordinatorJobInput = {
  kind: 'coordinator',
  documentId: 'doc:phase4-test' as never,
  triggeringPrincipalId: 'principal:user-1' as never,
  goal: 'verify all DOIs in §3 then run a tone review',
  maxSteps: 4,
};

function makeStepRunner(
  scripted: string[],
): CoordinatorStepRunner {
  let i = 0;
  return async () => {
    const text = scripted[i++] ?? scripted[scripted.length - 1] ?? '';
    return { assistantText: text };
  };
}

function jsonStep(decision: {
  rationale: string;
  handoffs: Array<Omit<AgentHandoff, 'hints'> & { hints?: Record<string, unknown> }>;
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

describe('runCoordinatorLoop', () => {
  it('runs one sync handoff then stops on [final] marker', async () => {
    const stepRunner = makeStepRunner([
      jsonStep({
        rationale: 'Verify DOIs first',
        handoffs: [
          { toAgentKind: 'citation', goal: 'verify §3 DOIs', mode: 'sync' },
        ],
        scratchpad: '[final] all good',
      }),
    ]);
    const calls: string[] = [];
    const syncRunner: SyncHandoffRunner = async (h) => {
      calls.push(h.toAgentKind);
      return { summary: `${h.toAgentKind} done`, revisionId: 'rev-1' };
    };
    const asyncEnqueuer: AsyncHandoffEnqueuer = async () => {
      throw new Error('should not be called');
    };

    const report = await runCoordinatorLoop({
      job: baseJob,
      stepRunner,
      syncRunner,
      asyncEnqueuer,
    });

    assert.equal(report.steps.length, 1);
    assert.equal(report.handoffResults.length, 1);
    assert.equal(report.handoffResults[0]!.summary, 'citation done');
    assert.equal(report.handoffResults[0]!.revisionId, 'rev-1');
    assert.deepEqual(calls, ['citation']);
    assert.match(report.summary, /Decisions taken: 1/);
    assert.match(report.summary, /Sub-tasks dispatched: 1/);
    assert.match(report.summary, /Revisions proposed: 1/);
  });

  it('runs multi-step loop with sync + async mix', async () => {
    const stepRunner = makeStepRunner([
      // Step 1: dispatch citation (sync) + reviewer (async)
      jsonStep({
        rationale: 'parallel start',
        handoffs: [
          { toAgentKind: 'citation', goal: 'verify DOIs', mode: 'sync' },
          {
            toAgentKind: 'reviewer',
            goal: 'tone review',
            mode: 'async',
          },
        ],
      }),
      // Step 2: stop
      jsonStep({
        rationale: 'reviewer running async; we are done',
        handoffs: [
          { toAgentKind: 'editor', goal: 'final polish', mode: 'sync' },
        ],
        scratchpad: '[final] polished',
      }),
    ]);

    const syncRunner: SyncHandoffRunner = async (h) => ({
      summary: `${h.toAgentKind} sync done`,
    });
    let asyncCount = 0;
    const asyncEnqueuer: AsyncHandoffEnqueuer = async () => {
      asyncCount += 1;
      return { childJobId: `child-${asyncCount}` };
    };

    const report = await runCoordinatorLoop({
      job: baseJob,
      stepRunner,
      syncRunner,
      asyncEnqueuer,
    });

    assert.equal(report.steps.length, 2);
    // 2 sync (citation, editor) + 1 async (reviewer)
    assert.equal(report.handoffResults.length, 3);
    assert.equal(asyncCount, 1);
    const asyncResult = report.handoffResults.find(
      (r) => r.toAgentKind === 'reviewer',
    );
    assert.equal(asyncResult?.childJobId, 'child-1');
  });

  it('respects maxSteps hard stop', async () => {
    const everyStepDispatches = jsonStep({
      rationale: 'never finishing',
      handoffs: [
        { toAgentKind: 'citation', goal: 'x', mode: 'sync' },
      ],
    });
    const stepRunner = makeStepRunner([
      everyStepDispatches,
      everyStepDispatches,
      everyStepDispatches,
      everyStepDispatches,
      everyStepDispatches,
      everyStepDispatches,
      everyStepDispatches,
      everyStepDispatches,
    ]);
    const syncRunner: SyncHandoffRunner = async () => ({ summary: 'ok' });
    const asyncEnqueuer: AsyncHandoffEnqueuer = async () => ({
      childJobId: 'x',
    });

    const report = await runCoordinatorLoop({
      job: { ...baseJob, maxSteps: 3 },
      stepRunner,
      syncRunner,
      asyncEnqueuer,
    });
    assert.equal(report.steps.length, 3);
  });

  it('treats unparseable LLM output as stop signal', async () => {
    const stepRunner = makeStepRunner([
      jsonStep({
        rationale: 'first step',
        handoffs: [
          { toAgentKind: 'citation', goal: 'x', mode: 'sync' },
        ],
      }),
      'not a JSON block, just prose',
    ]);
    const syncRunner: SyncHandoffRunner = async () => ({ summary: 'ok' });
    const asyncEnqueuer: AsyncHandoffEnqueuer = async () => ({
      childJobId: 'x',
    });

    const report = await runCoordinatorLoop({
      job: baseJob,
      stepRunner,
      syncRunner,
      asyncEnqueuer,
    });
    assert.equal(report.steps.length, 2);
    assert.equal(report.steps[1]!.handoffs.length, 0);
    assert.match(report.steps[1]!.rationale, /unparseable/);
  });

  it('filters handoffs against allowedAgentKinds', async () => {
    const stepRunner = makeStepRunner([
      jsonStep({
        rationale: 'tries to use editor + citation',
        handoffs: [
          { toAgentKind: 'editor', goal: 'rewrite', mode: 'sync' },
          { toAgentKind: 'citation', goal: 'verify', mode: 'sync' },
        ],
        scratchpad: '[final]',
      }),
    ]);
    const calls: string[] = [];
    const syncRunner: SyncHandoffRunner = async (h) => {
      calls.push(h.toAgentKind);
      return { summary: 'ok' };
    };
    const asyncEnqueuer: AsyncHandoffEnqueuer = async () => ({
      childJobId: 'x',
    });

    const report = await runCoordinatorLoop({
      job: { ...baseJob, allowedAgentKinds: ['citation'] },
      stepRunner,
      syncRunner,
      asyncEnqueuer,
    });
    // editor is filtered out; citation runs
    assert.deepEqual(calls, ['citation']);
    assert.equal(report.handoffResults.length, 1);
  });

  it('captures async-enqueue errors in handoffResults', async () => {
    const stepRunner = makeStepRunner([
      jsonStep({
        rationale: 'try async',
        handoffs: [
          { toAgentKind: 'researcher', goal: 'x', mode: 'async' },
        ],
        scratchpad: '[final]',
      }),
    ]);
    const syncRunner: SyncHandoffRunner = async () => {
      throw new Error('should not be called');
    };
    const asyncEnqueuer: AsyncHandoffEnqueuer = async () => {
      throw new Error('pgboss connection refused');
    };

    const report = await runCoordinatorLoop({
      job: baseJob,
      stepRunner,
      syncRunner,
      asyncEnqueuer,
    });
    assert.equal(report.handoffResults.length, 1);
    assert.match(
      report.handoffResults[0]!.errorMessage ?? '',
      /pgboss connection refused/,
    );
    assert.match(report.summary, /Sub-tasks errored: 1/);
  });

  it('invokes onStep callback after each iteration', async () => {
    const stepRunner = makeStepRunner([
      jsonStep({
        rationale: 'once',
        handoffs: [
          { toAgentKind: 'citation', goal: 'x', mode: 'sync' },
        ],
        scratchpad: '[final]',
      }),
    ]);
    const observed: number[] = [];
    await runCoordinatorLoop({
      job: baseJob,
      stepRunner,
      syncRunner: async () => ({ summary: 'ok' }),
      asyncEnqueuer: async () => ({ childJobId: 'x' }),
      onStep: async (decision) => {
        observed.push(decision.step);
      },
    });
    assert.deepEqual(observed, [1]);
  });
});
