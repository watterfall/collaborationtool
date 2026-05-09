// Inline Editor Agent — applies a user-supplied rewrite instruction to
// a single passage. Phase 1 simplification (per ADR-0002 §2.2 role 4):
// strictly propose-mode, no tool calls beyond the LLM itself.

import path from 'node:path';

import Anthropic from '@anthropic-ai/sdk';

import type { DbExecutor } from '@collaborationtool/drizzle';
import { requireCapability, type PrincipalContext } from '@collaborationtool/permissions';

import {
  runAnthropicAgent,
  runMockAgent,
  type AnthropicRunnerInput,
} from '../agent-runner';
import { buildMcpServerSet } from '../mcp-client';
import { loadSkill } from '../skills-loader';
import {
  persistProposal,
  type PersistProposalResult,
} from '../provenance-writer';
import type { AgentProposal } from '../types';

export interface InvokeInlineEditorAgentInput {
  principalContext: PrincipalContext;
  documentId: string;
  blockId: string;
  passage: string;
  /** What the user asked for ("make this more formal"). */
  userInstruction: string;
  skillsRoot?: string;
  agentId?: string;
  anthropic?: Anthropic | null;
  modelId?: string;
}

export interface InvokeInlineEditorAgentOptions {
  persistToDb?: boolean;
  db?: DbExecutor;
}

export interface InvokeInlineEditorAgentResult {
  proposal: AgentProposal;
  persisted?: PersistProposalResult;
}

const INLINE_EDITOR_SYSTEM_PROMPT = `\
You are the Inline Editor Agent. Your job is to rewrite a single
passage according to the user's instruction without changing its
meaning, citations, or structural elements.

Behavior:
- Preserve every existing citation reference, equation, and footnote
  marker verbatim. NEVER drop a citation.
- Stay within the original paragraph boundaries — output one rewrite
  per input fragment.
- Surface any ambiguity in the user instruction in 'uncertainties'.
- NEVER call tools — your single output is the rewrite.

Output contract: emit a single fenced \`\`\`json\`\`\` block with
{
  "proposalRationale": string (≤ 200 chars),
  "revisedFragments": [{ "originalText": string, "replacementText": string }],
  "uncertainties": string[]
}
`;

const DEFAULT_AGENT_ID = '00000000-0000-7000-8000-00000000b001';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export async function invokeInlineEditorAgent(
  input: InvokeInlineEditorAgentInput,
  options: InvokeInlineEditorAgentOptions = {},
): Promise<InvokeInlineEditorAgentResult> {
  requireCapability(input.principalContext, {
    verb: 'agent.invoke:editor',
    resourceType: 'document',
    resourceId: input.documentId,
  });

  const skillsRoot = input.skillsRoot ?? path.resolve(process.cwd(), 'skills');
  const skill = await loadSkill(skillsRoot, 'inline-editor');

  // Inline editor needs no MCP tools (Phase 1). Empty server set still
  // satisfies the runner's signature.
  const mcp = await buildMcpServerSet([]);

  try {
    const agentId = input.agentId ?? DEFAULT_AGENT_ID;
    const actorPrincipalId = input.principalContext.principalId;

    const proposal = input.anthropic
      ? await runAnthropicAgent({
          client: input.anthropic,
          modelId: input.modelId ?? DEFAULT_MODEL,
          systemPrompt: INLINE_EDITOR_SYSTEM_PROMPT,
          skill,
          mcp,
          passage: input.passage,
          userInstruction: input.userInstruction,
          agentId,
          actorPrincipalId,
        } satisfies AnthropicRunnerInput)
      : await runMockAgent({
          shape: 'inline-editor',
          skill,
          mcp,
          passage: input.passage,
          userInstruction: input.userInstruction,
          agentId,
          actorPrincipalId,
        });

    let persisted: PersistProposalResult | undefined;
    if (options.persistToDb !== false) {
      if (!options.db) {
        throw new Error(
          'invokeInlineEditorAgent: persistToDb=true (default) requires options.db',
        );
      }
      persisted = await persistProposal(options.db, {
        proposal,
        skill,
        documentId: input.documentId,
      });
    }

    const out: InvokeInlineEditorAgentResult = { proposal };
    if (persisted) out.persisted = persisted;
    return out;
  } finally {
    await mcp.closeAll();
  }
}
