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
  persistProposalBatch,
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
  // Phase 4 W1 ADR-0012 install backend (capability prompt + sandbox
  // descriptor + install row payload — used by apps/web settings UI).
  buildCapabilityPrompt,
  buildSandboxDescriptor,
  buildLinuxBwrapArgs,
  buildInstallRowPayload,
  InstallRejectedError,
  type BuildInstallRowInput,
  type BuildSandboxDescriptorInput,
  type CapabilityPromptRow,
  type LinuxBwrapDescriptor,
  type MacOsSandboxExecDescriptor,
  type PluginInstallOrigin,
  type PluginInstallRowPayload,
  type PluginInstallStatus,
  type SandboxDescriptor,
  type SandboxPlatform,
  type WindowsAppContainerDescriptor,
} from './plugins';

export {
  invokeAgentViaPlugin,
  type InvokeAgentViaPluginInput,
  type InvokeAgentViaPluginOptions,
  type InvokeAgentViaPluginResult,
} from './plugin-host';

// Phase 3 W7 ADR-0013: ModelProvider abstraction (BYO model).
// Phase 3 closeout ships all 4 wire-format adapters; Phase 4 W2 adds
// the lookup precedence resolver.
export {
  createAnthropicProvider,
  createOpenAICompatProvider,
  createOllamaProvider,
  createCustomHttpProvider,
  // Phase 4 W7.2 ADR-0013 §2.5: mock provider for plugin contract.
  createMockModelProvider,
  shapeForAgentKind,
  ProviderError,
  isUserConfigured,
  resolveProvider,
  type CustomHttpHistoryEntry,
  type CustomHttpParsed,
  type CustomHttpProviderOptions,
  type CustomHttpRequestSpec,
  type DocumentModelOverrideSnapshot,
  type EnvDefault,
  type EnvResolver,
  type ManifestPrefersProvider,
  type MockProviderOptions,
  type MockShape,
  type ModelProvider,
  type OllamaProviderOptions,
  type OpenAICompatProviderOptions,
  type ProviderConfig,
  type ProviderFeatures,
  type ProviderRunInput,
  type ResolveProviderInput,
  type ResolvedProvider,
  type UserModelPrefSnapshot,
  type WireFormat,
} from './providers';

// Phase 3 W6: Coordinator handoff types + closeout dispatch helpers.
// Phase 4 W3: full multi-step loop orchestrator. plugins/coordinator-
// agent wires LLM provider call; apps/agent-worker handles async
// parent_job_id insertion.
export type {
  AgentHandoff,
  AsyncHandoffEnqueuer,
  CoordinatorDecision,
  CoordinatorFinalReport,
  CoordinatorJobInput,
  CoordinatorStepRunner,
  HandoffResult,
  RunCoordinatorLoopInput,
  SyncHandoffRunner,
} from './coordinator';

export {
  parseCoordinatorDecision,
  dispatchSyncHandoffs,
  runCoordinatorLoop,
  ProposalBuffer,
} from './coordinator';
