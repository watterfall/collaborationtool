// Inline Editor Agent — second dogfood reference impl of the ADR-0010
// plugin API (after citation-agent at W2-W3). Per ADR-0010 review log
// W4-W5 follow-up: extracts the hardcoded `agents/inline-editor.ts` so
// /api/agent/invoke for both `kind=citation` and `kind=editor` go
// through `invokeAgentViaPlugin` uniformly.
//
// The host does:
//   1. capability check (`agent.invoke:editor`)
//   2. loadSkill('inline-editor') from skills root
//   3. buildMcpServerSet([]) — inline-editor needs no MCP tools
//   4. resolve a ModelProvider via ADR-0013 §2.4 lookup precedence
//   5. call this module's runAgent(input)
//   6. persistProposal(...)
//   7. mcp.closeAll()
//
// Phase 4 W7.2 (ADR-0013 §2.5 真兑现): plugin no longer branches on
// `input.anthropic`. `input.provider.runAgent(...)` is uniform across
// all 4 wire formats; CI / air-gapped dev gets a mock provider.
//
// hint protocol: this plugin consumes `userInstruction: string`. Other
// keys silently ignored (forward-compat per AgentPluginInput).

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type AgentPluginInput,
  type AgentPluginModule,
  type AgentProposal,
} from '@collaborationtool/ai-runtime';

const PROMPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'prompt.md',
);

let cachedPrompt: string | null = null;

async function loadPrompt(): Promise<string> {
  if (cachedPrompt !== null) return cachedPrompt;
  cachedPrompt = await readFile(PROMPT_PATH, 'utf8');
  return cachedPrompt;
}

export async function runAgent(
  input: AgentPluginInput,
): Promise<AgentProposal> {
  const systemPrompt = await loadPrompt();

  const raw = input.hints['userInstruction'];
  const userInstruction = typeof raw === 'string' ? raw : '';
  if (!userInstruction.trim()) {
    throw new Error(
      'inline-editor-agent: hints.userInstruction is required (non-empty string)',
    );
  }

  return input.provider.runAgent({
    modelId: input.modelId,
    systemPrompt,
    skill: input.skill,
    mcp: input.mcp,
    passage: input.passage,
    hints: input.hints,
    userInstruction,
    agentId: input.agentId,
    actorPrincipalId: input.principalContext.principalId,
  });
}

const _module: AgentPluginModule = { runAgent };
export default _module;
