// Phase 4 W3 ADR-0008 + Phase 3 W6 closeout: full coordinator multi-step
// dispatch loop.
//
// The coordinator is itself a long-horizon agent (ADR-0008 runtime
// 'long-horizon'). On each iteration it:
//   1. Asks the LLM "given the goal + scratchpad of prior results,
//      what's the next step?"
//   2. Parses the assistant text into a CoordinatorDecision (via
//      parseCoordinatorDecision, Phase 3 closeout).
//   3. Runs sync handoffs in declaration order.
//   4. Schedules async handoffs (host inserts agent_job rows with
//      parent_job_id; loop receives placeholder HandoffResults).
//   5. If the decision contains `final: true`, exits with a
//      CoordinatorFinalReport summary; otherwise loops up to maxSteps.
//
// What this module is NOT: an Anthropic / OpenAI client. It accepts a
// `singleStepRunner` callback that the host wires to the BYO provider
// of the user's choice (Anthropic / OpenAI-compat / Ollama / custom).
// That keeps this loop testable (mock the LLM) and free of HTTP deps.

import {
  dispatchSyncHandoffs,
  parseCoordinatorDecision,
  type SyncHandoffRunner,
} from './dispatch';
import type {
  AgentHandoff,
  CoordinatorDecision,
  CoordinatorFinalReport,
  CoordinatorJobInput,
  HandoffResult,
} from './types';

/**
 * One LLM invocation: given the goal + scratchpad, return the
 * assistant's raw text. The coordinator parses fenced JSON out of it.
 *
 * The host implementation typically wraps a ProviderRunInput +
 * provider.runAgent call, but the loop only cares about the text.
 */
export type CoordinatorStepRunner = (input: {
  step: number;
  goal: string;
  /** A running summary of decisions + handoff results so far. */
  scratchpad: string;
  /** Restrict which agent kinds the LLM is allowed to dispatch. */
  allowedAgentKinds?: AgentHandoff['toAgentKind'][];
}) => Promise<{
  /** Raw assistant text; coordinator parses it via
   * parseCoordinatorDecision. */
  assistantText: string;
}>;

/**
 * Async handoff hook: host inserts an agent_job row + parent_job_id
 * link, then enqueues onto the appropriate pgboss queue. The loop
 * fires-and-forgets — does not poll the child.
 */
export type AsyncHandoffEnqueuer = (handoff: AgentHandoff) => Promise<{
  childJobId: string;
}>;

export interface RunCoordinatorLoopInput {
  job: CoordinatorJobInput;
  stepRunner: CoordinatorStepRunner;
  syncRunner: SyncHandoffRunner;
  asyncEnqueuer: AsyncHandoffEnqueuer;
  /** Hard stop on the number of decisions; default 6. */
  maxSteps?: number;
  /** Called after each step so the host can append agent_job_event
   * rows for SSE consumers. Optional. */
  onStep?: (
    decision: CoordinatorDecision,
    results: HandoffResult[],
  ) => Promise<void> | void;
}

/** Runs the coordinator loop end to end. Returns the final report. */
export async function runCoordinatorLoop(
  input: RunCoordinatorLoopInput,
): Promise<CoordinatorFinalReport> {
  const maxSteps = input.maxSteps ?? input.job.maxSteps ?? 6;
  const steps: CoordinatorDecision[] = [];
  const handoffResults: HandoffResult[] = [];
  let scratchpad = '';

  for (let stepNum = 1; stepNum <= maxSteps; stepNum++) {
    const llmOut = await input.stepRunner({
      step: stepNum,
      goal: input.job.goal,
      scratchpad,
      ...(input.job.allowedAgentKinds
        ? { allowedAgentKinds: input.job.allowedAgentKinds }
        : {}),
    });
    const decision = parseCoordinatorDecision(llmOut.assistantText, stepNum);
    if (!decision) {
      // LLM produced no parseable decision. This is treated as
      // "coordinator wants to stop" — emit a stub final-decision step
      // so the report carries the empty-stop reason, then exit.
      const stopDecision: CoordinatorDecision = {
        step: stepNum,
        rationale:
          'Coordinator emitted unparseable text; treated as stop signal.',
        handoffs: [],
        scratchpad,
      };
      steps.push(stopDecision);
      break;
    }

    // Validate against allowedAgentKinds (host might bypass this in
    // the LLM prompt, so double-check defensively).
    if (input.job.allowedAgentKinds) {
      const allowed = new Set(input.job.allowedAgentKinds);
      decision.handoffs = decision.handoffs.filter((h) =>
        allowed.has(h.toAgentKind),
      );
      if (decision.handoffs.length === 0) {
        // All handoffs filtered out — stop with note.
        decision.rationale +=
          ' [all handoffs filtered by allowedAgentKinds; stopping]';
        steps.push(decision);
        break;
      }
    }

    steps.push(decision);

    // Run sync handoffs.
    const stepSyncResults = await dispatchSyncHandoffs(
      decision,
      input.syncRunner,
    );
    handoffResults.push(...stepSyncResults);

    // Schedule async handoffs (no awaiting child completion).
    for (const h of decision.handoffs) {
      if (h.mode !== 'async') continue;
      try {
        const r = await input.asyncEnqueuer(h);
        handoffResults.push({
          toAgentKind: h.toAgentKind,
          summary: `enqueued async; childJobId=${r.childJobId}`,
          childJobId: r.childJobId,
        });
      } catch (err) {
        handoffResults.push({
          toAgentKind: h.toAgentKind,
          summary: `async enqueue failed: ${(err as Error).message}`,
          errorMessage: (err as Error).message,
        });
      }
    }

    // Update scratchpad with this step's outcome.
    scratchpad = composeScratchpad(steps, handoffResults);

    if (input.onStep) {
      await input.onStep(decision, stepSyncResults);
    }

    // Did the LLM signal final?
    if (
      typeof decision.scratchpad === 'string' &&
      /\[final\]/i.test(decision.scratchpad)
    ) {
      break;
    }
  }

  return {
    goal: input.job.goal,
    steps,
    handoffResults,
    summary: composeFinalSummary(input.job.goal, steps, handoffResults),
  };
}

function composeScratchpad(
  steps: CoordinatorDecision[],
  results: HandoffResult[],
): string {
  const lines: string[] = [];
  for (const step of steps) {
    lines.push(`Step ${step.step}: ${step.rationale}`);
    for (const h of step.handoffs) {
      lines.push(`  - dispatch ${h.toAgentKind} (${h.mode}): ${h.goal}`);
    }
  }
  if (results.length > 0) {
    lines.push('');
    lines.push('Results so far:');
    for (const r of results) {
      const tag = r.errorMessage ? '✗' : '✓';
      lines.push(`  ${tag} ${r.toAgentKind}: ${r.summary}`);
    }
  }
  return lines.join('\n');
}

function composeFinalSummary(
  goal: string,
  steps: CoordinatorDecision[],
  results: HandoffResult[],
): string {
  const totalHandoffs = steps.reduce((n, s) => n + s.handoffs.length, 0);
  const errored = results.filter((r) => r.errorMessage).length;
  const revisions = results.filter((r) => r.revisionId).length;
  return [
    `Coordinator goal: ${goal}`,
    `Decisions taken: ${steps.length}`,
    `Sub-tasks dispatched: ${totalHandoffs}`,
    `Sub-tasks errored: ${errored}`,
    `Revisions proposed: ${revisions}`,
  ].join('\n');
}
