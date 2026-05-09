// Phase 2 W2 dogfood preparation (ADR-0010 §2.7 step 2).
//
// Equivalence harness: prove the plugin-loaded citation agent produces
// the SAME AgentProposal shape (proposalRationale, revisedFragments,
// uncertainties, toolCalls.toolName, toolCalls.succeeded) as the
// hardcoded `invokeCitationAgent` in packages/ai-runtime/src/agents/
// citation.ts.
//
// W3 末 dogfood gate replaces the hardcode caller in apps/web with
// the plugin path. This test is the first guarantee that the swap is
// safe — if it ever fails, ADR-0010 §2.7 step 4 says STOP, fix the
// API, don't proceed to W4.
//
// Note: timestamps + provenance ids will differ between runs and are
// excluded from comparison. We compare the proposal *content*.

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';

import { buildMcpServerSet, type McpServerSet } from '../src/mcp-client';
import { loadSkill, _resetSkillCache } from '../src/skills-loader';
import { crossrefMockTransport } from '../src/transports';
import { loadAgentPlugin } from '../src/plugins';
import type { AgentProposal } from '../src/types';
import {
  invokeCitationAgent,
  type InvokeCitationAgentInput,
} from '../src/agents/citation';
import type { Capability, PrincipalContext } from '@collaborationtool/permissions';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const SKILLS_ROOT = path.resolve(REPO_ROOT, 'skills');
const PLUGIN_ROOT = path.resolve(REPO_ROOT, 'plugins', 'citation-agent');

// Same passage / candidate as agent-runner-mock.test.ts so we know the
// crossref-mock will return the foundation-models record.
const PASSAGE =
  'See DOI 10.1145/3531146.3533104 for the foundation models survey.';
const FLAGGED = ['10.1145/3531146.3533104'];

const DOCUMENT_CAPS: ReadonlySet<Capability> = new Set<Capability>([
  'agent.invoke:citation',
  'block.read',
  'block.propose',
  'citation.read',
  'citation.create',
  'citation.update',
  'citation.bind',
]);

const PRINCIPAL: PrincipalContext = {
  principalId: 'user:test',
  documentCapabilities: DOCUMENT_CAPS,
  globalCapabilities: new Set<Capability>(),
};

const DOC_ID = '00000000-0000-7000-8000-00000000d001';
const BLOCK_ID = '00000000-0000-7000-8000-00000000b001';
const AGENT_ID = '00000000-0000-7000-8000-00000000a001';
const MODEL = 'claude-sonnet-4-6';

describe('citation agent — hardcode vs plugin equivalence', () => {
  let hardcodeMcp: McpServerSet;
  let pluginMcp: McpServerSet;

  before(async () => {
    _resetSkillCache();
    hardcodeMcp = await buildMcpServerSet([
      {
        id: 'crossref-mock',
        buildTransport: crossrefMockTransport().buildTransport,
      },
    ]);
    pluginMcp = await buildMcpServerSet([
      {
        id: 'crossref-mock',
        buildTransport: crossrefMockTransport().buildTransport,
      },
    ]);
  });

  after(async () => {
    await hardcodeMcp.closeAll();
    await pluginMcp.closeAll();
  });

  it('plugin runAgent produces a proposal matching the hardcoded path', async () => {
    // Hardcode path: invokeCitationAgent with persistToDb=false.
    const hardcodeResult = await invokeCitationAgent(
      {
        principalContext: PRINCIPAL,
        documentId: DOC_ID,
        blockId: BLOCK_ID,
        passage: PASSAGE,
        flaggedDoiCandidates: FLAGGED,
        skillsRoot: SKILLS_ROOT,
        agentId: AGENT_ID,
        anthropic: null, // mock runner
        modelId: MODEL,
      } satisfies InvokeCitationAgentInput,
      {
        persistToDb: false,
        crossrefMcp: {
          id: 'crossref-mock',
          buildTransport: crossrefMockTransport().buildTransport,
        },
      },
    );

    // Plugin path: load + invoke with pre-resolved deps (host-style).
    const loaded = await loadAgentPlugin(PLUGIN_ROOT);
    assert.equal(loaded.manifest.id, '@official/citation-agent');
    assert.equal(loaded.manifest.kind, 'citation');

    const skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
    const pluginProposal: AgentProposal = await loaded.module.runAgent({
      principalContext: PRINCIPAL,
      documentId: DOC_ID,
      blockId: BLOCK_ID,
      passage: PASSAGE,
      hints: { flaggedDoiCandidates: FLAGGED },
      skill,
      mcp: pluginMcp,
      anthropic: null,
      modelId: MODEL,
      agentId: AGENT_ID,
    });

    // Compare the *content* of the proposals. Timestamps + execution
    // ids differ by definition; everything else must match.
    assertProposalsEquivalent(hardcodeResult.proposal, pluginProposal);
  });
});

function assertProposalsEquivalent(a: AgentProposal, b: AgentProposal): void {
  assert.equal(
    a.proposalRationale,
    b.proposalRationale,
    'proposalRationale must match',
  );
  assert.equal(
    a.revisedFragments.length,
    b.revisedFragments.length,
    'revisedFragments length must match',
  );
  for (let i = 0; i < a.revisedFragments.length; i++) {
    const fa = a.revisedFragments[i]!;
    const fb = b.revisedFragments[i]!;
    assert.equal(fa.originalText, fb.originalText, `fragment[${i}].originalText`);
    assert.equal(fa.replacementText, fb.replacementText, `fragment[${i}].replacementText`);
    if (fa.citationId) {
      assert.equal(fa.citationId, fb.citationId, `fragment[${i}].citationId`);
    }
    if (fa.citationCslJson) {
      assert.deepEqual(
        fa.citationCslJson,
        fb.citationCslJson,
        `fragment[${i}].citationCslJson`,
      );
    }
  }
  assert.deepEqual(a.uncertainties, b.uncertainties, 'uncertainties');
  assert.equal(a.toolCalls.length, b.toolCalls.length, 'toolCalls length');
  for (let i = 0; i < a.toolCalls.length; i++) {
    const ta = a.toolCalls[i]!;
    const tb = b.toolCalls[i]!;
    assert.equal(ta.toolName, tb.toolName, `toolCalls[${i}].toolName`);
    assert.equal(
      ta.mcpServerId,
      tb.mcpServerId,
      `toolCalls[${i}].mcpServerId`,
    );
    assert.equal(ta.succeeded, tb.succeeded, `toolCalls[${i}].succeeded`);
    assert.equal(
      ta.argumentsHash,
      tb.argumentsHash,
      `toolCalls[${i}].argumentsHash`,
    );
  }

  // Skill identity must round-trip: both paths load the same SKILL.md
  // and therefore commit the same promptTemplateId for provenance.
  // (This is the property that lets W3 末 dogfood gate flip /api/agent/
  // invoke without diverging Provenance row contents.)
  assert.equal(
    a.agentContext.promptTemplateId,
    b.agentContext.promptTemplateId,
    'agentContext.promptTemplateId must match (skill round-trip)',
  );
}
