// Agent runner — real Anthropic API + deterministic mock fallback. Both
// implementations expose the same `runAgent` signature so the higher-
// level agents (citation / inline-editor) don't branch on transport.
//
// Mock mode is intentional Phase 1 infrastructure: it lets CI and
// air-gapped dev environments exercise the entire pipeline (skill load
// → MCP tool calls → Provenance write) without an Anthropic API key,
// and it gives us a deterministic baseline for assertions.

import { createHash } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentExecutionContext,
  ToolCallRecord,
} from '@collaborationtool/schema';

import type { McpServerSet } from './mcp-client';
import type { SkillMeta } from './skills-loader';
import type { AgentProposal, ProposedRevisedFragment } from './types';

export interface RunnerCommonInput {
  skill: SkillMeta;
  mcp: McpServerSet;
  /** Plain prose the agent will read. */
  passage: string;
  /** Optional structured hints — citation skill uses doi candidates. */
  hints?: { flaggedDoiCandidates?: string[] };
  /** Agent identifier. */
  agentId: string;
  /** Initiating principal — Provenance.actorPrincipalId. */
  actorPrincipalId: string;
  /** Optional human-supplied instruction (inline editor). */
  userInstruction?: string;
}

export interface AnthropicRunnerInput extends RunnerCommonInput {
  client: Anthropic;
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  /** System prompt — composed by the caller (agents/citation.ts etc.). */
  systemPrompt: string;
  /** Maximum tool-use iterations. Default 8. */
  maxIterations?: number;
}

export interface MockRunnerInput extends RunnerCommonInput {
  /** Deterministic logic per agent kind. Phase 2.5 added reviewer +
   * researcher; Phase 3 W2 adds source-extractor (AI ingestion). */
  shape:
    | 'citation'
    | 'inline-editor'
    | 'reviewer'
    | 'researcher'
    | 'source-extractor';
}

// ---------- Mock runner ----------

/**
 * Mock agent runner. No LLM calls. The shape determines which canned
 * proposal to emit:
 *   - 'citation': for each flagged DOI, call `lookup_doi` (with one
 *                 retry on common 'O→0' typo) and accumulate revisions
 *   - 'inline-editor': echo the passage with a "[FORMAL]" prefix.
 *                      Phase 2 mock can implement nicer rewrites.
 */
