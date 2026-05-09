// runMockAgent — exercises the citation tool loop + the inline-editor
// no-tool path against the real (in-process) crossref-mock MCP server.
// No network, no API key, no PG.

import assert from 'node:assert/strict';
import { describe, it, after, before } from 'node:test';
import path from 'node:path';

import { buildMcpServerSet, type McpServerSet } from '../src/mcp-client';
import { runMockAgent } from '../src/agent-runner';
import { loadSkill, _resetSkillCache } from '../src/skills-loader';
import { crossrefMockTransport } from '../src/transports';

const SKILLS_ROOT = path.resolve(process.cwd(), '..', '..', 'skills');

describe('runMockAgent', () => {
  let mcp: McpServerSet;
  before(async () => {
    _resetSkillCache();
    mcp = await buildMcpServerSet([
      {
        id: 'crossref-mock',
        buildTransport: crossrefMockTransport().buildTransport,
      },
    ]);
  });
  after(async () => {
    await mcp.closeAll();
  });

  it('citation: looks up valid DOI and emits a revisedFragment', async () => {
    const skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
    const proposal = await runMockAgent({
      shape: 'citation',
      skill,
      mcp,
      passage: 'See DOI 10.1145/3531146.3533104 for the foundation models survey.',
      hints: { flaggedDoiCandidates: ['10.1145/3531146.3533104'] },
      agentId: 'agent-citation-mock',
      actorPrincipalId: 'agent:agent-citation-mock',
    });

    assert.equal(proposal.revisedFragments.length, 1);
    const frag = proposal.revisedFragments[0]!;
    assert.match(frag.originalText, /^DOI/);
    assert.match(frag.replacementText, /^DOI/);
    assert.ok(frag.citationCslJson);
    assert.match(
      String(frag.citationCslJson?.['title'] ?? ''),
      /Foundation Models/,
    );

    assert.equal(proposal.toolCalls.length, 1);
    const t = proposal.toolCalls[0]!;
    assert.equal(t.toolName, 'lookup_doi');
    assert.equal(t.mcpServerId, 'crossref-mock');
    assert.match(t.argumentsHash, /^[0-9a-f]{64}$/);
    assert.equal(t.succeeded, true);
  });

  it('citation: retries with O→0 normalisation', async () => {
    const skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
    // arXiv DOI in the mock fixtures is .06770; we feed it with capital O.
    const proposal = await runMockAgent({
      shape: 'citation',
      skill,
      mcp,
      passage: 'See 10.48550/arXiv.2310.O6770',
      hints: { flaggedDoiCandidates: ['10.48550/arXiv.2310.O6770'] },
      agentId: 'agent-citation-mock',
      actorPrincipalId: 'agent:agent-citation-mock',
    });
    assert.equal(proposal.toolCalls.length, 2); // try, retry
    assert.equal(proposal.revisedFragments.length, 1);
    assert.match(
      proposal.revisedFragments[0]!.replacementText,
      /\.06770/,
    );
  });

  it('citation: unfindable DOI lands in uncertainties', async () => {
    const skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
    const proposal = await runMockAgent({
      shape: 'citation',
      skill,
      mcp,
      passage: 'See 10.9999/unknown.2024',
      hints: { flaggedDoiCandidates: ['10.9999/unknown.2024'] },
      agentId: 'agent-citation-mock',
      actorPrincipalId: 'agent:agent-citation-mock',
    });
    assert.equal(proposal.revisedFragments.length, 0);
    assert.ok(proposal.uncertainties.length >= 1);
    assert.match(proposal.uncertainties[0]!, /10\.9999/);
  });

  it('agentContext.modelId = mock:no-llm + promptTemplateId from skill', async () => {
    const skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
    const proposal = await runMockAgent({
      shape: 'citation',
      skill,
      mcp,
      passage: 'plain',
      hints: { flaggedDoiCandidates: [] },
      agentId: 'a-test',
      actorPrincipalId: 'agent:a-test',
    });
    assert.equal(proposal.agentContext.modelId, 'mock:no-llm');
    assert.equal(proposal.agentContext.modelProvider, 'local-ollama');
    assert.equal(proposal.agentContext.promptTemplateId, skill.promptTemplateId);
    assert.deepEqual(proposal.agentContext.inputSkillIds, [skill.skillId]);
    assert.match(proposal.agentContext.promptHash, /^[0-9a-f]{64}$/);
  });

  it('inline-editor: emits a single [FORMAL]-prefixed proposal, no tool calls', async () => {
    const skill = await loadSkill(SKILLS_ROOT, 'inline-editor');
    const proposal = await runMockAgent({
      shape: 'inline-editor',
      skill,
      mcp,
      passage: '我们用 GPT 写论文。',
      userInstruction: 'make this more formal',
      agentId: 'a-editor',
      actorPrincipalId: 'agent:a-editor',
    });
    assert.equal(proposal.toolCalls.length, 0);
    assert.equal(proposal.revisedFragments.length, 1);
    assert.match(proposal.revisedFragments[0]!.replacementText, /^\[FORMAL\] /);
  });
});
