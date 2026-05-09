// Citation Agent — first dogfood reference impl of the ADR-0010 plugin
// API. The host (apps/web /api/agent/invoke or test harness) does:
//
//   1. capability check (`agent.invoke:citation`)
//   2. loadSkill('citation-lookup') from skills root
//   3. buildMcpServerSet from manifest.allowedMcpServers ∩ mcp_server table
//   4. resolve Anthropic client + model from env
//   5. call this module's runAgent(input)
//   6. persistProposal(...) on the returned AgentProposal
//   7. mcp.closeAll()
//
// This module does ONLY the prompt + runner dispatch. ADR-0010 §2.7
// step 4 ("no internal-only API") means whatever this plugin imports
// from @collaborationtool/ai-runtime is what 3rd-party plugins also
// import — there is no separate "trusted" surface.

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

/** Module entry — see AgentPluginModule contract. */
export async function runAgent(
  input: AgentPluginInput,
): Promise<AgentProposal> {
  const systemPrompt = await loadPrompt();

  // Hint protocol: citation skill consumes `flaggedDoiCandidates: string[]`.
  // Other keys silently ignored (forward-compat per AgentPluginInput).
  const hints: { flaggedDoiCandidates?: string[] } = {};
  const raw = input.hints['flaggedDoiCandidates'];
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) {
    hints.flaggedDoiCandidates = raw as string[];
  }

  if (input.anthropic) {
    return runAnthropicAgent({
      client: input.anthropic,
      modelId: input.modelId,
      systemPrompt,
      skill: input.skill,
      mcp: input.mcp,
      passage: input.passage,
      hints,
      agentId: input.agentId,
      actorPrincipalId: input.principalContext.principalId,
    } satisfies AnthropicRunnerInput);
  }

  return runMockAgent({
    shape: 'citation',
    skill: input.skill,
    mcp: input.mcp,
    passage: input.passage,
    hints,
    agentId: input.agentId,
    actorPrincipalId: input.principalContext.principalId,
  });
}

// Self-document the contract for static analysis tools / docs sites.
// (At runtime, the loader looks for `runAgent` directly; this assignment
// exists so a TS user can `import type { module } from './agent'`.)
const _module: AgentPluginModule = { runAgent };
export default _module;
