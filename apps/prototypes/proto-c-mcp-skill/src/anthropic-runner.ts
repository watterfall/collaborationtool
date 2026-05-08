// Real-API runner: invokes Claude with the skill body as system prompt and
// the MCP tools exposed as Anthropic tool specs. Loops on tool_use until
// the model emits a final JSON proposal.

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import type {
  AgentExecutionContext,
  ToolCallRecord,
} from '@collaborationtool/schema';
import type { McpClientHandle } from './mcp-bridge';
import type { SkillMeta } from './load-skill';
import type { AgentProposal, InputPassage } from './types';

export interface AnthropicRunnerInput {
  passage: InputPassage;
  skill: SkillMeta;
  bridge: McpClientHandle;
  modelId: string;        // e.g. 'claude-opus-4-7'
  maxIterations?: number; // default 4
}

export async function runWithAnthropic(input: AnthropicRunnerInput): Promise<AgentProposal> {
  const { passage, skill, bridge, modelId } = input;
  const maxIterations = input.maxIterations ?? 4;

  const client = new Anthropic();

  const systemPrompt = buildSystemPrompt(skill);
  const userPrompt = buildUserPrompt(passage);
  const tools = bridge.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }));

  const promptHash = createHash('sha256')
    .update(systemPrompt)
    .update('\n----\n')
    .update(userPrompt)
    .digest('hex');

  const toolCalls: ToolCallRecord[] = [];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  let finalText = '';
  for (let iter = 0; iter < maxIterations; iter++) {
    const resp = await client.messages.create({
      model: modelId,
      max_tokens: 1500,
      system: systemPrompt,
      tools,
      messages,
    });

    // Capture assistant message into history regardless of stop reason.
    messages.push({ role: 'assistant', content: resp.content });

    if (resp.stop_reason !== 'tool_use') {
      finalText = collectText(resp.content);
      break;
    }

    // Handle every tool_use block in this assistant turn.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== 'tool_use') continue;
      const argHash = createHash('sha256')
        .update(JSON.stringify(block.input))
        .digest('hex');
      const callResult = await bridge.callTool(
        block.name,
        block.input as Record<string, unknown>
      );
      toolCalls.push({
        toolName: block.name,
        mcpServerId:
          bridge.tools.find((t) => t.name === block.name)?.mcpServerId ?? 'unknown',
        argumentsHash: argHash,
        resultSummary: truncate(callResult.text, 200),
        succeeded: callResult.succeeded,
        durationMs: callResult.durationMs,
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: callResult.text,
        is_error: !callResult.succeeded,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  const proposal = parseFinalJson(finalText);
  const agentContext: AgentExecutionContext = {
    agentId: 'agent-citation-demo',
    modelId,
    modelProvider: 'anthropic',
    promptTemplateId: skill.skillId + '@' + skill.promptHash.slice(0, 12),
    promptHash,
    inputSkillIds: [skill.skillId],
    temperature: 0,
    maxTokens: 1500,
  };

  return {
    proposalRationale: proposal.proposalRationale,
    revisedFragments: proposal.revisedFragments,
    uncertainties: proposal.uncertainties,
    toolCalls,
    agentContext,
  };
}

function buildSystemPrompt(skill: SkillMeta): string {
  return [
    `You are the citation-lookup agent. The complete skill instructions follow:`,
    skill.bodyMarkdown.trim(),
    ``,
    `Important: when you have collected all the information you need, finish your turn`,
    `with a SINGLE final JSON object that conforms exactly to:`,
    `{`,
    `  "proposalRationale": string,`,
    `  "revisedFragments": Array<{`,
    `    "originalText": string,`,
    `    "replacementText": string,`,
    `    "citationId": string,`,
    `    "citationCslJson": object`,
    `  }>,`,
    `  "uncertainties": string[]`,
    `}`,
    `Output the JSON inside a fenced code block tagged json. No prose around it.`,
  ].join('\n');
}

function buildUserPrompt(passage: InputPassage): string {
  return [
    `Document id: ${passage.documentId}`,
    `Block id: ${passage.blockId}`,
    ``,
    `Passage to analyze:`,
    `"""`,
    passage.prose,
    `"""`,
    ``,
    `Flagged DOI candidates from user selection:`,
    ...passage.flaggedDoiCandidates.map((d) => `- ${d}`),
  ].join('\n');
}

function collectText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function parseFinalJson(text: string): {
  proposalRationale: string;
  revisedFragments: Array<{
    originalText: string;
    replacementText: string;
    citationId: string;
    citationCslJson: Record<string, unknown>;
  }>;
  uncertainties: string[];
} {
  const fence = text.match(/```json\s*\n?([\s\S]*?)```/);
  const raw = fence ? (fence[1] as string) : text;
  try {
    const parsed = JSON.parse(raw) as {
      proposalRationale?: string;
      revisedFragments?: Array<{
        originalText: string;
        replacementText: string;
        citationId: string;
        citationCslJson: Record<string, unknown>;
      }>;
      uncertainties?: string[];
    };
    return {
      proposalRationale: parsed.proposalRationale ?? '',
      revisedFragments: parsed.revisedFragments ?? [],
      uncertainties: parsed.uncertainties ?? [],
    };
  } catch (err) {
    return {
      proposalRationale: `[parse error: ${(err as Error).message}]`,
      revisedFragments: [],
      uncertainties: ['agent did not emit valid final JSON'],
    };
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}
