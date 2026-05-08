// No-API-key fallback runner. Uses MCP tools deterministically to
// reproduce what a real agent would emit for the demo passage.
// Verifies the entire pipeline (skill load → MCP tool round-trip → Provenance
// commit) without depending on a paid API.

import { createHash } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import type {
  AgentExecutionContext,
  ToolCallRecord,
} from '@collaborationtool/schema';
import type { McpClientHandle } from './mcp-bridge';
import type { SkillMeta } from './load-skill';
import type { AgentProposal, InputPassage, ProposedRevisedFragment } from './types';

export interface MockRunnerInput {
  passage: InputPassage;
  skill: SkillMeta;
  bridge: McpClientHandle;
}

export async function runWithMock(input: MockRunnerInput): Promise<AgentProposal> {
  const { passage, skill, bridge } = input;
  const toolCalls: ToolCallRecord[] = [];
  const revisedFragments: ProposedRevisedFragment[] = [];
  const uncertainties: string[] = [];

  for (const candidate of passage.flaggedDoiCandidates) {
    const candidatesToTry = [candidate, normalizeOForZero(candidate)].filter(
      (v, i, arr) => arr.indexOf(v) === i
    );

    let foundRecord: Record<string, unknown> | null = null;
    let triedDoi = candidate;

    for (const doi of candidatesToTry) {
      const argHash = createHash('sha256')
        .update(JSON.stringify({ doi }))
        .digest('hex');
      const result = await bridge.callTool('lookup_doi', { doi });
      const summary = truncate(result.text, 200);
      toolCalls.push({
        toolName: 'lookup_doi',
        mcpServerId: 'crossref-mock',
        argumentsHash: argHash,
        resultSummary: summary,
        succeeded: result.succeeded,
        durationMs: result.durationMs,
      });

      const parsed = safeJson(result.text);
      if (parsed && typeof parsed === 'object' && !('error' in parsed)) {
        foundRecord = parsed as Record<string, unknown>;
        triedDoi = doi;
        break;
      }
    }

    if (foundRecord) {
      const citationId = 'cite:' + uuidv7();
      const recordDoi = String(foundRecord['DOI'] ?? triedDoi);
      revisedFragments.push({
        originalText: `DOI ${candidate}`,
        replacementText: `DOI ${recordDoi}`,
        citationId,
        citationCslJson: foundRecord,
      });
    } else {
      uncertainties.push(
        `Could not verify DOI '${candidate}'; left as-is for human review.`
      );
    }
  }

  const promptHash = createHash('sha256')
    .update(skill.bodyMarkdown)
    .update('\n----\n')
    .update(passage.prose)
    .digest('hex');

  const agentContext: AgentExecutionContext = {
    agentId: 'agent-citation-demo-mock',
    modelId: 'mock:no-llm',
    modelProvider: 'local-ollama',
    promptTemplateId: skill.skillId + '@' + skill.promptHash.slice(0, 12),
    promptHash,
    inputSkillIds: [skill.skillId],
    temperature: 0,
  };

  const proposalRationale = revisedFragments.length
    ? `Verified ${revisedFragments.length}/${passage.flaggedDoiCandidates.length} DOI(s) via crossref-mock; replaced original markers with canonical DOIs and attached CSL-JSON. ${uncertainties.length} flagged for human review.`
    : `No DOIs could be verified against crossref-mock; all ${passage.flaggedDoiCandidates.length} flagged for human review.`;

  return {
    proposalRationale,
    revisedFragments,
    uncertainties,
    toolCalls,
    agentContext,
  };
}

function normalizeOForZero(doi: string): string {
  // Common typo: capital letter O substituted for digit 0.
  // Only applies inside the DOI suffix (after the '/').
  const idx = doi.indexOf('/');
  if (idx === -1) return doi;
  const prefix = doi.slice(0, idx + 1);
  const suffix = doi.slice(idx + 1).replace(/O/g, '0');
  return prefix + suffix;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}
