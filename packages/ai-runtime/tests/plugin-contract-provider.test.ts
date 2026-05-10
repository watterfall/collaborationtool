// Phase 4 W7.2 ADR-0013 §2.5 真兑现 — plugin contract provider migration.
//
// What this test asserts (the dogfood gate for the migration):
//   - Each of the 5 first-party agent plugins (citation, inline-editor,
//     coordinator, researcher, reviewer) can be invoked through the
//     plugin-host with an OllamaProvider (mocked fetch) instead of an
//     Anthropic client.
//   - No path inside any plugin reaches Anthropic SDK code: we monkey-
//     patch `Anthropic.prototype.messages.create` to count invocations,
//     then assert the count is 0 after running every plugin.
//
// This is the criterion the user-facing W7.2 dogfood gate runs locally
// (ANTHROPIC_API_KEY unset, OLLAMA_HOST=mock). Wave 3 follow-up will
// run real Ollama; this test only verifies the call path is clean.

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it, after, before } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import {
  createOllamaProvider,
  crossrefMockTransport,
  invokeAgentViaPlugin,
  type ModelProvider,
} from '../src';
import { _resetSkillCache } from '../src/skills-loader';
import type {
  Capability,
  PrincipalContext,
} from '@collaborationtool/permissions';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const SKILLS_ROOT = path.resolve(REPO_ROOT, 'skills');

// All capability words the 5 first-party plugins require, unioned.
// `agent.invoke:researcher` and `agent.invoke:coordinator` are
// synthesised at runtime by plugin-host (`agent.invoke:${manifest.kind}`)
// — they are not in the ADR-0002 36 vocab, so we cast them through
// `as Capability` to match the runtime Set.has() string-equality check.
const CAPS: Capability[] = [
  'agent.invoke:citation',
  'agent.invoke:editor',
  'agent.invoke:reviewer',
  'agent.invoke:researcher' as Capability,
  'agent.invoke:coordinator' as Capability,
  'block.read',
  'block.propose',
  'citation.read',
  'citation.create',
  'citation.update',
  'citation.bind',
  'annotation.create',
  'annotation.reply',
];

const PRINCIPAL: PrincipalContext = {
  principalId: 'user:contract-test',
  documentCapabilities: new Set<Capability>(CAPS),
  globalCapabilities: new Set<Capability>(),
};

// A fenced JSON block matching the runner output contract; every plugin
// path produces a parseable AgentProposal from this single response.
const PROPOSAL_FENCED =
  '```json\n' +
  JSON.stringify({
    proposalRationale: 'contract test stub',
    revisedFragments: [
      { originalText: 'orig', replacementText: 'rev' },
    ],
    uncertainties: [],
  }) +
  '\n```';

function makeOllamaProvider(): ModelProvider {
  const fetchStub: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        message: { role: 'assistant', content: PROPOSAL_FENCED },
        done: true,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  return createOllamaProvider(
    { id: 'ollama-contract-test', endpointUrl: 'http://mock-ollama.test' },
    { fetchImpl: fetchStub },
  );
}

interface PluginCase {
  kind: string;
  pluginPath: string;
  skillId: string;
  hints: Record<string, unknown>;
  passage: string;
  mcpSpecs?: Parameters<typeof invokeAgentViaPlugin>[0]['mcpSpecs'];
}

