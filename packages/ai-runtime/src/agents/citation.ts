// Citation Agent — wraps the runner with skill loading, MCP server set,
// and the citation-specific system prompt. Per ADR-0002 §2.2 role 5
// (`citation-agent`) the agent's read scope is narrowed to citation-ref
// + ±2 surrounding paragraphs in Phase 3; Phase 1 connection-level
// rules apply (the gateway + capability check enforce.).

import path from 'node:path';

import Anthropic from '@anthropic-ai/sdk';

import type { DbExecutor } from '@collaborationtool/drizzle';
import { requireCapability, type PrincipalContext } from '@collaborationtool/permissions';

import {
  runAnthropicAgent,
  runMockAgent,
  type AnthropicRunnerInput,
} from '../agent-runner';
import { buildMcpServerSet, type McpServerSpec } from '../mcp-client';
import { loadSkill } from '../skills-loader';
import { persistProposal, type PersistProposalResult } from '../provenance-writer';
import { crossrefMockTransport } from '../transports';
import type { AgentProposal } from '../types';

export interface InvokeCitationAgentInput {
  /** Caller's identity + capabilities (from sync-gateway / web auth). */
  principalContext: PrincipalContext;
  /** Document the agent operates on. */
  documentId: string;
  /** Block under cursor. */
  blockId: string;
  /** Passage text (the user-selected fragment). */
  passage: string;
  /** Flagged DOI candidates from the editor selection. */
  flaggedDoiCandidates: string[];
  /** Override skills root (defaults to <repo>/skills). */
  skillsRoot?: string;
  /** Override agent identifier. */
  agentId?: string;
  /** Anthropic client when key is available; mock when null. */
  anthropic?: Anthropic | null;
  /** Phase 1 default: claude-sonnet-4-6. */
  modelId?: string;
}

export interface InvokeCitationAgentOptions {
  /** When true, persist the proposal to PG. Default true. */
  persistToDb?: boolean;
  /** DB executor — required when persistToDb=true. */
  db?: DbExecutor;
  /** Phase 1.5 plumbing: extra MCP servers (arxiv / semantic-scholar). */
  extraMcpServers?: McpServerSpec[];
}

export interface InvokeCitationAgentResult {
  proposal: AgentProposal;
  persisted?: PersistProposalResult;
}

const CITATION_SYSTEM_PROMPT = `\
You are the Citation Agent. Your job is to verify and complete academic
citation references in research-paper passages.

Behavior:
- ALWAYS use the lookup_doi tool for each candidate DOI.
- If a DOI is not found, retry once with common typo normalisation (capital O → digit 0 in the suffix).
- Never invent records.
- Stay strictly in propose-mode — emit a JSON proposal, not a final commit.

Output contract: emit a single fenced \`\`\`json\`\`\` block with
{
  "proposalRationale": string (≤ 200 chars),
  "revisedFragments": [{ "originalText", "replacementText", "citationId", "citationCslJson" }],
  "uncertainties": string[]
}
`;

const DEFAULT_AGENT_ID = '00000000-0000-7000-8000-00000000a001';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export async function invokeCitationAgent(
  input: InvokeCitationAgentInput,
  options: InvokeCitationAgentOptions = {},
): Promise<InvokeCitationAgentResult> {
  // Capability gate — Phase 1 D8 runtime enforcement, repeated here so
  // server-action callers (apps/web) don't have to remember.
  requireCapability(input.principalContext, {
    verb: 'agent.invoke:citation',
    resourceType: 'document',
    resourceId: input.documentId,
  });

  const skillsRoot = input.skillsRoot ?? path.resolve(process.cwd(), 'skills');
  const skill = await loadSkill(skillsRoot, 'citation-lookup');

  const mcp = await buildMcpServerSet([
    {
      id: 'crossref-mock',
      buildTransport: crossrefMockTransport().buildTransport,
    },
    ...(options.extraMcpServers ?? []),
  ]);

  try {
    const agentId = input.agentId ?? DEFAULT_AGENT_ID;
    const actorPrincipalId = input.principalContext.principalId;

    const proposal = input.anthropic
      ? await runAnthropicAgent({
          client: input.anthropic,
          modelId: input.modelId ?? DEFAULT_MODEL,
          systemPrompt: CITATION_SYSTEM_PROMPT,
          skill,
          mcp,
          passage: input.passage,
          hints: { flaggedDoiCandidates: input.flaggedDoiCandidates },
          agentId,
          actorPrincipalId,
        } satisfies AnthropicRunnerInput)
      : await runMockAgent({
          shape: 'citation',
          skill,
          mcp,
          passage: input.passage,
          hints: { flaggedDoiCandidates: input.flaggedDoiCandidates },
          agentId,
          actorPrincipalId,
        });

    let persisted: PersistProposalResult | undefined;
    if (options.persistToDb !== false) {
      if (!options.db) {
        throw new Error(
          'invokeCitationAgent: persistToDb=true (default) requires options.db',
        );
      }
      persisted = await persistProposal(options.db, {
        proposal,
        skill,
        documentId: input.documentId,
      });
    }

    const out: InvokeCitationAgentResult = { proposal };
    if (persisted) out.persisted = persisted;
    return out;
  } finally {
    await mcp.closeAll();
  }
}
