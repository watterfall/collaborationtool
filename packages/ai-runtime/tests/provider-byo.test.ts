// Phase 3 W7 closeout: ModelProvider adapters for OpenAI-compat,
// Ollama, and custom-http. These tests stub `fetch` so they don't
// touch a real LLM endpoint — the W7 dogfood gate (ADR-0013 §2.6)
// covers real-endpoint integration.
//
// What we verify:
//   - constructor argument validation (config-invalid path)
//   - happy path: single completion → JSON-block parse → AgentProposal
//   - tool-use loop: model emits tool_calls, adapter dispatches MCP,
//     feeds tool_result back, model emits final JSON

import assert from 'node:assert/strict';
import { describe, it, after, before } from 'node:test';
import path from 'node:path';

import { buildMcpServerSet, type McpServerSet } from '../src/mcp-client';
import {
  createCustomHttpProvider,
  createOllamaProvider,
  createOpenAICompatProvider,
  ProviderError,
  type ProviderRunInput,
} from '../src/providers';
import { loadSkill, _resetSkillCache, type SkillMeta } from '../src/skills-loader';
import { crossrefMockTransport } from '../src/transports';

const SKILLS_ROOT = path.resolve(process.cwd(), '..', '..', 'skills');

const PROPOSAL_JSON = {
  proposalRationale: 'Phase 3 W7 stub provider proposal',
  revisedFragments: [{ originalText: 'foo', replacementText: 'bar' }],
  uncertainties: [],
};

const PROPOSAL_FENCED = `\`\`\`json\n${JSON.stringify(PROPOSAL_JSON)}\n\`\`\``;

function makeRunInput(skill: SkillMeta, mcp: McpServerSet): ProviderRunInput {
  return {
    modelId: 'test-model',
    systemPrompt: 'you are a test agent',
    skill,
    mcp,
    passage: 'A short passage to operate on.',
    hints: {},
    agentId: 'agent-byo-test',
    actorPrincipalId: 'agent:agent-byo-test',
    maxIterations: 4,
    temperature: 0,
  };
}

