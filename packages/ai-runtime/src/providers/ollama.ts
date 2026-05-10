// Ollama ModelProvider adapter (Phase 3 W7 closeout, ADR-0013).
//
// Targets a local Ollama daemon at http://localhost:11434 (default) via
// /api/chat. Tool use uses Ollama's native function-calling shape
// introduced in Ollama 0.3+ — older versions return only text content
// with no tool_calls (the runner falls back to a no-tools path).
//
// Ollama wire-format diffs vs OpenAI:
//   - System prompt: separate role 'system' message at start of messages[]
//   - Tools: similar `function` shape but parameters JSON schema is
//            slightly stricter (no oneOf/anyOf at top level)
//   - Tool calls: response.message.tool_calls[] (single message, not choices[])
//   - Streaming: { stream: false } default (single response)
//   - Auth: typically no auth (LAN); api_key passed as Bearer if set
//           (e.g. Ollama with reverse proxy)

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

const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

const DEFAULT_FEATURES: ProviderFeatures = {
  toolUse: true,
  streaming: false, // disabled in adapter; tool-use loop needs full responses
  systemPrompt: true,
  jsonMode: true,
  visionInput: true, // llava / bakllava etc. but model-specific
  approxContextTokens: 8_000, // conservative; varies by model
};

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
  /** Ollama doesn't use tool_call_id; we pass a name-tagged tool result */
  name?: string;
}

interface OllamaChatResponse {
  message?: OllamaMessage;
  done: boolean;
  done_reason?: string;
}

export interface OllamaProviderOptions {
  features?: Partial<ProviderFeatures>;
  fetchImpl?: typeof fetch;
}

export function createOllamaProvider(
  config: ProviderConfig,
  options: OllamaProviderOptions = {},
): ModelProvider {
  const features: ProviderFeatures = {
    ...DEFAULT_FEATURES,
    ...(options.features ?? {}),
  };
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpointUrl = config.endpointUrl ?? DEFAULT_OLLAMA_ENDPOINT;

  return {
    id: config.id,
    label: config.label ?? 'Ollama (local)',
    wireFormat: 'ollama',
    features,
    async runAgent(input: ProviderRunInput): Promise<AgentProposal> {
      return runOllama({
        config: { ...config, endpointUrl },
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

async function runOllama(env: DispatchEnv): Promise<AgentProposal> {
  const { config, fetchImpl, features, input } = env;
  const startedAt = new Date().toISOString();
  const toolCalls: ProvenanceToolCall[] = [];

  const tools = features.toolUse
    ? input.mcp.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema as Record<string, unknown>,
        },
      }))
    : [];

  const messages: OllamaMessage[] = [
    { role: 'system', content: input.systemPrompt },
    { role: 'user', content: composeUserMessage(input) },
  ];

  const maxIterations = input.maxIterations ?? 6;
  let lastAssistantText = '';

  for (let iter = 0; iter < maxIterations; iter++) {
    const body = {
      model: input.modelId,
      messages,
      ...(tools.length > 0 ? { tools } : {}),
      stream: false,
      options: {
        temperature: input.temperature ?? 0,
        ...(input.maxTokens !== undefined
          ? { num_predict: input.maxTokens }
          : {}),
      },
    };

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(config.headers ?? {}),
    };
    if (config.apiKey) {
      headers.authorization = `Bearer ${config.apiKey}`;
    }

    const url = joinUrl(config.endpointUrl!, 'api/chat');
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
        `ollama fetch failed: ${(err as Error).message}`,
      );
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '<unreadable>');
      // Ollama 404 = model not pulled yet
      throw new ProviderError(
        response.status === 404 ? 'config-invalid' : 'unknown',
        `ollama ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as OllamaChatResponse;
    const msg = data.message;
    if (!msg) {
      throw new ProviderError(
        'tool-protocol-mismatch',
        'ollama: empty message in response',
      );
    }
    lastAssistantText = msg.content;
    const requestedTools = msg.tool_calls ?? [];

    if (requestedTools.length === 0) {
      messages.push({ role: 'assistant', content: msg.content });
      break;
    }

    messages.push({
      role: 'assistant',
      content: msg.content,
      tool_calls: requestedTools,
    });

    for (const tc of requestedTools) {
      const server = input.mcp.resolve(tc.function.name);
      const argsJson = JSON.stringify(tc.function.arguments ?? {});
      const argHash = sha256(argsJson);
      if (!server) {
        messages.push({
          role: 'tool',
          name: tc.function.name,
          content: JSON.stringify({
            error: 'unknown_tool',
            name: tc.function.name,
          }),
        });
        continue;
      }
      const outcome = await server.callTool(
        tc.function.name,
        tc.function.arguments ?? {},
      );
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
        name: tc.function.name,
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
    modelProvider: 'local-ollama',
    promptTemplateId: input.skill.promptTemplateId,
    promptHash,
    inputSkillIds: [input.skill.skillId],
    temperature: input.temperature ?? 0,
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
  };

  return {
    proposalRationale:
      proposal?.proposalRationale ??
      'ollama runner produced no parseable JSON proposal',
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
