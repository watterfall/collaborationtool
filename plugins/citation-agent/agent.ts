// Citation Agent — first dogfood reference impl of the ADR-0010 plugin
// API. The host (apps/web /api/agent/invoke or test harness) does:
//
//   1. capability check (`agent.invoke:citation`)
//   2. loadSkill('citation-lookup') from skills root
//   3. buildMcpServerSet from manifest.allowedMcpServers ∩ mcp_server table
//   4. resolve a ModelProvider via ADR-0013 §2.4 lookup precedence
//      (document override > user pref > manifest hint > env default)
//   5. call this module's runAgent(input)
//   6. persistProposal(...) on the returned AgentProposal
//   7. mcp.closeAll()
//
// Phase 4 W7.2 (ADR-0013 §2.5 真兑现): plugin no longer branches on
// `input.anthropic`. Whatever wire format the user picked, the resolved
// `input.provider.runAgent(...)` produces an AgentProposal. CI / air-
// gapped dev gets a deterministic mock provider injected by the host.
//
// ADR-0010 §2.7 step 4 ("no internal-only API") still holds: whatever
// this plugin imports from @collaborationtool/ai-runtime is what 3rd-
// party plugins also import — there is no separate "trusted" surface.

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

/** Module entry — see AgentPluginModule contract. */
export async function runAgent(
  input: AgentPluginInput,
): Promise<AgentProposal> {
  const systemPrompt = await loadPrompt();

  // Hint protocol: citation skill consumes `flaggedDoiCandidates: string[]`.
  // Other keys silently ignored (forward-compat per AgentPluginInput).
  //
  // Phase 4 W6.3 — `mode: 'doi-direct'` (with a `doi` hint) is the
  // user-typed-DOI sub-flow (chip-citation-doi + paste handler in the
  // editor). The plugin narrows the candidate set to that single DOI so
  // the runner goes straight to CrossRef MCP `lookup_doi` instead of
  // trying to extract DOI candidates from `passage`. Without `doi-direct`,
  // the legacy "passage analyse" path runs (host already crawled the
  // selection — Phase 4 W7.x will add an LLM-driven extraction step).
  const hints: Record<string, unknown> = {};
  const mode = input.hints['mode'];
  const directDoi = input.hints['doi'];
  if (
    mode === 'doi-direct' &&
    typeof directDoi === 'string' &&
    directDoi.trim().length > 0
  ) {
    hints['flaggedDoiCandidates'] = [directDoi.trim()];
    // Forward mode for downstream provenance / observability hooks
    // (mock provider ignores; real Anthropic prompt template can branch).
    hints['mode'] = 'doi-direct';
  } else {
    const raw = input.hints['flaggedDoiCandidates'];
    if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) {
      hints['flaggedDoiCandidates'] = raw as string[];
    }
  }

  return input.provider.runAgent({
    modelId: input.modelId,
    systemPrompt,
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
