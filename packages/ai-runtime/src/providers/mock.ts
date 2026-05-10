// Phase 4 W7.2 ADR-0013 §2.5: Mock ModelProvider adapter.
//
// Wraps the existing `runMockAgent` (from ../agent-runner.ts) into the
// ModelProvider contract. Used by:
//   - plugin-host default fallback when caller does not supply a
//     provider (CI / air-gapped dev mirrors the old `anthropic: null`
//     branch — see ADR-0013 §2.5 W7.2 review log)
//   - tests that exercise the plugin path without an LLM (provider
//     contract tests, citation correctness, third-party plugin)
//
// The mock provider is parameterised by `shape` (one of the 5 mock
// shapes implemented in agent-runner.ts). The host derives shape from
// `manifest.kind` so plugin authors no longer pick the shape inside
// `runAgent`. This keeps plugins wire-format agnostic — they call
// `input.provider.runAgent(...)` regardless of which provider the host
// resolved.

import { runMockAgent, type MockRunnerInput } from '../agent-runner';
import type { AgentProposal } from '../types';

import type {
  ModelProvider,
  ProviderConfig,
  ProviderFeatures,
  ProviderRunInput,
} from './types';

/** All 5 mock shapes implemented by `runMockAgent`. */
export type MockShape = MockRunnerInput['shape'];

const MOCK_FEATURES: ProviderFeatures = {
  toolUse: true,
  streaming: false,
  systemPrompt: true,
  jsonMode: false,
  visionInput: false,
  approxContextTokens: 200_000,
};

export interface MockProviderOptions {
  /** Which mock shape to dispatch. Defaults to 'inline-editor' (the
   * least surprising shape — single replacement of the passage). */
  shape?: MockShape;
}

/**
 * Construct a deterministic mock provider. No network, no LLM. Returns
 * the same canned proposal shape that `runMockAgent` always has.
 *
 * `id` and `label` from `ProviderConfig` follow through; `apiKey` /
 * `endpointUrl` / `headers` are ignored (mock has no remote endpoint).
 */
export function createMockModelProvider(
  config: ProviderConfig,
  options: MockProviderOptions = {},
): ModelProvider {
  const shape: MockShape = options.shape ?? 'inline-editor';

  return {
    id: config.id,
    label: config.label ?? `Mock (${shape})`,
    // 'anthropic' was the historical default modelProvider tag for the
    // mock path's AgentExecutionContext; the mock runner overrides
    // `modelProvider: 'local-ollama'` internally so the AgentProposal
    // stays self-consistent. We pick 'anthropic' here purely as the
    // wireFormat tag (it has no semantic effect — the runner doesn't
    // hit any wire). This avoids surprising downstream code that
    // groups by wireFormat.
    wireFormat: 'anthropic',
    features: MOCK_FEATURES,
    async runAgent(input: ProviderRunInput): Promise<AgentProposal> {
      // Citation shape consumes flaggedDoiCandidates from hints; other
      // shapes ignore it. We forward the typed slice the runner expects.
      const flagged = input.hints['flaggedDoiCandidates'];
      const flaggedDoiCandidates =
        Array.isArray(flagged) && flagged.every((x) => typeof x === 'string')
          ? (flagged as string[])
          : undefined;
      return runMockAgent({
        shape,
        skill: input.skill,
        mcp: input.mcp,
        passage: input.passage,
        ...(flaggedDoiCandidates ? { hints: { flaggedDoiCandidates } } : {}),
        agentId: input.agentId,
        actorPrincipalId: input.actorPrincipalId,
        ...(input.userInstruction !== undefined
          ? { userInstruction: input.userInstruction }
          : {}),
      });
    },
  };
}

/** Default shape lookup keyed by ADR-0001 agent_kind → mock shape. The
 * host uses this when the caller doesn't pass a provider; tests that
 * want an explicit shape construct `createMockModelProvider` directly. */
export function shapeForAgentKind(
  kind: 'editor' | 'citation' | 'reviewer' | 'researcher' | 'coordinator' | 'custom',
): MockShape {
  switch (kind) {
    case 'citation':
      return 'citation';
    case 'editor':
      return 'inline-editor';
    case 'reviewer':
      return 'reviewer';
    case 'researcher':
      return 'researcher';
    case 'coordinator':
      // Coordinator mock leans on reviewer's window-iteration shape;
      // real LLM-driven dispatch lands W6 末 (see coordinator-agent
      // plugin for the JSON-emit contract).
      return 'reviewer';
    case 'custom':
      // source-extractor is the only `custom` plugin in tree (Phase 3
      // W2). Default to its shape; bespoke plugins can override at the
      // host call site by passing `provider: createMockModelProvider(
      // ..., { shape: '...' })` explicitly.
      return 'source-extractor';
    default:
      return 'inline-editor';
  }
}
