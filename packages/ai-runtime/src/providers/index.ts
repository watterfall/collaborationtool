// Phase 3 W7 ADR-0013 providers public API.
//
// Phase 3 W7 commit (this file): only the Anthropic adapter ships.
// OpenAI-compat / Ollama / custom-http adapters land later in W7
// (gated by ADR-0013 §2.6 dogfood gate).

export {
  type ModelProvider,
  type ProviderConfig,
  type ProviderFeatures,
  type ProviderRunInput,
  type WireFormat,
  ProviderError,
} from './types';

export { createAnthropicProvider } from './anthropic';