export async function runMockAgent(
  input: MockRunnerInput,
): Promise<AgentProposal> {
  const startedAt = new Date().toISOString();
  const toolCalls: ToolCallRecord[] = [];
  const revisedFragments: ProposedRevisedFragment[] = [];
  const uncertainties: string[] = [];

  if (input.shape === 'citation') {
    const candidates = input.hints?.flaggedDoiCandidates ?? [];
    for (const candidate of candidates) {
      const tries = uniq([candidate, normalizeOForZero(candidate)]);
      let found: Record<string, unknown> | null = null;
      let triedDoi = candidate;

      for (const doi of tries) {
        const argHash = sha256(JSON.stringify({ doi }));
        const server = input.mcp.resolve('lookup_doi');
        if (!server) {
          uncertainties.push(`No MCP server provides lookup_doi`);
          break;
        }
        const out = await server.callTool('lookup_doi', { doi });
        toolCalls.push({
          toolName: 'lookup_doi',
          mcpServerId: server.id,
          argumentsHash: argHash,
          resultSummary: truncate(out.text, 200),
          succeeded: out.succeeded,
          durationMs: out.durationMs,
        });
        const parsed = safeJson(out.text);
        if (parsed && typeof parsed === 'object' && !('error' in parsed)) {
          found = parsed as Record<string, unknown>;
          triedDoi = doi;
          break;
        }
      }

      if (found) {
        const recordDoi = String(found['DOI'] ?? triedDoi);
        revisedFragments.push({
          originalText: `DOI ${candidate}`,
          replacementText: `DOI ${recordDoi}`,
          citationId: `cite:${argHashShort(triedDoi)}`,
          citationCslJson: found,
        });
      } else {
        uncertainties.push(
          `Could not verify DOI '${candidate}'; left for human review.`,
        );
      }
    }
  } else if (input.shape === 'inline-editor') {
    // inline-editor mock: rewrap passage as a single proposed replacement
    revisedFragments.push({
      originalText: input.passage,
      replacementText: `[FORMAL] ${input.passage}`,
    });
  } else if (input.shape === 'reviewer') {
    // reviewer mock: emit one suggested revision + one uncertainty per
    // 200-char window; simulates a long-horizon scan without LLM.
    const windowSize = 200;
    for (let i = 0; i < input.passage.length; i += windowSize) {
      const slice = input.passage.slice(i, i + windowSize);
      if (slice.trim().length === 0) continue;
      revisedFragments.push({
        originalText: slice,
        replacementText: `[REVIEWED] ${slice}`,
      });
    }
    if (revisedFragments.length === 0) {
      uncertainties.push('Mock reviewer: passage too short to generate windows');
    }
  } else if (input.shape === 'researcher') {
    // researcher mock: parse `userInstruction` as the research query and
    // suggest 1-2 placeholder citations for the user to verify.
    const query = input.userInstruction ?? '(no query supplied)';
    revisedFragments.push({
      originalText: input.passage,
      replacementText: `${input.passage} [research:${query}]`,
    });
    uncertainties.push(
      `Mock researcher: real source-search requires Anthropic + MCP servers (crossref/arxiv/etc).`,
    );
  } else if (input.shape === 'source-extractor') {
    // source-extractor mock: deterministic pseudo-extraction. Splits the
    // passage on sentence punctuation and emits one fake claim per
    // sentence longer than 60 chars + one supporting evidence per
    // emitted claim. Real extraction needs an LLM (Anthropic /
    // OpenAI-compat); production swaps this branch for runAnthropicAgent
    // automatically when input.anthropic is provided.
    const sentences = input.passage
      .split(/(?<=[.!?。！？])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 60);
    for (const s of sentences.slice(0, 3)) {
      revisedFragments.push({
        originalText: s,
        replacementText: `[CLAIM] ${s.slice(0, 120)}`,
      });
    }
    if (revisedFragments.length === 0) {
      uncertainties.push(
        'Mock source-extractor: passage lacks long-enough sentences for extraction',
      );
    }
  }

  const finishedAt = new Date().toISOString();
  const promptHash = sha256(
    `${input.skill.bodyMarkdown}\n----\n${input.passage}\n----\n${input.userInstruction ?? ''}`,
  );

  const agentContext: AgentExecutionContext = {
    agentId: input.agentId,
    modelId: 'mock:no-llm',
    modelProvider: 'local-ollama',
    promptTemplateId: input.skill.promptTemplateId,
    promptHash,
    inputSkillIds: [input.skill.skillId],
    temperature: 0,
  };

  const proposalRationale =
    revisedFragments.length > 0
      ? `Mock ${input.shape} proposal with ${revisedFragments.length} fragment(s); ${uncertainties.length} flagged.`
      : `Mock ${input.shape} produced no fragments; ${uncertainties.length} flagged.`;

  return {
    proposalRationale,
    revisedFragments,
    uncertainties,
    toolCalls,
    agentContext,
    startedAt,
    finishedAt,
  };
}

// ---------- Anthropic runner ----------

/**
 * Drives the Anthropic tool-use loop until the model emits a final
 * assistant text containing a JSON proposal that matches the contract
 * declared in the skill body. Tool calls funnel through the MCP server
 * set; each call is recorded into the proposal's toolCalls[] with
 * argumentsHash + resultSummary + duration.
 *
 * Output contract: the LLM is expected to emit a fenced JSON block
 *
 *   ```json
 *   { "proposalRationale": ..., "revisedFragments": [...], "uncertainties": [...] }
 *   ```
 *
 * The runner extracts the FIRST JSON code block in the assistant's
 * final text; if the LLM emits free prose without a JSON block, the
 * runner returns an empty proposal with a uncertainty entry.
 */
