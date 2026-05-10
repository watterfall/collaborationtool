// OpenAI-compat ModelProvider adapter (Phase 3 W7 closeout, ADR-0013).
//
// Targets any OpenAI-compatible /v1/chat/completions endpoint:
// vLLM, llama.cpp server, OpenRouter, Together, DeepSeek, Mistral
// la Plateforme, etc. Tool use uses the OpenAI function-calling shape
// (`tool_choice` + `tools[]`), translated to/from MCP descriptors by
// this adapter.
//
// Phase 3 closeout: this adapter ships as a working network client. We
// don't ship a full integration test against a live endpoint here —
// the Phase 3 W7 dogfood gate (ADR-0013 §2.6) requires testing
// against a real Ollama / vLLM instance once the user-facing settings
// page lands. Phase 4 wires that gate.
//
// Wire-format diffs vs Anthropic captured in adapter:
//   - System prompt: separate role: 'system' message (not a top-level field)
//   - Tools: `function` shape with parameters (JSON schema) instead of input_schema
//   - Tool calls: response.choices[0].message.tool_calls[]
//   - Tool results: role: 'tool' messages keyed by tool_call_id

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
  toolUse: true,
  streaming: true,
  systemPrompt: true,
  jsonMode: true,
  visionInput: false,
  approxContextTokens: 32_000,
};

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAIChatResponse {
  choices: Array<{
    message: OpenAIChatMessage;
    finish_reason: string | null;
  }>;
}

export interface OpenAICompatProviderOptions {
  /** Override default features (e.g. mark a model that lacks tool use). */
  features?: Partial<ProviderFeatures>;
  /** For tests: stub the underlying fetch implementation. */
  fetchImpl?: typeof fetch;
}

export function createOpenAICompatProvider(
  config: ProviderConfig,
  options: OpenAICompatProviderOptions = {},
): ModelProvider {
  if (!config.endpointUrl) {
    throw new ProviderError(
      'config-invalid',
      'openai-compat provider requires endpointUrl (e.g. https://api.openai.com/v1 or http://localhost:8000/v1)',
    );
  }
  // apiKey may be empty for self-hosted vLLM / llama.cpp; we still
  // send a Bearer header if present so OpenRouter etc. work.

  const features: ProviderFeatures = {
    ...DEFAULT_FEATURES,
    ...(options.features ?? {}),
  };
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: config.id,
    label: config.label ?? 'OpenAI-compat',
    wireFormat: 'openai-compat',
    features,
    async runAgent(input: ProviderRunInput): Promise<AgentProposal> {
      return runOpenAICompat({
        config,
        fetchImpl,
        features,
        input,
      });
    },
  };
}

interface DispatchEnv {
  config: ProviderConfig;
  fetchImpl: typeof fetch;
  features: ProviderFeatures;
  input: ProviderRunInput;
}

async function runOpenAICompat(env: DispatchEnv): Promise<AgentProposal> {
  const { config, fetchImpl, input } = env;
  const startedAt = new Date().toISOString();
  const toolCalls: ProvenanceToolCall[] = [];

  const tools = input.mcp.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as Record<string, unknown>,
    },
  }));

  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: input.systemPrompt },
    { role: 'user', content: composeUserMessage(input) },
  ];

  const maxIterations = input.maxIterations ?? 8;
  let lastAssistantText = '';

  for (let iter = 0; iter < maxIterations; iter++) {
    const body = {
      model: input.modelId,
      messages,
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {}),
      max_tokens: input.maxTokens ?? 4096,
      temperature: input.temperature ?? 0,
    };

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(config.headers ?? {}),
    };
    if (config.apiKey) {
      headers.authorization = `Bearer ${config.apiKey}`;
    }

    const url = joinUrl(config.endpointUrl!, 'chat/completions');
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ProviderError(
        'timeout',
        `openai-compat fetch failed: ${(err as Error).message}`,
      );
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '<unreadable>');
      throw new ProviderError(
        response.status === 401 || response.status === 403
          ? 'auth-failed'
          : response.status === 429
            ? 'rate-limited'
            : 'unknown',
        `openai-compat ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices?.[0];
    if (!choice) {
      throw new ProviderError(
        'tool-protocol-mismatch',
        'openai-compat: empty choices array',
      );
    }
    lastAssistantText = choice.message.content ?? '';
    const requestedTools = choice.message.tool_calls ?? [];

    if (requestedTools.length === 0) {
      // model finished
      messages.push({
        role: 'assistant',
        content: choice.message.content ?? '',
      });
      break;
    }

    // Record assistant tool-calling turn into history.
    messages.push({
      role: 'assistant',
      content: choice.message.content ?? '',
      tool_calls: requestedTools,
    });

    // Execute each tool through the MCP server set.
    for (const tc of requestedTools) {
      const server = input.mcp.resolve(tc.function.name);
      if (!server) {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({
            error: 'unknown_tool',
            name: tc.function.name,
          }),
        });
        continue;
      }
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(tc.function.arguments) as Record<
          string,
          unknown
        >;
      } catch {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: 'malformed_arguments' }),
        });
        continue;
      }
      const argHash = sha256(tc.function.arguments);
      const outcome = await server.callTool(tc.function.name, parsedArgs);
      toolCalls.push({
        toolName: tc.function.name,
        mcpServerId: server.id,
        argumentsHash: argHash,
        resultSummary: truncate(outcome.text, 200),
        succeeded: outcome.succeeded,
        durationMs: outcome.durationMs,
      });
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: outcome.text,
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
    modelProvider: 'openai',
    promptTemplateId: input.skill.promptTemplateId,
    promptHash,
    inputSkillIds: [input.skill.skillId],
    temperature: input.temperature ?? 0,
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
  };

  return {
    proposalRationale:
      proposal?.proposalRationale ??
      'openai-compat runner produced no parseable JSON proposal',
    revisedFragments: proposal?.revisedFragments ?? [],
    uncertainties:
      proposal?.uncertainties ?? (proposal ? [] : ['runner-no-json-block']),
    toolCalls,
    agentContext,
    startedAt,
    finishedAt,
  };
}

// ---------- Helpers (kept local to avoid circular import with agent-runner) ----------

interface ProvenanceToolCall {
  toolName: string;
  mcpServerId: string;
  argumentsHash: string;
  resultSummary: string;
  succeeded: boolean;
  durationMs: number;
}

function composeUserMessage(input: ProviderRunInput): string {
  const lines = [
    'You are about to assist with a passage from a research paper.',
    '',
    `User instruction: ${input.userInstruction ?? '(none — follow the skill defaults)'}`,
    '',
    'Passage:',
    '"""',
    input.passage,
    '"""',
    '',
    'When done, emit a single fenced ```json``` block matching the contract',
    'declared in the skill. No prose outside the JSON block.',
  ];
  return lines.join('\n');
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

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${b}/${p}`;
}
