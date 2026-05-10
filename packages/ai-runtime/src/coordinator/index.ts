// Phase 3 W6 Coordinator public API.
// Closeout commit: types + small in-process dispatch helpers
// (parseCoordinatorDecision + dispatchSyncHandoffs). The full
// LLM-driven loop lives in plugins/coordinator-agent/agent.ts; the
// async-handoff agent_job insert lives in apps/agent-worker.

export type {
  AgentHandoff,
  CoordinatorDecision,
  CoordinatorFinalReport,
  CoordinatorJobInput,
  HandoffResult,
} from './types';

export {
  parseCoordinatorDecision,
  dispatchSyncHandoffs,
  type SyncHandoffRunner,
} from './dispatch';

// Phase 4 W3 ADR-0008: full coordinator loop orchestrator.
// Phase 4 W7.4: ProposalBuffer + flushPendingProposals hook.
export {
  runCoordinatorLoop,
  ProposalBuffer,
  type AsyncHandoffEnqueuer,
  type CoordinatorStepRunner,
  type RunCoordinatorLoopInput,
} from './loop';
