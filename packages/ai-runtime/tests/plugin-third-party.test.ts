// Phase 2 W3 dogfood gate criterion #2 (ADR-0010 §2.7):
//   "Third-party plugin manifest can be loaded by the loader."
//
// We materialise a complete plugin tree in a tmpdir (NOT under
// `<repo>/plugins/`) and prove that:
//   (a) the loader handles arbitrary filesystem paths
//   (b) the runtime contract is identical for the third-party plugin
//   (c) capability vocabulary outside ADR-0002 produces a warning, not a
//       hard failure (so plugins can co-evolve with capability vocabulary
//       expansion across ADR review log entries)
//
// This test does NOT exercise plugin install / registry write — that's
// Phase 3 (ADR-0006 §2.5 + ADR-0010 §2.5). Phase 2 W3 just proves the
// loader is path-agnostic.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, after, before } from 'node:test';

import {
  crossrefMockTransport,
  invokeAgentViaPlugin,
  loadAgentPlugin,
} from '../src';
import { _resetSkillCache } from '../src/skills-loader';
import type { Capability, PrincipalContext } from '@collaborationtool/permissions';

const PRINCIPAL: PrincipalContext = {
  principalId: 'user:third-party-test',
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

describe('third-party plugin loading (W3 dogfood gate criterion #2)', () => {
  let pluginsRoot: string;
  let pluginPath: string;
  let skillsRoot: string;

  before(async () => {
    _resetSkillCache();
    pluginsRoot = await mkdtemp(join(tmpdir(), 'collab-thirdparty-'));
    pluginPath = join(pluginsRoot, 'citation-clone');
    skillsRoot = join(pluginsRoot, 'skills');

    // ---------- Build a third-party plugin in tmpdir ----------
    await mkdir(pluginPath, { recursive: true });

    // Manifest references a candidate ADR-0002 vocabulary extension
    // (`mcp.install`, ADR-0006 §6) — proves the loader warns on
    // out-of-vocab capabilities without rejecting (forward-compat).
    await writeFile(
      join(pluginPath, 'plugin.yaml'),
      `
id: "@third-party/citation-clone"
version: "0.0.1"
type: agent
title:
  zh: "第三方引用 agent"
  en: "Third-party citation agent"
description:
  zh: "演示外部 plugin 路径加载（不在 plugins/ 下）"
  en: "Demonstrates loader handles arbitrary path"
authors: ["@third-party"]
license: MIT
required_capabilities:
  - block.read
  - block.propose
  - agent.invoke:citation
  - mcp.install         # ADR-0006 §6 candidate; loader warns, not rejects
runtime:
  kernel_version: "^2.0.0"
  target: node
  node: ">=20"
kind: citation
prompt_template: ./prompt.md
runtime_mode: propose
`,
    );

    await writeFile(
      join(pluginPath, 'prompt.md'),
      `Third-party citation prompt — looks up DOI metadata.

Output format:
\`\`\`json
{ "proposalRationale": string, "revisedFragments": [...], "uncertainties": [...] }
\`\`\`
`,
    );

    // The plugin module is intentionally self-contained — no imports
    // from `@collaborationtool/*` workspace packages, since a real
    // third-party plugin in `~/.platform/plugins/<id>/` would have
    // its own node_modules tree (or none at all). Phase 3 user-install
    // flow per ADR-0010 §2.5 / ADR-0006 §2.5 builds that. For Phase 2
    // W3 dogfood gate criterion #2 the requirement is just: the loader
    // path-resolves and dynamic-imports a contract-compliant module.
    await writeFile(
      join(pluginPath, 'agent.ts'),
      `
// Minimal third-party citation-agent stub — fulfils AgentPluginModule
// contract without depending on workspace packages. Returns a static
// AgentProposal shaped like a citation lookup, which proves the loader
// + invokeAgentViaPlugin host integration work for arbitrary plugin
// paths (Phase 2 W3 dogfood gate criterion #2, ADR-0010 §2.7).

export async function runAgent(input) {
  const flagged = Array.isArray(input.hints?.flaggedDoiCandidates)
    ? input.hints.flaggedDoiCandidates
    : [];
  // Pretend we resolved a single DOI via a tool call. The host wires
  // the MCP set; we deliberately don't use it (proves third-party
  // plugins can opt out of MCP and still satisfy the contract).
  const now = new Date().toISOString();
  return {
    proposalRationale: 'third-party stub citation lookup',
    revisedFragments: [
      {
        originalText: 'DOI ' + (flagged[0] ?? 'unknown'),
        replacementText: 'DOI ' + (flagged[0] ?? 'unknown') + ' [verified by stub]',
      },
    ],
    uncertainties: [],
    toolCalls: [
      {
        toolName: 'lookup_doi',
        mcpServerId: 'crossref-mock',
        argumentsHash: 'a'.repeat(64),
        durationMs: 1,
        succeeded: true,
      },
    ],
    agentContext: {
      agentId: input.agentId,
      modelId: input.modelId,
      promptTemplateId: input.skill.promptTemplateId,
      promptHash: input.skill.promptHash,
    },
    startedAt: now,
    finishedAt: now,
  };
}
`,
    );

    // Note: no package.json — loader falls back to convention
    // <root>/agent.ts per resolveAgentEntry.

    // ---------- Build a copy of the citation-lookup skill in tmpdir ----------
    const skillDir = join(skillsRoot, 'citation-lookup');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: citation-lookup
description: |
  Verify and enrich academic citation references.
allowed_mcp_servers:
  - crossref-mock
required_capabilities:
  - block.read
  - block.propose
  - citation.read
  - citation.create
  - citation.update
  - citation.bind
  - agent.invoke:citation
---

# Citation lookup

Third-party clone of the citation-lookup skill (test-only fixture).
`,
    );
  });

  after(async () => {
    await rm(pluginsRoot, { recursive: true, force: true });
  });

  it('loadAgentPlugin handles a plugin outside <repo>/plugins/', async () => {
    const loaded = await loadAgentPlugin(pluginPath);
    assert.equal(loaded.manifest.id, '@third-party/citation-clone');
    assert.equal(loaded.manifest.kind, 'citation');
    assert.equal(typeof loaded.module.runAgent, 'function');

    // The loader should have flagged `mcp.install` as outside the
    // ADR-0002 36 vocabulary but not rejected the plugin.
    assert.ok(
      loaded.warnings.some(
        (w) => /mcp\.install/.test(w) && /ADR-0002/.test(w),
      ),
      `expected ADR-0002 vocab warning; got ${JSON.stringify(loaded.warnings)}`,
    );
  });

  it('invokeAgentViaPlugin runs the third-party plugin uniformly', async () => {
    const result = await invokeAgentViaPlugin(
      {
        pluginPath,
        principalContext: PRINCIPAL,
        documentId: '00000000-0000-7000-8000-00000000d001',
        blockId: '00000000-0000-7000-8000-00000000b001',
        passage:
          'See DOI 10.1145/3531146.3533104 for the foundation models survey.',
        hints: { flaggedDoiCandidates: ['10.1145/3531146.3533104'] },
        skillId: 'citation-lookup',
        skillsRoot,
        mcpSpecs: [
          {
            id: 'crossref-mock',
            buildTransport: crossrefMockTransport().buildTransport,
          },
        ],
        anthropic: null,
      },
      { persistToDb: false },
    );

    assert.equal(result.pluginManifestId, '@third-party/citation-clone');
    assert.equal(result.pluginManifestVersion, '0.0.1');
    assert.ok(result.pluginWarnings.length > 0); // ADR-0002 warning surfaced
    assert.equal(result.proposal.revisedFragments.length, 1);
    assert.equal(result.proposal.toolCalls.length, 1);
  });
});
