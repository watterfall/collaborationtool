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
  stdioServerTransport,
  type StdioFactoryParams,
  type StdioFactoryResult,
  type InMemoryFactoryResult,
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
  rejectRevision,
  supersedeRevisionWithModified,
  listPendingRevisions,
  type PersistProposalInput,
  type PersistProposalResult,
  type AcceptRevisionInput,
  type AcceptRevisionResult,
  type RejectRevisionInput,
  type RejectRevisionResult,
  type ModifyRevisionInput,
  type ModifyRevisionResult,
  type ListPendingRevisionsInput,
  type PendingRevisionRow,
} from './provenance-writer';

export type {
  AgentProposal,
  CommitResult,
  InputPassage,
  InvocationContext,
  ProposedRevisedFragment,
} from './types';

// Both built-in agents (citation + inline-editor) moved to plugins/:
//   - citation: Phase 2 W3 dogfood gate (ADR-0010 §2.7)
//   - inline-editor: Phase 2 W5 follow-up (ADR-0010 review log W4-W5)
// Callers use `invokeAgentViaPlugin` (below) with the appropriate
// `pluginPath`. There is no longer any hardcoded agent in this package.

// Phase 2 W1 ADR-0010: plugin loader skeleton.
// Phase 1 agents (citation / inline-editor) still wired through the
// hardcoded paths above; W3 dogfood gate switches citation to the
// plugin path and removes the hardcoded export.
//
// Phase 2 W2: loadAgentPlugin + AgentPluginModule contract. First
// reference impl: plugins/citation-agent/.
//
// Phase 2 W3 (this commit): invokeAgentViaPlugin host helper +
// dogfood gate flip — citation agent uniformly goes through plugin
// path; hardcode agents/citation.ts removed (no internal-only API).
// inline-editor remains hardcoded; W4-W5 follow-up.
export {
  loadPlugin,
  loadAgentPlugin,
  loadPluginRegistry,
  findAgentByKind,
  resolvePluginAbsolutePath,
  parseManifest,
  PluginLoadError,
  PluginManifestError,
  MANIFEST_FILENAME,
  _resetPluginRegistryCache,
  type AgentManifest,
  type AgentPluginInput,
  type AgentPluginModule,
  type BasePluginManifest,
  type BilingualString,
  type LoadedAgentPlugin,
  type LoadedPlugin,
  type McpServerManifest,
  type PluginKind,
  type PluginManifest,
  type RegisteredPlugin,
  type SkillManifest,
  type UiPanelManifest,
} from './plugins';

export {
  invokeAgentViaPlugin,
  type InvokeAgentViaPluginInput,
  type InvokeAgentViaPluginOptions,
  type InvokeAgentViaPluginResult,
} from './plugin-host';

// Phase 3 W7 ADR-0013: ModelProvider abstraction (BYO model).
// Anthropic adapter ships in this commit; openai-compat / ollama /
// custom-http land later in W7.
export {
  createAnthropicProvider,
  ProviderError,
  type ModelProvider,
  type ProviderConfig,
  type ProviderFeatures,
  type ProviderRunInput,
  type WireFormat,
} from './providers';

// Phase 3 W6: Coordinator agent handoff types.
// plugins/coordinator-agent/ 实施 LLM-driven dispatch 逻辑 W6 后续。
export type {
  AgentHandoff,
  CoordinatorDecision,
  CoordinatorFinalReport,
  CoordinatorJobInput,
  HandoffResult,
} from './coordinator';
