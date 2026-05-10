// Researcher Agent (Phase 2.5) — long-horizon source-search per ADR-0008
// + ADR-0011 (proposes new evidence bindings to existing claims). Runs
// inside apps/agent-worker via pgboss; not invoked from synchronous
// /api/agent/invoke route (use POST /api/document/<id>/agent-job).
//
// Phase 4 W7.2 (ADR-0013 §2.5 真兑现): plugin uses input.provider
// uniformly. researcher prefers high-context anthropic (manifest
// `prefers_provider`); resolver respects user override.
//
// Hint protocol:
//   - hints.query: string — required, the research query
//   - hints.targetClaimIds?: string[] — optional, restrict evidence
//                                       binding to these claims

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

  const queryRaw = input.hints['query'];
  const query = typeof queryRaw === 'string' ? queryRaw : '';
  if (!query.trim()) {
    throw new Error(
      'researcher-agent: hints.query is required (non-empty string)',
    );
  }

  return input.provider.runAgent({
    modelId: input.modelId,
    systemPrompt,
    skill: input.skill,
    mcp: input.mcp,
    passage: input.passage,
    hints: input.hints,
    // The query is fed to the provider as a userInstruction equivalent.
    userInstruction: query,
    maxIterations: 20,
    maxTokens: 8192,
    agentId: input.agentId,
    actorPrincipalId: input.principalContext.principalId,
  });
}

const _module: AgentPluginModule = { runAgent };
export default _module;
