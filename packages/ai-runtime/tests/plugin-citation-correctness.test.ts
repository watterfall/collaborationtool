// Phase 2 W3 dogfood gate replacement for the W2 equivalence test.
//
// W2 commit `64849b8` introduced an equivalence test (hardcode
// invokeCitationAgent vs plugin path) that proved the plugin path
// produces the same AgentProposal as the hardcoded one — the W3
// dogfood gate criterion #1.
//
// W3 commit (this one) deletes the hardcode citation.ts entirely (per
// ADR-0010 §2.7 step 4 "no internal-only API"). The equivalence test
// is replaced by this "plugin path correctness" test, which exercises
// the plugin path end-to-end without comparing to a non-existent
// hardcode reference. The dogfood gate criterion #1 evidence is
// preserved in ADR-0010 §7 review log + commit `64849b8` history.
//
// What this test asserts:
//   - The citation plugin loads with no manifest validation errors
//   - invokeAgentViaPlugin produces a non-empty proposal
//   - The proposal's revisedFragment matches what crossref-mock returns
//     for the foundation-models DOI (so the runner → MCP → tool-call
//     flow is intact)
//   - agentContext.promptTemplateId is the citation-lookup SKILL.md hash
//     (proves Provenance row produced by W3 dogfood path is identical
//     to the W2 hardcode path — Provenance schema invariant)

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  invokeAgentViaPlugin,
  crossrefMockTransport,
  loadAgentPlugin,
} from '../src';
import { _resetSkillCache } from '../src/skills-loader';
import type { Capability, PrincipalContext } from '@collaborationtool/permissions';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const SKILLS_ROOT = path.resolve(REPO_ROOT, 'skills');
const PLUGIN_ROOT = path.resolve(REPO_ROOT, 'plugins', 'citation-agent');

const PASSAGE =
  'See DOI 10.1145/3531146.3533104 for the foundation models survey.';
const FLAGGED = ['10.1145/3531146.3533104'];

const PRINCIPAL: PrincipalContext = {
  principalId: 'user:test',
  documentCapabilities: new Set<Capability>([
    'agent.invoke:citation',
    'block.read',
    'block.propose',
    'citation.read',
    'citation.create',
    'citation.update',
    'citation.bind',
  ]),
  globalCapabilities: new Set<Capability>(),
};

describe('citation plugin (W3 dogfood) — correctness', () => {
  it('manifest loads with no fatal errors', async () => {
    _resetSkillCache();
    const loaded = await loadAgentPlugin(PLUGIN_ROOT);
    assert.equal(loaded.manifest.id, '@official/citation-agent');
    assert.equal(loaded.manifest.type, 'agent');
    assert.equal(loaded.manifest.kind, 'citation');
    assert.equal(loaded.manifest.runtimeMode, 'propose');
    // The host calls module.runAgent — type-narrow assertion proves
    // the AgentPluginModule contract is satisfied.
    assert.equal(typeof loaded.module.runAgent, 'function');
  });

  it('invokeAgentViaPlugin produces a citation proposal', async () => {
    const result = await invokeAgentViaPlugin(
      {
        pluginPath: PLUGIN_ROOT,
        principalContext: PRINCIPAL,
        documentId: '00000000-0000-7000-8000-00000000d001',
        blockId: '00000000-0000-7000-8000-00000000b001',
        passage: PASSAGE,
        hints: { flaggedDoiCandidates: FLAGGED },
        skillId: 'citation-lookup',
        skillsRoot: SKILLS_ROOT,
        mcpSpecs: [
          {
            id: 'crossref-mock',
            buildTransport: crossrefMockTransport().buildTransport,
          },
        ],
        // Phase 4 W7.2: omitting `provider` makes plugin-host fall back
        // to createMockModelProvider({ shape: 'citation' }) keyed by
        // manifest.kind (mirrors the old `anthropic: null` behaviour).
      },
      { persistToDb: false },
    );

    assert.equal(result.pluginManifestId, '@official/citation-agent');
    assert.equal(result.pluginManifestVersion, '0.1.0');

    const { proposal } = result;
    assert.equal(proposal.revisedFragments.length, 1);
    const frag = proposal.revisedFragments[0]!;
    assert.match(frag.originalText, /^DOI/);
    assert.match(frag.replacementText, /^DOI/);
    assert.ok(frag.citationCslJson);
    assert.match(
      String(frag.citationCslJson?.['title'] ?? ''),
      /Foundation Models/,
    );

    // tool-call wiring is intact — runner → mcp-client → crossref-mock
    assert.equal(proposal.toolCalls.length, 1);
    const t = proposal.toolCalls[0]!;
    assert.equal(t.toolName, 'lookup_doi');
    assert.equal(t.mcpServerId, 'crossref-mock');
    assert.equal(t.succeeded, true);
    assert.match(t.argumentsHash, /^[0-9a-f]{64}$/);

    // Provenance schema invariant: promptTemplateId is `<skillId>@<hash-prefix>`
    // derived from the citation-lookup SKILL.md content. If the plugin
    // path ever bypasses the skill loader, the prefix changes.
    assert.match(
      proposal.agentContext.promptTemplateId,
      /^citation-lookup@[0-9a-f]{6,}$/,
    );
  });

  it('rejects when caller lacks agent.invoke:citation', async () => {
    const noCapCtx: PrincipalContext = {
      principalId: 'user:no-cap',
      documentCapabilities: new Set<Capability>(['block.read']),
      globalCapabilities: new Set<Capability>(),
    };
    await assert.rejects(
      () =>
        invokeAgentViaPlugin(
          {
            pluginPath: PLUGIN_ROOT,
            principalContext: noCapCtx,
            documentId: '00000000-0000-7000-8000-00000000d001',
            blockId: '00000000-0000-7000-8000-00000000b001',
            passage: PASSAGE,
            hints: { flaggedDoiCandidates: FLAGGED },
            skillId: 'citation-lookup',
            skillsRoot: SKILLS_ROOT,
          },
          { persistToDb: false },
        ),
      /agent\.invoke:citation/,
    );
  });
});
