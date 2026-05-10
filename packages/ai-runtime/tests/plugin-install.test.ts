// Phase 4 W1 ADR-0012 plugin install backend tests.
// Pure functions; no I/O, no PG, no bwrap actually spawned.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Capability } from '@collaborationtool/permissions';

import {
  buildCapabilityPrompt,
  buildInstallRowPayload,
  buildLinuxBwrapArgs,
  buildSandboxDescriptor,
  InstallRejectedError,
  type AgentManifest,
  type PluginManifest,
} from '../src/plugins';

const FAKE_AGENT_MANIFEST: AgentManifest = {
  id: '@third-party/test-agent',
  version: '0.0.1',
  type: 'agent',
  title: { zh: '测试 agent', en: 'Test agent' },
  description: { zh: '测试用', en: 'For tests' },
  authors: ['@example'],
  license: 'MIT',
  requiredCapabilities: ['block.read', 'block.propose'],
  providesCapabilities: [],
  runtime: { kernelVersion: '^2.0.0', target: 'node', nodeRange: '>=20' },
  kind: 'custom',
  promptTemplate: './prompt.md',
  tools: [],
  runtimeMode: 'propose',
  quota: {},
};

describe('buildCapabilityPrompt', () => {
  it('emits one row per manifest required_capability', () => {
    const rows = buildCapabilityPrompt(FAKE_AGENT_MANIFEST);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.capability, 'block.read');
    assert.equal(rows[1]!.capability, 'block.propose');
    // copy library covers these — should not be the generic fallback
    assert.match(rows[0]!.explanation.en, /Read your document blocks/);
    assert.match(rows[1]!.explanation.en, /Propose edits/);
  });

  it('falls back to generic copy for unknown capabilities', () => {
    const m: PluginManifest = {
      ...FAKE_AGENT_MANIFEST,
      requiredCapabilities: ['weird.unknown.cap' as never],
    };
    const rows = buildCapabilityPrompt(m);
    assert.match(rows[0]!.explanation.en, /Allow the plugin/);
    assert.match(rows[0]!.explanation.en, /weird\.unknown\.cap/);
  });
});

describe('buildLinuxBwrapArgs', () => {
  it('contains required isolation flags', () => {
    const args = buildLinuxBwrapArgs({
      platform: 'linux',
      installPath: '/var/lib/collab/plugins/abc',
      networkAllowDomains: [],
      nodeBinaryPath: '/usr/bin/node',
      nodeModulesPath: '/var/lib/collab/node_modules',
    });
    for (const flag of [
      '--unshare-user',
      '--unshare-pid',
      '--unshare-ipc',
      '--unshare-uts',
      '--new-session',
      '--die-with-parent',
      '--clearenv',
    ]) {
      assert.ok(args.includes(flag), `missing ${flag}`);
    }
  });

  it('binds plugin install path read-only', () => {
    const args = buildLinuxBwrapArgs({
      platform: 'linux',
      installPath: '/srv/p1',
      networkAllowDomains: [],
      nodeBinaryPath: '/usr/bin/node',
      nodeModulesPath: '/var/nm',
    });
    // bwrap pattern: [--ro-bind, src, dst]; installPath appears as both src + dst.
    const occurrences = args.reduce(
      (acc, a, i) => (a === '/srv/p1' ? [...acc, i] : acc),
      [] as number[],
    );
    assert.equal(occurrences.length, 2, 'installPath should appear as src+dst');
    assert.equal(args[occurrences[0]! - 1], '--ro-bind');
  });

  it('rejects control chars in paths (defense-in-depth)', () => {
    assert.throws(
      () =>
        buildLinuxBwrapArgs({
          platform: 'linux',
          installPath: '/tmp/evil\npath',
          networkAllowDomains: [],
          nodeBinaryPath: '/usr/bin/node',
          nodeModulesPath: '/var/nm',
        }),
      /forbidden control char/,
    );
  });
});

