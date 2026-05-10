// Reviewer Agent (Phase 2.5) — long-horizon async reviewer per ADR-0008.
// Runs inside apps/agent-worker via pgboss; not invoked synchronously
// from /api/agent/invoke (use POST /api/document/<id>/agent-job
// instead — that route lands in Phase 2.5 commit 6).
//
// Hint protocol: this plugin consumes
//   - hints.focusBlockIds?: string[] — when set, restrict review to
//                                       these block ids only
// Other keys silently ignored (forward-compat).

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runAnthropicAgent,
  runMockAgent,
  type AgentPluginInput,
  type AgentPluginModule,
  type AnthropicRunnerInput,
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

  if (input.anthropic) {
    return runAnthropicAgent({
      client: input.anthropic,
      modelId: input.modelId,
      systemPrompt,
      skill: input.skill,
      mcp: input.mcp,
      passage: input.passage,
      // Long-horizon: allow more tool-call iterations.
      maxIterations: 16,
      maxTokens: 8192,
      agentId: input.agentId,
      actorPrincipalId: input.principalContext.principalId,
    } satisfies AnthropicRunnerInput);
  }

  return runMockAgent({
    shape: 'reviewer',
    skill: input.skill,
    mcp: input.mcp,
    passage: input.passage,
    agentId: input.agentId,
    actorPrincipalId: input.principalContext.principalId,
  });
}

const _module: AgentPluginModule = { runAgent };
export default _module;
