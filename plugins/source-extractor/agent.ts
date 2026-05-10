// Source Extractor (Phase 3 W2) — AI ingestion agent per essay §6.2 +
// ADR-0011. Reads a source's raw_text + emits candidate claim /
// evidence / question records into source_extraction (staging table)
// for user review in the Source Reader UI.
//
// Phase 4 W7.2 (ADR-0013 §2.5 真兑现): plugin uses input.provider
// uniformly. The host injects either a real provider (resolved per
// ADR-0013 §2.4 lookup precedence) or a mock provider keyed by
// manifest.kind='custom' → shape='source-extractor'.
//
// Hint protocol:
//   - hints.sourceId: string (required) — the source to extract from
//   - hints.maxExtractions?: number (default 30)
//   - hints.windowOffset?: number — for paginated re-runs on long
//                                    sources

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

  const sourceIdRaw = input.hints['sourceId'];
  const sourceId = typeof sourceIdRaw === 'string' ? sourceIdRaw : '';
  if (!sourceId) {
    throw new Error(
      'source-extractor: hints.sourceId is required (non-empty string)',
    );
  }

  return input.provider.runAgent({
    modelId: input.modelId,
    systemPrompt,
    skill: input.skill,
    mcp: input.mcp,
    passage: input.passage, // host passes source.raw_text here
    hints: input.hints,
    maxIterations: 4, // single-shot extraction; tool loop limited
    maxTokens: 8192,
    agentId: input.agentId,
    actorPrincipalId: input.principalContext.principalId,
  });
}

const _module: AgentPluginModule = { runAgent };
export default _module;
