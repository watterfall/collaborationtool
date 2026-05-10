// Anthropic ModelProvider adapter (Phase 3 W7).
//
// Wraps the existing runAnthropicAgent (from ../agent-runner.ts) into
// the ModelProvider interface. Phase 1 + Phase 2's direct
// `Anthropic.Client` usage continues to work; the adapter just
// constructs the client from `ProviderConfig.apiKey` and dispatches.
//
// Once OpenAI-compat / Ollama / custom-http adapters land, the
// `AgentPluginInput.anthropic` field is replaced by `provider`
// (ADR-0013 §2.5 migration). Until then, both paths coexist:
//   - Old: invokeAgentViaPlugin({ ..., anthropic: client })  (Phase 2)
//   - New: invokeAgentViaPlugin({ ..., provider: anthropicProvider })

import Anthropic from '@anthropic-ai/sdk';

import { runAnthropicAgent, type AnthropicRunnerInput } from '../agent-runner';
import type { AgentProposal } from '../types';

import type {
  ModelProvider,
  ProviderConfig,
  ProviderFeatures,
  ProviderRunInput,
} from './types';
import { ProviderError } from './types';

const ANTHROPIC_FEATURES: ProviderFeatures = {
  toolUse: true,
  streaming: true,
  systemPrompt: true,
  jsonMode: false, // Anthropic supports forced JSON via tool calling, not a flag
  visionInput: true,
  approxContextTokens: 200_000, // Claude 4 default; Sonnet 1M is opt-in via header
};

export function createAnthropicProvider(
  config: ProviderConfig,
): ModelProvider {
  if (!config.apiKey) {
    throw new ProviderError(
      'config-invalid',
      'anthropic provider requires apiKey (set ANTHROPIC_API_KEY env)',
    );
  }
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.endpointUrl ? { baseURL: config.endpointUrl } : {}),
    defaultHeaders: config.headers,
  });

  return {
    id: config.id,
    label: config.label ?? 'Anthropic',
    wireFormat: 'anthropic',
    features: ANTHROPIC_FEATURES,
    async runAgent(input: ProviderRunInput): Promise<AgentProposal> {
      return runAnthropicAgent({
        client,
        modelId: input.modelId,
        systemPrompt: input.systemPrompt,
        skill: input.skill,
        mcp: input.mcp,
        passage: input.passage,
        hints: input.hints as AnthropicRunnerInput['hints'],
        agentId: input.agentId as AnthropicRunnerInput['agentId'],
        actorPrincipalId:
          input.actorPrincipalId as AnthropicRunnerInput['actorPrincipalId'],
        ...(input.maxIterations !== undefined
          ? { maxIterations: input.maxIterations }
          : {}),
        ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
        ...(input.temperature !== undefined
          ? { temperature: input.temperature }
          : {}),
        ...(input.userInstruction !== undefined
          ? { userInstruction: input.userInstruction }
          : {}),
      } satisfies AnthropicRunnerInput);
    },
  };
}
