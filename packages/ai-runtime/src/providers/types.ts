// Phase 3 W7 ADR-0013: ModelProvider abstraction.
//
// This file is the runtime-agnostic interface; concrete adapters live
// in `./anthropic.ts` / `./openai-compat.ts` / `./ollama.ts` /
// `./custom-http.ts`. The host (apps/web /api/agent/invoke + apps/
// agent-worker) instantiates a single ModelProvider per
// invokeAgentViaPlugin call, picked from `user_model_pref` /
// `document_model_override`.
//
// Phase 3 W7 commit (this file + anthropic adapter): types are stable.
// OpenAI-compat / Ollama / custom-http adapters land later in W7
// (gated by ADR-0013 §2.6 dogfood gate). The existing
// runAnthropicAgent in agent-runner.ts is wrapped by anthropic
// adapter; once all 4 providers exist, runAnthropicAgent becomes
// internal-only and the public AgentPluginInput.anthropic field
// migrates to AgentPluginInput.provider per ADR-0013 §2.5.

import type { McpServerSet } from '../mcp-client';
import type { SkillMeta } from '../skills-loader';
import type { AgentProposal } from '../types';

export type WireFormat =
  | 'anthropic'
  | 'openai-compat'
  | 'ollama'
  | 'custom-http';

export interface ProviderFeatures {
  toolUse: boolean;
  streaming: boolean;
  systemPrompt: boolean;
  jsonMode: boolean;
  visionInput: boolean;
  /** Approximate context window in tokens. Plugins use this to decide
   * whether to chunk a long doc. Not enforced. */
  approxContextTokens: number;
}

export interface ProviderRunInput {
  modelId: string;
  systemPrompt: string;
  skill: SkillMeta;
  mcp: McpServerSet;
  passage: string;
  hints: Record<string, unknown>;
  agentId: string;
  actorPrincipalId: string;
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
  userInstruction?: string;
}

export interface ModelProvider {
  /** Stable id, e.g. 'anthropic' / 'openai' / 'ollama' / 'custom-foo'. */
  id: string;
  /** Human-friendly label for UI. */
  label: string;
  wireFormat: WireFormat;
  features: ProviderFeatures;
  /** Run a single agent invocation. Throws on provider-side error;
   * the host translates to AgentProposal with a uncertainty entry. */
  runAgent(input: ProviderRunInput): Promise<AgentProposal>;
}

/** Construction-time config for a provider. Adapters consume these. */
export interface ProviderConfig {
  id: string;
  label?: string;
  /** Endpoint override; provider uses its default if unset. */
  endpointUrl?: string;
  /** API key (or 'no-auth' for local Ollama). Adapters MUST not log
   * this; the host's observability layer redacts before sending. */
  apiKey?: string;
  /** Custom headers (rare; primarily for self-hosted vLLM with auth
   * proxy). */
  headers?: Record<string, string>;
}

export class ProviderError extends Error {
  override name = 'ProviderError';
  constructor(
    public readonly code:
      | 'config-invalid'
      | 'auth-failed'
      | 'rate-limited'
      | 'timeout'
      | 'tool-protocol-mismatch'
      | 'unknown',
    message: string,
  ) {
    super(message);
  }
}