const PLUGIN_CASES: PluginCase[] = [
  {
    kind: 'citation',
    pluginPath: path.resolve(REPO_ROOT, 'plugins', 'citation-agent'),
    skillId: 'citation-lookup',
    hints: { flaggedDoiCandidates: ['10.1145/3531146.3533104'] },
    passage:
      'See DOI 10.1145/3531146.3533104 for the foundation models survey.',
    mcpSpecs: [
      {
        id: 'crossref-mock',
        buildTransport: crossrefMockTransport().buildTransport,
      },
    ],
  },
  {
    kind: 'editor (inline-editor-agent)',
    pluginPath: path.resolve(REPO_ROOT, 'plugins', 'inline-editor-agent'),
    skillId: 'inline-editor',
    hints: { userInstruction: 'rewrite formally' },
    passage: 'we got the result fast.',
    mcpSpecs: [],
  },
  {
    kind: 'reviewer',
    pluginPath: path.resolve(REPO_ROOT, 'plugins', 'reviewer-agent'),
    skillId: 'reviewer-style',
    hints: {},
    passage:
      'A long paragraph that the reviewer agent should scan for issues. '.repeat(
        4,
      ),
    mcpSpecs: [],
  },
  {
    kind: 'researcher',
    pluginPath: path.resolve(REPO_ROOT, 'plugins', 'researcher-agent'),
    skillId: 'literature-review',
    hints: { query: 'foundation models survey' },
    passage: 'Looking for citations supporting the foundation models claim.',
    mcpSpecs: [],
  },
  {
    kind: 'coordinator',
    pluginPath: path.resolve(REPO_ROOT, 'plugins', 'coordinator-agent'),
    skillId: 'coordinator',
    hints: { goal: 'summarise + propose 1 citation for §3' },
    passage: 'Section 3 prose body to coordinate over.',
    mcpSpecs: [],
  },
];

// SDK isolation — patch Anthropic.prototype.messages.create with a
// counter so any inadvertent path hitting the Anthropic SDK is caught
// by an assertion rather than producing a silent network error.
let anthropicCallCount = 0;
let originalCreate: unknown;

describe('plugin contract migration (W7.2 ADR-0013 §2.5)', () => {
  before(() => {
    _resetSkillCache();
    // The SDK exposes `messages` as a getter on each Client instance;
    // the per-instance object is `Messages` whose .create makes the
    // network call. We swap on the prototype so any client instance
    // uses our counter.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto: any = (Anthropic as unknown as { Messages?: { prototype: { create: unknown } } })
      .Messages?.prototype;
    if (proto && typeof proto.create === 'function') {
      originalCreate = proto.create;
      proto.create = async () => {
        anthropicCallCount += 1;
        throw new Error(
          'plugin-contract-provider: Anthropic SDK called inside plugin path — ADR-0013 §2.5 violation',
        );
      };
    }
  });

  after(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto: any = (Anthropic as unknown as { Messages?: { prototype: { create: unknown } } })
      .Messages?.prototype;
    if (proto && originalCreate) {
      proto.create = originalCreate;
    }
  });

  for (const c of PLUGIN_CASES) {
    it(`${c.kind}: runs under OllamaProvider, never touches Anthropic SDK`, async () => {
      const before = anthropicCallCount;
      const result = await invokeAgentViaPlugin(
        {
          pluginPath: c.pluginPath,
          principalContext: PRINCIPAL,
          documentId: '00000000-0000-7000-8000-00000000d001',
          blockId: '00000000-0000-7000-8000-00000000b001',
          passage: c.passage,
          hints: c.hints,
          skillId: c.skillId,
          skillsRoot: SKILLS_ROOT,
          ...(c.mcpSpecs ? { mcpSpecs: c.mcpSpecs } : {}),
          provider: makeOllamaProvider(),
        },
        { persistToDb: false },
      );
      // Provider executed and produced an AgentProposal.
      assert.ok(result.proposal);
      assert.equal(result.proposal.agentContext.modelProvider, 'local-ollama');
      // Anthropic SDK count must not change for this plugin's call.
      assert.equal(
        anthropicCallCount,
        before,
        `${c.kind}: Anthropic SDK was called ${anthropicCallCount - before} times during plugin invocation`,
      );
    });
  }

  it('aggregate: 0 Anthropic SDK calls across all 5 plugins', () => {
    assert.equal(
      anthropicCallCount,
      0,
      'plugin contract violation: Anthropic SDK reached during OllamaProvider path',
    );
  });
});