describe('createOpenAICompatProvider', () => {
  let mcp: McpServerSet;
  let skill: SkillMeta;

  before(async () => {
    _resetSkillCache();
    skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
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

  it('throws config-invalid without endpointUrl', () => {
    assert.throws(
      () => createOpenAICompatProvider({ id: 'p', apiKey: 'k' }),
      (e: Error) =>
        e instanceof ProviderError && e.code === 'config-invalid',
    );
  });

  it('happy path: single completion with no tools → parses JSON proposal', async () => {
    const fetchStub: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: { role: 'assistant', content: PROPOSAL_FENCED },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const provider = createOpenAICompatProvider(
      {
        id: 'test-vllm',
        endpointUrl: 'http://localhost:8000/v1',
        apiKey: 'no-auth',
      },
      { fetchImpl: fetchStub },
    );
    const proposal = await provider.runAgent(makeRunInput(skill, mcp));
    assert.equal(proposal.revisedFragments.length, 1);
    assert.equal(proposal.revisedFragments[0]!.replacementText, 'bar');
    assert.equal(proposal.agentContext.modelId, 'test-model');
    assert.equal(proposal.agentContext.modelProvider, 'openai');
  });

  it('rate-limited 429 → ProviderError(rate-limited)', async () => {
    const fetchStub: typeof fetch = async () =>
      new Response('too many requests', { status: 429 });
    const provider = createOpenAICompatProvider(
      { id: 'test', endpointUrl: 'http://localhost/v1' },
      { fetchImpl: fetchStub },
    );
    await assert.rejects(
      provider.runAgent(makeRunInput(skill, mcp)),
      (e: Error) =>
        e instanceof ProviderError && e.code === 'rate-limited',
    );
  });

  it('tool-use loop: dispatches MCP tool then resolves on second turn', async () => {
    let turn = 0;
    const fetchStub: typeof fetch = async () => {
      turn += 1;
      if (turn === 1) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: {
                        name: 'lookup_doi',
                        arguments: JSON.stringify({
                          doi: '10.1145/3531146.3533104',
                        }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: { role: 'assistant', content: PROPOSAL_FENCED },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200 },
      );
    };
    const provider = createOpenAICompatProvider(
      { id: 'test', endpointUrl: 'http://localhost/v1', apiKey: 'k' },
      { fetchImpl: fetchStub },
    );
    const proposal = await provider.runAgent(makeRunInput(skill, mcp));
    assert.equal(proposal.toolCalls.length, 1);
    assert.equal(proposal.toolCalls[0]!.toolName, 'lookup_doi');
    assert.equal(proposal.toolCalls[0]!.mcpServerId, 'crossref-mock');
    assert.equal(proposal.toolCalls[0]!.succeeded, true);
    assert.equal(proposal.revisedFragments.length, 1);
  });
});

describe('createOllamaProvider', () => {
  let mcp: McpServerSet;
  let skill: SkillMeta;

  before(async () => {
    skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
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

  it('uses default endpoint http://localhost:11434 when none supplied', async () => {
    let observedUrl = '';
    const fetchStub: typeof fetch = async (input) => {
      observedUrl = String(input);
      return new Response(
        JSON.stringify({
          message: { role: 'assistant', content: PROPOSAL_FENCED },
          done: true,
        }),
        { status: 200 },
      );
    };
    const provider = createOllamaProvider(
      { id: 'ollama-default' },
      { fetchImpl: fetchStub },
    );
    await provider.runAgent(makeRunInput(skill, mcp));
    assert.match(observedUrl, /^http:\/\/localhost:11434\/api\/chat$/);
  });

  it('respects custom endpoint', async () => {
    let observedUrl = '';
    const fetchStub: typeof fetch = async (input) => {
      observedUrl = String(input);
      return new Response(
        JSON.stringify({
          message: { role: 'assistant', content: PROPOSAL_FENCED },
          done: true,
        }),
        { status: 200 },
      );
    };
    const provider = createOllamaProvider(
      { id: 'ollama-remote', endpointUrl: 'http://gpu-box.lan:11434' },
      { fetchImpl: fetchStub },
    );
    await provider.runAgent(makeRunInput(skill, mcp));
    assert.equal(observedUrl, 'http://gpu-box.lan:11434/api/chat');
  });

  it('404 → ProviderError(config-invalid) — typically model not pulled', async () => {
    const fetchStub: typeof fetch = async () =>
      new Response('model not found', { status: 404 });
    const provider = createOllamaProvider(
      { id: 'ollama' },
      { fetchImpl: fetchStub },
    );
    await assert.rejects(
      provider.runAgent(makeRunInput(skill, mcp)),
      (e: Error) =>
        e instanceof ProviderError && e.code === 'config-invalid',
    );
  });

  it('parses JSON proposal from message.content', async () => {
    const fetchStub: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          message: { role: 'assistant', content: PROPOSAL_FENCED },
          done: true,
        }),
        { status: 200 },
      );
    const provider = createOllamaProvider(
      { id: 'ollama' },
      { fetchImpl: fetchStub },
    );
    const proposal = await provider.runAgent(makeRunInput(skill, mcp));
    assert.equal(proposal.revisedFragments.length, 1);
    assert.equal(proposal.agentContext.modelProvider, 'local-ollama');
  });
});

describe('createCustomHttpProvider', () => {
  let mcp: McpServerSet;
  let skill: SkillMeta;

  before(async () => {
    skill = await loadSkill(SKILLS_ROOT, 'citation-lookup');
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

  it('throws config-invalid without serializeRequest/parseResponse', () => {
    assert.throws(
      () =>
        createCustomHttpProvider(
          { id: 'cust' },
          // @ts-expect-error intentionally missing required callbacks
          {},
        ),
      (e: Error) =>
        e instanceof ProviderError && e.code === 'config-invalid',
    );
  });

  it('drives single-shot completion via user callbacks', async () => {
    const fetchStub: typeof fetch = async () =>
      new Response(JSON.stringify({ assistant: PROPOSAL_FENCED }), {
        status: 200,
      });
    const provider = createCustomHttpProvider(
      { id: 'corp-llm' },
      {
        fetchImpl: fetchStub,
        serializeRequest: (input) => ({
          url: 'https://corp-llm.local/api/v3/complete',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: input.passage }),
        }),
        parseResponse: (body) => {
          const parsed = JSON.parse(body) as { assistant: string };
          return { text: parsed.assistant };
        },
      },
    );
    const proposal = await provider.runAgent(makeRunInput(skill, mcp));
    assert.equal(proposal.revisedFragments.length, 1);
    assert.equal(proposal.agentContext.modelProvider, 'custom');
  });

  it('iterates when parseResponse returns toolCalls (toolUse=true)', async () => {
    let turn = 0;
    const fetchStub: typeof fetch = async () => {
      turn += 1;
      if (turn === 1) {
        return new Response(
          JSON.stringify({
            text: '',
            tools: [
              {
                id: 'tc1',
                name: 'lookup_doi',
                arguments: { doi: '10.1145/3531146.3533104' },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ text: PROPOSAL_FENCED }),
        { status: 200 },
      );
    };
    const provider = createCustomHttpProvider(
      { id: 'corp' },
      {
        features: { toolUse: true },
        fetchImpl: fetchStub,
        serializeRequest: () => ({
          url: 'https://corp/v1/chat',
          method: 'POST',
          headers: {},
          body: '{}',
        }),
        parseResponse: (body) => {
          const j = JSON.parse(body) as {
            text: string;
            tools?: Array<{
              id: string;
              name: string;
              arguments: Record<string, unknown>;
            }>;
          };
          return {
            text: j.text,
            ...(j.tools
              ? {
                  toolCalls: j.tools.map((t) => ({
                    id: t.id,
                    name: t.name,
                    arguments: t.arguments,
                  })),
                }
              : {}),
          };
        },
      },
    );
    const proposal = await provider.runAgent(makeRunInput(skill, mcp));
    assert.equal(proposal.toolCalls.length, 1);
    assert.equal(proposal.toolCalls[0]!.toolName, 'lookup_doi');
    assert.equal(proposal.revisedFragments.length, 1);
  });
});
