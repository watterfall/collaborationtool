// Phase 3 W6 Coordinator public API. Phase 3 W6 commit (this file)
// ships **types only**; the LLM-driven dispatch logic lands in
// plugins/coordinator-agent/agent.ts later in W6.

export type {
  AgentHandoff,
  CoordinatorDecision,
  CoordinatorFinalReport,
  CoordinatorJobInput,
  HandoffResult,
} from './types';
