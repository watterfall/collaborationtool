// Phase 3 W7 ADR-0013 providers public API.
//
// Phase 3 W7 closeout: all 4 wire-format adapters ship.
//
// Phase 3 W7 dogfood gate (ADR-0013 §2.6) verifies real round-trip
// against:
//   - Anthropic API (Claude 4.x) — already shipping (Phase 1+ default)
//   - OpenAI-compat — vLLM / OpenRouter / DeepSeek
//   - Ollama — local Llama 3.x / Qwen
//   - custom-http — corp internal (deferred to host integration test)

export {
  type ModelProvider,
  type ProviderConfig,
  type ProviderFeatures,
  type ProviderRunInput,
  type WireFormat,
  ProviderError,
} from './types';

export { createAnthropicProvider } from './anthropic';
// Phase 4 W7.2 ADR-0013 §2.5: mock provider for the plugin contract
// migration. Replaces the historical `anthropic: null` mock-runner
// branch in plugin agents with a uniform ModelProvider.
export {
  createMockModelProvider,
  shapeForAgentKind,
  type MockProviderOptions,
  type MockShape,
} from './mock';
export {
  createOpenAICompatProvider,
  type OpenAICompatProviderOptions,
} from './openai-compat';
export {
  createOllamaProvider,
  type OllamaProviderOptions,
} from './ollama';
export {
  createCustomHttpProvider,
  type CustomHttpHistoryEntry,
  type CustomHttpParsed,
  type CustomHttpProviderOptions,
  type CustomHttpRequestSpec,
} from './custom-http';

// Phase 4 W2 ADR-0013 §2.4 lookup precedence resolver.
export {
  resolveProvider,
  isUserConfigured,
  type DocumentModelOverrideSnapshot,
  type EnvDefault,
  type EnvResolver,
  type ManifestPrefersProvider,
  type ResolveProviderInput,
  type ResolvedProvider,
  type UserModelPrefSnapshot,
} from './resolver';