export async function runAnthropicAgent(
  input: AnthropicRunnerInput,
): Promise<AgentProposal> {
  const startedAt = new Date().toISOString();
  const toolCalls: ToolCallRecord[] = [];

  // Convert MCP tools to Anthropic tool definitions.
  const toolDefs = input.mcp.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Record<string, unknown>,
  }));

  // Build the conversation. System prompt + initial user with passage.
  type ConversationMessage = Anthropic.MessageParam;
  const messages: ConversationMessage[] = [
    {
      role: 'user',
      content: composeInitialUserMessage(input),
    },
  ];

  const maxIterations = input.maxIterations ?? 8;
  let lastTextBlocks: Anthropic.TextBlock[] = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    const response = await input.client.messages.create({
      model: input.modelId,
      max_tokens: input.maxTokens ?? 4096,
      temperature: input.temperature ?? 0,
      system: input.systemPrompt,
      tools: toolDefs as never,
      messages,
    });

    lastTextBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
      break;
    }
    if (response.stop_reason !== 'tool_use') {
      // Unexpected stop reason; bail
      break;
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (toolUseBlocks.length === 0) break;

    // Record the assistant's full response in conversation history.
    messages.push({ role: 'assistant', content: response.content });

    // Execute every tool_use block via the MCP server set.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const server = input.mcp.resolve(block.name);
      if (!server) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: 'unknown_tool', name: block.name }),
          is_error: true,
        });
        continue;
      }
      const argsJson = JSON.stringify(block.input);
      const argHash = sha256(argsJson);
      const outcome = await server.callTool(
        block.name,
        block.input as Record<string, unknown>,
      );
      toolCalls.push({
        toolName: block.name,
        mcpServerId: server.id,
        argumentsHash: argHash,
        resultSummary: truncate(outcome.text, 200),
        succeeded: outcome.succeeded,
        durationMs: outcome.durationMs,
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: outcome.text,
        is_error: outcome.errored,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  const finalText = lastTextBlocks.map((b) => b.text).join('\n').trim();
  const proposal = parseJsonBlock(finalText);

  const finishedAt = new Date().toISOString();
  const promptHash = sha256(
    `${input.skill.bodyMarkdown}\n----\n${input.passage}\n----\n${input.userInstruction ?? ''}`,
  );

  const agentContext: AgentExecutionContext = {
    agentId: input.agentId,
    modelId: input.modelId,
    modelProvider: 'anthropic',
    promptTemplateId: input.skill.promptTemplateId,
    promptHash,
    inputSkillIds: [input.skill.skillId],
    temperature: input.temperature ?? 0,
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
  };

  return {
    proposalRationale:
      proposal?.proposalRationale ??
      'Anthropic runner produced no parseable JSON proposal; full text in the last_assistant_text trace.',
    revisedFragments: proposal?.revisedFragments ?? [],
    uncertainties:
      proposal?.uncertainties ??
      (proposal ? [] : ['runner-no-json-block']),
    toolCalls,
    agentContext,
    startedAt,
    finishedAt,
  };
}

// ---------- Helpers ----------

function composeInitialUserMessage(input: AnthropicRunnerInput): string {
  const lines = [
    'You are about to assist with a passage from a research paper.',
    '',
    `User instruction: ${input.userInstruction ?? '(none — follow the skill defaults)'}`,
    '',
    'Passage:',
    '"""',
    input.passage,
    '"""',
  ];
  if (input.hints?.flaggedDoiCandidates?.length) {
    lines.push(
      '',
      'Flagged DOI candidates to verify:',
      ...input.hints.flaggedDoiCandidates.map((d) => `- ${d}`),
    );
  }
  lines.push(
    '',
    'When done, emit a single fenced ```json``` block matching the contract',
    'declared in the skill. No prose outside the JSON block.',
  );
  return lines.join('\n');
}

function parseJsonBlock(text: string): {
  proposalRationale: string;
  revisedFragments: ProposedRevisedFragment[];
  uncertainties: string[];
} | null {
  const m = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) return null;
  const json = m[1] ?? '';
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'proposalRationale' in parsed &&
      'revisedFragments' in parsed
    ) {
      return parsed as {
        proposalRationale: string;
        revisedFragments: ProposedRevisedFragment[];
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

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeOForZero(doi: string): string {
  const idx = doi.indexOf('/');
  if (idx === -1) return doi;
  const prefix = doi.slice(0, idx + 1);
  const suffix = doi.slice(idx + 1).replace(/O/g, '0');
  return prefix + suffix;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function argHashShort(s: string): string {
  return sha256(s).slice(0, 12);
}
