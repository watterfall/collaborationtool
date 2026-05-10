// Plugin loader + manifest parser tests (Phase 2 W1 skeleton, ADR-0010).
//
// Coverage targets:
//   - Each of the 4 plugin kinds parses its happy path
//   - Strict shape errors throw PluginManifestError
//   - Soft findings accumulate as warnings (capability outside ADR-0002,
//     unrecognised tool form, etc.)
//   - loadPlugin handles both directory and direct-file paths
//   - capability subset validation against @collaborationtool/permissions
//     CAPABILITY_SET

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, before, after } from 'node:test';

import {
  loadPlugin,
  PluginLoadError,
  PluginManifestError,
  parseManifest,
  type AgentManifest,
  type McpServerManifest,
  type SkillManifest,
  type UiPanelManifest,
} from '../src/plugins';

describe('parseManifest — base fields', () => {
  it('rejects non-object root', () => {
    assert.throws(
      () => parseManifest('"just a string"', { sourcePath: '/tmp/x.yaml' }),
      (err: Error) =>
        err instanceof PluginManifestError && /must be a YAML mapping/.test(err.message),
    );
  });

  it('rejects malformed YAML', () => {
    assert.throws(
      () =>
        parseManifest('id: foo\n  bad: indent\nversion: 0.1.0', {
          sourcePath: '/tmp/x.yaml',
        }),
      (err: Error) => err instanceof PluginManifestError,
    );
  });

  it('rejects unknown plugin type', () => {
    const yaml = `
id: "@owner/x"
version: "0.1.0"
type: not-a-real-type
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
`;
    assert.throws(
      () => parseManifest(yaml, { sourcePath: '/tmp/x.yaml' }),
      (err: Error) => err instanceof PluginManifestError && /type must be one of/.test(err.message),
    );
  });

  it('rejects non-SemVer version', () => {
    const yaml = `
id: "@owner/x"
version: latest
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
`;
    assert.throws(
      () => parseManifest(yaml, { sourcePath: '/tmp/x.yaml' }),
      (err: Error) =>
        err instanceof PluginManifestError && /not SemVer-shaped/.test(err.message),
    );
  });

  it('warns when id does not match @owner/name', () => {
    const yaml = `
id: my-plugin
version: "0.1.0"
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    assert.ok(r.warnings.some((w) => /conventional @owner\/name/.test(w)));
    assert.equal(r.manifest.id, 'my-plugin');
  });

  it('warns when required_capabilities references vocab outside ADR-0002', () => {
    const yaml = `
id: "@owner/x"
version: "0.1.0"
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities:
  - block.read
  - mcp.install
  - made.up.verb
runtime: { kernel_version: "^2.0.0" }
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    assert.equal(r.manifest.requiredCapabilities.length, 1);
    assert.equal(r.manifest.requiredCapabilities[0], 'block.read');
    assert.equal(
      r.warnings.filter((w) => /not in the ADR-0002 36 vocabulary/.test(w)).length,
      2,
    );
  });

  it('mirrors bilingual string when only one side provided', () => {
    const yaml = `
id: "@owner/x"
version: "0.1.0"
type: skill
title: { zh: "中文" }
description: { en: "English only" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    assert.equal(r.manifest.title.zh, '中文');
    assert.equal(r.manifest.title.en, '中文');
    assert.equal(r.manifest.description.zh, 'English only');
    assert.equal(r.manifest.description.en, 'English only');
  });

  it('rejects bilingual string with both sides empty', () => {
    const yaml = `
id: "@owner/x"
version: "0.1.0"
type: skill
title: {}
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
`;
    assert.throws(
      () => parseManifest(yaml, { sourcePath: '/tmp/x.yaml' }),
      (err: Error) =>
        err instanceof PluginManifestError && /bilingual parity/.test(err.message),
    );
  });
});

describe('parseManifest — Skill', () => {
  it('parses a complete skill manifest', () => {
    const yaml = `
id: "@official/nature-submission"
version: "1.2.0"
type: skill
title: { zh: "投稿 Nature", en: "Nature submission" }
description: { zh: "投稿 Nature 系列期刊的格式 / 风格指引", en: "Nature submission style + format" }
authors: ["@official"]
license: Apache-2.0
required_capabilities:
  - block.read
  - block.propose
runtime: { kernel_version: "^2.0.0" }
trigger_patterns:
  - "投稿 Nature"
  - "Nature submission"
  - regex: "\\\\\\\\cite\\\\{[^}]+\\\\}"
provides_tools:
  - check_word_count
  - validate_reference_format
allowed_mcp_servers: [crossref]
nested_skills: ["@official/style-guide"]
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    const m = r.manifest as SkillManifest;
    assert.equal(m.type, 'skill');
    assert.equal(m.triggerPatterns.length, 3);
    assert.equal(m.triggerPatterns[0], '投稿 Nature');
    assert.deepEqual(m.providesTools, ['check_word_count', 'validate_reference_format']);
    assert.deepEqual(m.allowedMcpServers, ['crossref']);
    assert.equal(m.matchAll, false);
  });

  it('warns when trigger_patterns is missing', () => {
    const yaml = `
id: "@owner/x"
version: "0.1.0"
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    assert.ok(r.warnings.some((w) => /trigger_patterns/.test(w)));
  });

  it('rejects malformed trigger_patterns item', () => {
    const yaml = `
id: "@owner/x"
version: "0.1.0"
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
trigger_patterns:
  - 42
`;
    assert.throws(
      () => parseManifest(yaml, { sourcePath: '/tmp/x.yaml' }),
      (err: Error) =>
        err instanceof PluginManifestError && /strings or \{ regex/.test(err.message),
    );
  });
});

describe('parseManifest — Agent', () => {
  it('parses a complete agent manifest', () => {
    const yaml = `
id: "@official/citation-agent"
version: "0.1.0"
type: agent
title: { zh: "引用核查 agent", en: "Citation agent" }
description: { zh: "...", en: "..." }
authors: ["@official"]
license: Apache-2.0
required_capabilities:
  - block.read
  - block.propose
  - agent.invoke:citation
runtime: { kernel_version: "^2.0.0" }
kind: citation
prompt_template: ./prompt.md
tools:
  - mcp:crossref:lookupDoi
  - builtin:proposeRevision
runtime_mode: propose
quota:
  daily_invocations: 100
  timeout_seconds: 60
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    const m = r.manifest as AgentManifest;
    assert.equal(m.kind, 'citation');
    assert.equal(m.runtimeMode, 'propose');
    assert.equal(m.quota.dailyInvocations, 100);
    assert.equal(m.quota.timeoutSeconds, 60);
  });

  it('warns when runtime_mode is autonomous', () => {
    const yaml = `
id: "@official/x"
version: "0.1.0"
type: agent
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: ["@official"]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
kind: citation
prompt_template: ./prompt.md
runtime_mode: autonomous
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    assert.ok(r.warnings.some((w) => /autonomous/.test(w) && /role 5/.test(w)));
  });

  it('rejects unknown agent kind', () => {
    const yaml = `
id: "@official/x"
version: "0.1.0"
type: agent
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: ["@official"]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
kind: not-a-real-kind
prompt_template: ./prompt.md
`;
    assert.throws(
      () => parseManifest(yaml, { sourcePath: '/tmp/x.yaml' }),
      (err: Error) =>
        err instanceof PluginManifestError && /agent kind must be one of/.test(err.message),
    );
  });
});

describe('parseManifest — McpServer', () => {
  it('parses a stdio MCP server manifest', () => {
    const yaml = `
id: "@official/crossref"
version: "0.1.0"
type: mcp-server
title: { zh: "CrossRef", en: "CrossRef" }
description: { zh: "DOI 元数据查询", en: "DOI metadata lookup" }
authors: ["@official"]
license: Apache-2.0
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
transport: stdio
command: [tsx, mcp-servers/crossref/src/bin.ts]
declares_tools: [lookupDoi]
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    const m = r.manifest as McpServerManifest;
    assert.equal(m.transport, 'stdio');
    assert.deepEqual(m.command, ['tsx', 'mcp-servers/crossref/src/bin.ts']);
    assert.deepEqual(m.declaresTools, ['lookupDoi']);
  });

  it('rejects stdio without command', () => {
    const yaml = `
id: "@official/x"
version: "0.1.0"
type: mcp-server
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: ["@official"]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
transport: stdio
`;
    assert.throws(
      () => parseManifest(yaml, { sourcePath: '/tmp/x.yaml' }),
      (err: Error) =>
        err instanceof PluginManifestError && /requires non-empty command/.test(err.message),
    );
  });

  it('rejects http without url', () => {
    const yaml = `
id: "@official/x"
version: "0.1.0"
type: mcp-server
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: ["@official"]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
transport: http
`;
    assert.throws(
      () => parseManifest(yaml, { sourcePath: '/tmp/x.yaml' }),
      (err: Error) =>
        err instanceof PluginManifestError && /requires url/.test(err.message),
    );
  });

  it('warns about Phase 3 transport http', () => {
    const yaml = `
id: "@official/x"
version: "0.1.0"
type: mcp-server
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: ["@official"]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
transport: http
url: https://example.com/mcp
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    assert.ok(r.warnings.some((w) => /Phase 3/.test(w)));
  });
});

describe('parseManifest — UiPanel', () => {
  it('parses a sidebar ui-panel manifest with phase-2 not-loaded warning', () => {
    const yaml = `
id: "@owner/sidebar"
version: "0.1.0"
type: ui-panel
title: { zh: "侧边面板", en: "Sidebar Panel" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
mount_point: sidebar
entry: ./dist/index.html
post_message_protocol_version: 1
`;
    const r = parseManifest(yaml, { sourcePath: '/tmp/x.yaml' });
    const m = r.manifest as UiPanelManifest;
    assert.equal(m.mountPoint, 'sidebar');
    assert.equal(m.entry, './dist/index.html');
    assert.equal(m.postMessageProtocolVersion, 1);
    assert.ok(r.warnings.some((w) => /Phase 2/.test(w) && /manifest validation only/.test(w)));
  });
});

describe('loadPlugin', () => {
  let root: string;

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'collab-plugins-'));
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('loads from a directory path', async () => {
    const dir = join(root, 'dir-plugin');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'plugin.yaml'),
      `
id: "@owner/dir-plugin"
version: "0.1.0"
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: [block.read]
runtime: { kernel_version: "^2.0.0" }
trigger_patterns:
  - hello
`,
    );
    const loaded = await loadPlugin(dir);
    assert.equal(loaded.manifest.type, 'skill');
    assert.equal(loaded.pluginRoot, dir);
    assert.ok(loaded.manifestPath.endsWith('plugin.yaml'));
  });

  it('loads from a direct file path', async () => {
    const dir = join(root, 'file-plugin');
    await mkdir(dir, { recursive: true });
    const file = join(dir, 'plugin.yaml');
    await writeFile(
      file,
      `
id: "@owner/file-plugin"
version: "0.1.0"
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
trigger_patterns: [foo]
`,
    );
    const loaded = await loadPlugin(file);
    assert.equal(loaded.manifest.id, '@owner/file-plugin');
  });

  it('throws PluginLoadError on missing path', async () => {
    await assert.rejects(
      () => loadPlugin(join(root, 'does-not-exist')),
      (err: Error) =>
        err instanceof PluginLoadError && err.reason === 'not-found',
    );
  });

  it('throws PluginLoadError(manifest-invalid) on bad manifest', async () => {
    const dir = join(root, 'bad-plugin');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'plugin.yaml'),
      `
id: "@owner/bad-plugin"
version: "not-semver"
type: skill
`,
    );
    await assert.rejects(
      () => loadPlugin(dir),
      (err: Error) =>
        err instanceof PluginLoadError && err.reason === 'manifest-invalid',
    );
  });

  it('quiet=true suppresses warnings array', async () => {
    const dir = join(root, 'quiet-plugin');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'plugin.yaml'),
      `
id: not-conventional
version: "0.1.0"
type: skill
title: { zh: "X", en: "X" }
description: { zh: "X", en: "X" }
authors: [me]
license: MIT
required_capabilities: []
runtime: { kernel_version: "^2.0.0" }
trigger_patterns: [x]
`,
    );
    const loaded = await loadPlugin(dir, { quiet: true });
    assert.equal(loaded.warnings.length, 0);
  });
});
