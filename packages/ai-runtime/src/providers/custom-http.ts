// Custom-HTTP ModelProvider adapter (Phase 3 W7 closeout, ADR-0013).
//
// Escape hatch for endpoints that don't speak Anthropic / OpenAI /
// Ollama wire formats — e.g. a corporate LLM gateway that requires a
// custom envelope, or a research-internal HuggingFace TGI deployment.
//
// The user supplies two function refs in `CustomHttpProviderOptions`:
//   - `serializeRequest(input) → { url, method, headers, body }`
//   - `parseResponse(httpResponseText) → { text, toolCalls? }`
//
// Tool use is best-effort: if the user's parseResponse returns
// toolCalls, the adapter loops; otherwise it treats the call as a
// single-shot completion. This adapter does NOT attempt to translate
// MCP tool descriptors into a custom envelope — the user's
// serializeRequest is responsible for embedding tool metadata into
// the prompt itself if their endpoint supports tools.
//
// Phase 3 closeout ships the adapter type + a no-op default that
// returns "not configured" so the host wires it but tests can stub.

import { createHash } from 'node:crypto';

import type { AgentExecutionContext } from '@collaborationtool/schema';

import type { AgentProposal } from '../types';

import type {
  ModelProvider,
  ProviderConfig,
  ProviderFeatures,
  ProviderRunInput,
} from './types';
import { ProviderError } from './types';

const DEFAULT_FEATURES: ProviderFeatures = {
  toolUse: false,
  streaming: false,
  systemPrompt: true,
  jsonMode: false,
  visionInput: false,
  approxContextTokens: 4_000,
};

export interface CustomHttpRequestSpec {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers: Record<string, string>;
  body?: string;
}

export interface CustomHttpParsed {
  /** Free-form assistant text. The adapter still extracts ```json``` blocks. */
  text: string;
  /** Optional structured tool-call requests; if returned, the adapter loops. */
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    /** Adapter-internal id used to match with parseResponse on the next iter. */
    id: string;
  }>;
}

export interface CustomHttpProviderOptions {
  features?: Partial<ProviderFeatures>;
  fetchImpl?: typeof fetch;
  /** Build the HTTP request from the agent input. Required. */
  serializeRequest: (
    input: ProviderRunInput,
    history: ReadonlyArray<CustomHttpHistoryEntry>,
  ) => CustomHttpRequestSpec;
  /** Parse the HTTP body text into assistant content + optional tool calls. Required. */
  parseResponse: (
    body: string,
    httpStatus: number,
  ) => CustomHttpParsed | Promise<CustomHttpParsed>;
}

export interface CustomHttpHistoryEntry {
  role: 'assistant' | 'tool';
  text: string;
  toolName?: string;
  toolCallId?: string;
}

export function createCustomHttpProvider(
  config: ProviderConfig,
  options: CustomHttpProviderOptions,
): ModelProvider {
  if (!options.serializeRequest || !options.parseResponse) {
    throw new ProviderError(
      'config-invalid',
      'custom-http provider requires serializeRequest + parseResponse callbacks',
    );
  }
  const features: ProviderFeatures = {
    ...DEFAULT_FEATURES,
    ...(options.features ?? {}),
  };
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: config.id,
    label: config.label ?? 'Custom HTTP',
    wireFormat: 'custom-http',
    features,
    async runAgent(input: ProviderRunInput): Promise<AgentProposal> {
      return runCustomHttp({
        config,
        fetchImpl,
        features,
        options,
        input,
      });
    },
  };
}

interface DispatchEnv {
  config: ProviderConfig;
  fetchImpl: typeof fetch;
  features: ProviderFeatures;
  options: CustomHttpProviderOptions;
  input: ProviderRunInput;
}