describe('buildSandboxDescriptor', () => {
  it('returns linux bwrap descriptor on platform=linux', () => {
    const d = buildSandboxDescriptor({
      platform: 'linux',
      installPath: '/srv/p',
      networkAllowDomains: ['api.crossref.org'],
      nodeBinaryPath: '/usr/bin/node',
      nodeModulesPath: '/srv/nm',
    });
    assert.equal(d.platform, 'linux');
    assert.deepEqual(d.networkAllowDomains, ['api.crossref.org']);
    if (d.platform === 'linux') {
      assert.ok(d.bwrapArgs.length > 10);
    }
  });

  it('returns macos placeholder', () => {
    const d = buildSandboxDescriptor({
      platform: 'macos',
      installPath: '/srv/p',
      networkAllowDomains: [],
      nodeBinaryPath: '/usr/bin/node',
      nodeModulesPath: '/srv/nm',
    });
    assert.equal(d.platform, 'macos');
    if (d.platform === 'macos') {
      assert.match(d.profile, /Phase 5 W1 implements/);
    }
  });

  it('returns windows placeholder with sanitised name', () => {
    const d = buildSandboxDescriptor({
      platform: 'windows',
      installPath: 'C:\\plugins\\third-party\\x',
      networkAllowDomains: [],
      nodeBinaryPath: 'C:\\node\\node.exe',
      nodeModulesPath: 'C:\\node\\node_modules',
    });
    assert.equal(d.platform, 'windows');
    if (d.platform === 'windows') {
      assert.match(d.appContainerName, /^collab-plugin-/);
      // No backslashes / colons in the AppContainer name
      assert.doesNotMatch(d.appContainerName, /[\\:]/);
    }
  });
});

describe('buildInstallRowPayload', () => {
  const baseInput = {
    manifest: FAKE_AGENT_MANIFEST,
    origin: 'git-url' as const,
    sourceUrl: 'https://github.com/example/test-agent',
    installedBy: 'principal:user-1',
    installPath: '/srv/p',
    bundleBytes: new Uint8Array([1, 2, 3, 4]),
    acceptedCapabilities: ['block.read', 'block.propose'] as Capability[],
    sandboxPlatform: 'linux' as const,
    nodeBinaryPath: '/usr/bin/node',
    nodeModulesPath: '/srv/nm',
  };

  it('builds payload for valid input', () => {
    const row = buildInstallRowPayload(baseInput);
    assert.equal(row.pluginManifestId, '@third-party/test-agent');
    assert.equal(row.pluginKind, 'agent:custom');
    assert.equal(row.origin, 'git-url');
    assert.equal(row.status, 'enabled');
    assert.equal(row.bundleHashSha256.length, 64);
    assert.match(row.bundleHashSha256, /^[0-9a-f]{64}$/);
    assert.equal(row.sandboxDescriptor.platform, 'linux');
  });

  it('rejects accepted-capability not in manifest (no privilege escalation)', () => {
    assert.throws(
      () =>
        buildInstallRowPayload({
          ...baseInput,
          acceptedCapabilities: [
            'block.read',
            'annotation.create', // not in manifest
          ] as Capability[],
        }),
      (e: Error) =>
        e instanceof InstallRejectedError && e.code === 'capability-superset',
    );
  });

  it('rejects http:// git-url (https-only enforced)', () => {
    assert.throws(
      () =>
        buildInstallRowPayload({
          ...baseInput,
          sourceUrl: 'http://example.com/repo',
        }),
      (e: Error) =>
        e instanceof InstallRejectedError && e.code === 'unsafe-source-url',
    );
  });

  it('hash is deterministic across identical bundles', () => {
    const a = buildInstallRowPayload(baseInput);
    const b = buildInstallRowPayload({
      ...baseInput,
      installPath: '/srv/q',
    });
    assert.equal(a.bundleHashSha256, b.bundleHashSha256);
  });

  it('hash differs across different bundles', () => {
    const a = buildInstallRowPayload(baseInput);
    const b = buildInstallRowPayload({
      ...baseInput,
      bundleBytes: new Uint8Array([9, 9, 9, 9]),
    });
    assert.notEqual(a.bundleHashSha256, b.bundleHashSha256);
  });
});
