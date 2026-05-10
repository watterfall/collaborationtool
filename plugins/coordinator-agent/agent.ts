// Coordinator Agent (Phase 3 W6 scaffold) — high-level dispatcher.
//
// This file is a SKELETON. Real LLM-driven dispatch logic lands in
// W6 末:
//   - parse current step's coordinator JSON output
//   - for sync handoffs: await invokeAgentViaPlugin recursively
//   - for async handoffs: insert agent_job rows + boss.send to child
//     queue; record parent_job_id linkage
//   - compose CoordinatorFinalReport when isFinal=true
//
// Phase 3 W6 commit (this file): the agent runs the resolved provider's
// `runAgent` with a STUB system prompt. The output won't actually
// dispatch; it'll just emit a JSON shape that the host can parse to
// construct CoordinatorDecision rows. W6 末 swaps this for a real
// multi-step dispatcher.
//
// Phase 4 W7.2 (ADR-0013 §2.5 真兑现): coordinator uses input.provider
// uniformly. ModelProvider receives the same ProviderRunInput regardless
// of wire format; mock provider injects a deterministic shape='reviewer'
// proposal for tests.

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

  // Hint protocol:
  //   - hints.goal: string (required; the user's NL goal)
  //   - hints.maxSteps?: number (default 6)
  //   - hints.allowedAgentKinds?: string[]
  const goalRaw = input.hints['goal'];
  const goal = typeof goalRaw === 'string' ? goalRaw : '';
  if (!goal.trim()) {
    throw new Error('coordinator-agent: hints.goal is required');
  }

  return input.provider.runAgent({
    modelId: input.modelId,
    systemPrompt,
    skill: input.skill,
    mcp: input.mcp,
    passage: input.passage,
    hints: input.hints,
    userInstruction: goal,
    maxIterations: 6, // 1 iteration ≈ 1 coordinator step
    maxTokens: 8192,
    agentId: input.agentId,
    actorPrincipalId: input.principalContext.principalId,
  });
}

const _module: AgentPluginModule = { runAgent };
export default _module;