async function runCustomHttp(env: DispatchEnv): Promise<AgentProposal> {
  const { fetchImpl, features, options, input } = env;
  const startedAt = new Date().toISOString();
  const toolCalls: ProvenanceToolCall[] = [];
  const history: CustomHttpHistoryEntry[] = [];

  const maxIterations = features.toolUse ? (input.maxIterations ?? 6) : 1;
  let lastAssistantText = '';

  for (let iter = 0; iter < maxIterations; iter++) {
    const spec = options.serializeRequest(input, history);
    let response: Response;
    try {
      response = await fetchImpl(spec.url, {
        method: spec.method,
        headers: spec.headers,
        ...(spec.body !== undefined ? { body: spec.body } : {}),
      });
    } catch (err) {
      throw new ProviderError(
        'timeout',
        `custom-http fetch failed: ${(err as Error).message}`,
      );
    }
    const bodyText = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        response.status === 401 || response.status === 403
          ? 'auth-failed'
          : response.status === 429
            ? 'rate-limited'
            : 'unknown',
        `custom-http ${response.status}: ${bodyText.slice(0, 200)}`,
      );
    }

    const parsed = await options.parseResponse(bodyText, response.status);
    lastAssistantText = parsed.text;
    history.push({ role: 'assistant', text: parsed.text });

    if (!parsed.toolCalls || parsed.toolCalls.length === 0) {
      break;
    }
    if (!features.toolUse) {
      // user said no tools but parser returned them; stop to avoid infinite loop
      break;
    }

    for (const tc of parsed.toolCalls) {
      const server = input.mcp.resolve(tc.name);
      const argHash = sha256(JSON.stringify(tc.arguments));
      if (!server) {
        history.push({
          role: 'tool',
          text: JSON.stringify({ error: 'unknown_tool', name: tc.name }),
          toolName: tc.name,
          toolCallId: tc.id,
        });
        continue;
      }
      const outcome = await server.callTool(tc.name, tc.arguments);
      toolCalls.push({
        toolName: tc.name,
        mcpServerId: server.id,
        argumentsHash: argHash,
        resultSummary: truncate(outcome.text, 200),
        succeeded: outcome.succeeded,
        durationMs: outcome.durationMs,
      });
      history.push({
        role: 'tool',
        text: outcome.text,
        toolName: tc.name,
        toolCallId: tc.id,
      });
    }
  }

  const proposal = parseJsonBlock(lastAssistantText);
  const finishedAt = new Date().toISOString();
  const promptHash = sha256(
    `${input.skill.bodyMarkdown}\n----\n${input.passage}\n----\n${input.userInstruction ?? ''}`,
  );

  const agentContext: AgentExecutionContext = {
    agentId: input.agentId,
    modelId: input.modelId,
    modelProvider: 'custom',
    promptTemplateId: input.skill.promptTemplateId,
    promptHash,
    inputSkillIds: [input.skill.skillId],
    temperature: input.temperature ?? 0,
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
  };

  return {
    proposalRationale:
      proposal?.proposalRationale ??
      'custom-http runner produced no parseable JSON proposal',
    revisedFragments: proposal?.revisedFragments ?? [],
    uncertainties:
      proposal?.uncertainties ?? (proposal ? [] : ['runner-no-json-block']),
    toolCalls,
    agentContext,
    startedAt,
    finishedAt,
  };
}

// ---------- Helpers ----------

interface ProvenanceToolCall {
  toolName: string;
  mcpServerId: string;
  argumentsHash: string;
  resultSummary: string;
  succeeded: boolean;
  durationMs: number;
}

function parseJsonBlock(text: string): {
  proposalRationale: string;
  revisedFragments: AgentProposal['revisedFragments'];
  uncertainties: string[];
} | null {
  const m = text.match(/```json\s*\n([\s\S]*?)\n```/);
  const jsonText = m ? (m[1] ?? '') : text.trim();
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'proposalRationale' in parsed &&
      'revisedFragments' in parsed
    ) {
      return parsed as {
        proposalRationale: string;
        revisedFragments: AgentProposal['revisedFragments'];
        uncertainties: string[];
      };
    }
    return null;
  } catch {
    return null;
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
