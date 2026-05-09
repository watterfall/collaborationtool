// Public API for ai-runtime.

export {
  loadSkill,
  SkillLoadError,
  _resetSkillCache,
  type SkillMeta,
  type LoadSkillOptions,
} from './skills-loader';

export {
  buildMcpServerSet,
  type McpServerHandle,
  type McpServerSet,
  type McpServerSpec,
  type McpToolDescriptor,
  type ToolCallOutcome,
} from './mcp-client';

export {
  inMemoryServerTransport,
  crossrefMockTransport,
} from './transports';

export {
  runAnthropicAgent,
  runMockAgent,
  type AnthropicRunnerInput,
  type MockRunnerInput,
  type RunnerCommonInput,
} from './agent-runner';

export {
  persistProposal,
  acceptRevisionToContribution,
  type PersistProposalInput,
  type PersistProposalResult,
  type AcceptRevisionInput,
  type AcceptRevisionResult,
} from './provenance-writer';

export type {
  AgentProposal,
  CommitResult,
  InputPassage,
  InvocationContext,
  ProposedRevisedFragment,
} from './types';

export {
  invokeCitationAgent,
  type InvokeCitationAgentInput,
  type InvokeCitationAgentOptions,
  type InvokeCitationAgentResult,
} from './agents/citation';

export {
  invokeInlineEditorAgent,
  type InvokeInlineEditorAgentInput,
  type InvokeInlineEditorAgentOptions,
  type InvokeInlineEditorAgentResult,
} from './agents/inline-editor';
