// Phase 4 W1 ADR-0012 plugin install backend.
//
// Pure functions covering the install flow: turn a manifest +
// user-accepted capability subset into:
//   - a `plugin_install` PG row payload (host writes via drizzle)
//   - a sandbox descriptor (bwrap arg vector for Linux; placeholders for
//     macOS sandbox-exec / Windows AppContainer)
//   - a capability-prompt UI model (what to show the user before
//     accept-install)
//
// What this module does NOT do (host-side, deferred to apps/web):
//   - filesystem extraction of the plugin bundle
//   - actually spawning bwrap / mounting fs
//   - HTTPS proxy that enforces manifest network domain allow-list
//   - PG INSERT (host calls drizzle with the row payload returned here)
//
// All pure: input → deterministic output. No I/O. Easy to unit test.

import { createHash } from 'node:crypto';

import type { Capability } from '@collaborationtool/permissions';

import type { AgentManifest, PluginManifest } from './types';

// ---------- Capability prompt UI model ----------

/** A row in the capability prompt UI shown at install time. The user
 * may accept the whole set, accept partial, or reject install. */
export interface CapabilityPromptRow {
  capability: Capability;
  /** Human-readable explanation for the prompt UI. Bilingual. */
  explanation: { zh: string; en: string };
  /** Whether the plugin will fail to function if denied. UI shows a
   * warning when deny would brick it. */
  requiredForCore: boolean;
}

/** Default copy library — host overrides via i18n at call site. */
const CAPABILITY_COPY: Record<string, { zh: string; en: string }> = {
  'block.read': {
    zh: '读取你的文档块（plugin 必须看到内容才能工作）',
    en: 'Read your document blocks (plugin needs to see content to work)',
  },
  'block.propose': {
    zh: '提交修改建议（plugin 不能直接改，只能提议）',
    en: 'Propose edits (plugin cannot edit directly, only suggest)',
  },
  'annotation.create': {
    zh: '创建批注/评审（plugin 可以打标签 / 加 reviewer-note）',
    en: 'Create annotations / reviews',
  },
  'agent.invoke:citation': {
    zh: '调用引用 agent',
    en: 'Invoke the citation agent',
  },
  'agent.invoke:editor': {
    zh: '调用文本编辑 agent',
    en: 'Invoke the inline-editor agent',
  },
  'agent.invoke:reviewer': {
    zh: '调用 reviewer agent',
    en: 'Invoke the reviewer agent',
  },
  'agent.invoke:researcher': {
    zh: '调用 researcher agent',
    en: 'Invoke the researcher agent',
  },
  'agent.invoke:custom': {
    zh: '调用自定义 agent',
    en: 'Invoke custom agents',
  },
};

/** Build a CapabilityPromptRow[] from the manifest. Default
 * explanations come from CAPABILITY_COPY; unknown caps fall back to a
 * generic copy with the capability string verbatim. */
export function buildCapabilityPrompt(
  manifest: PluginManifest,
): CapabilityPromptRow[] {
  return manifest.requiredCapabilities.map((cap) => ({
    capability: cap,
    explanation: CAPABILITY_COPY[cap] ?? {
      zh: `允许 plugin 行使 capability: ${cap}`,
      en: `Allow the plugin to exercise capability: ${cap}`,
    },
    // For Phase 4 we treat all manifest-declared caps as core. A future
    // field on the manifest can mark optional caps once we encounter
    // plugins that actually use them.
    requiredForCore: true,
  }));
}

// ---------- Sandbox descriptor ----------

export type SandboxPlatform = 'linux' | 'macos' | 'windows';

/** A platform-specific sandbox descriptor. For Linux this carries the
 * bwrap argument vector ready for `child_process.spawn('bwrap', args)`.
 * macOS / Windows are Phase 5; we serialise their descriptors as a
 * structural placeholder so the PG row can carry data once those
 * platforms land. */
export type SandboxDescriptor =
  | LinuxBwrapDescriptor
  | MacOsSandboxExecDescriptor
  | WindowsAppContainerDescriptor;

export interface LinuxBwrapDescriptor {
  platform: 'linux';
  /** Argument vector passed to `bwrap` (Bubblewrap). The first arg is
   * NOT 'bwrap' — host adds the program name when spawning. */
  bwrapArgs: string[];
  /** Network egress whitelist (domains). Enforced by host HTTPS proxy
   * (Phase 4 W1 implementation; see ADR-0012 §2.2). */
  networkAllowDomains: string[];
}

export interface MacOsSandboxExecDescriptor {
  platform: 'macos';
  /** sandbox-exec profile body — Phase 5 W1 implements. */
  profile: string;
  networkAllowDomains: string[];
}

export interface WindowsAppContainerDescriptor {
  platform: 'windows';
  /** AppContainer SID + capability list — Phase 5 W1 implements. */
  appContainerName: string;
  capabilities: string[];
  networkAllowDomains: string[];
}

export interface BuildSandboxDescriptorInput {
  platform: SandboxPlatform;
  /** Absolute path on host filesystem the bundle is extracted to.
   * bwrap will bind-mount this read-only into the sandbox. */
  installPath: string;
  /** Network domain whitelist from the manifest (or empty). */
  networkAllowDomains: string[];
  /** Inherit Node binary path so the sandbox can run `node`. The host
   * usually passes `process.execPath`. */
  nodeBinaryPath: string;
  /** Inherit Node `node_modules` dir from host (read-only) so the
   * plugin's deps resolve. */
  nodeModulesPath: string;
}

/**
 * Linux bwrap arg builder. Read ADR-0012 §2.1 for the threat model.
 * Bind layout:
 *   - /usr (ro), /lib (ro), /lib64 (ro): system libraries
 *   - <nodeBinaryPath> (ro): the node binary itself
 *   - <nodeModulesPath> (ro): plugin deps
 *   - <installPath> (ro): plugin code
 *   - tmpfs at /tmp (writable, ephemeral)
 *   - --unshare-user / --unshare-pid / --unshare-ipc / --unshare-uts
 *   - --new-session: detach from host TTY
 *   - --die-with-parent: clean up on host exit (bwrap 0.5+)
 *   - No outbound network bind; host HTTPS proxy gates egress.
 */
export function buildLinuxBwrapArgs(
  input: BuildSandboxDescriptorInput,
): string[] {
  // Defensive: never emit args containing newlines or shell metas; the
  // installPath comes from PG and the host is supposed to validate it,
  // but we cheap-guard here.
  const safe = (s: string): string => {
    if (/\n|\r|\0/.test(s)) {
      throw new Error(
        `bwrap arg contains forbidden control char: ${JSON.stringify(s)}`,
      );
    }
    return s;
  };
  return [
    '--unshare-user',
    '--unshare-pid',
    '--unshare-ipc',
    '--unshare-uts',
    '--new-session',
    '--die-with-parent',
    // Read-only system bindings
    '--ro-bind', '/usr', '/usr',
    '--ro-bind', '/lib', '/lib',
    '--ro-bind-try', '/lib64', '/lib64',
    '--ro-bind-try', '/etc/ssl/certs', '/etc/ssl/certs',
    // Node + node_modules (read-only)
    '--ro-bind', safe(input.nodeBinaryPath), safe(input.nodeBinaryPath),
    '--ro-bind', safe(input.nodeModulesPath), safe(input.nodeModulesPath),
    // Plugin code (read-only)
    '--ro-bind', safe(input.installPath), safe(input.installPath),
    // Empty home + tmpfs scratch
    '--tmpfs', '/tmp',
    '--setenv', 'HOME', '/tmp',
    '--proc', '/proc',
    '--dev', '/dev',
    // Drop everything else
    '--clearenv',
    '--setenv', 'NODE_ENV', 'production',
    '--setenv', 'PATH', '/usr/bin:/usr/local/bin',
  ];
}

/**
 * Build a SandboxDescriptor for a target platform. Linux is fully
 * implemented; macOS / Windows return structured placeholders that the
 * host can persist; spawning will throw at runtime until Phase 5 W1.
 */
export function buildSandboxDescriptor(
  input: BuildSandboxDescriptorInput,
): SandboxDescriptor {
  if (input.platform === 'linux') {
    return {
      platform: 'linux',
      bwrapArgs: buildLinuxBwrapArgs(input),
      networkAllowDomains: [...input.networkAllowDomains],
    };
  }
  if (input.platform === 'macos') {
    return {
      platform: 'macos',
      profile: '(version 1)\n(deny default)\n; Phase 5 W1 implements',
      networkAllowDomains: [...input.networkAllowDomains],
    };
  }
  return {
    platform: 'windows',
    appContainerName: `collab-plugin-${input.installPath
      .replace(/[^a-zA-Z0-9]/g, '-')
      .slice(-32)}`,
    capabilities: [],
    networkAllowDomains: [...input.networkAllowDomains],
  };
}

// ---------- Install row payload (consumed by drizzle) ----------

export type PluginInstallOrigin = 'git-url' | 'local-path' | 'marketplace';
export type PluginInstallStatus = 'enabled' | 'disabled' | 'uninstalled';

export interface PluginInstallRowPayload {
  pluginManifestId: string;
  pluginKind: string;
  version: string;
  origin: PluginInstallOrigin;
  sourceUrl: string | null;
  installedBy: string;
  status: PluginInstallStatus;
  acceptedCapabilities: Capability[];
  installPath: string;
  sandboxDescriptor: SandboxDescriptor;
  bundleHashSha256: string;
}

export interface BuildInstallRowInput {
  manifest: PluginManifest;
  origin: PluginInstallOrigin;
  sourceUrl: string | null;
  installedBy: string;
  installPath: string;
  bundleBytes: Uint8Array | string;
  acceptedCapabilities: Capability[];
  sandboxPlatform: SandboxPlatform;
  nodeBinaryPath: string;
  nodeModulesPath: string;
}

export class InstallRejectedError extends Error {
  override name = 'InstallRejectedError';
  constructor(
    public readonly code:
      | 'capability-superset'
      | 'unsafe-source-url'
      | 'manifest-id-mismatch',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Validate user choices + build the row payload + sandbox descriptor.
 *
 * Throws InstallRejectedError if:
 *   - acceptedCapabilities contains a cap not in manifest
 *     (manifest is the bound; user can deny but not add)
 *   - origin='git-url' and sourceUrl doesn't start with `https://`
 *
 * Does NOT validate that the manifest itself is well-formed — that's
 * `parseManifest` upstream.
 */
export function buildInstallRowPayload(
  input: BuildInstallRowInput,
): PluginInstallRowPayload {
  const manifestCapSet = new Set(input.manifest.requiredCapabilities);
  for (const cap of input.acceptedCapabilities) {
    if (!manifestCapSet.has(cap)) {
      throw new InstallRejectedError(
        'capability-superset',
        `User-accepted capability '${cap}' not declared in manifest.requiredCapabilities`,
      );
    }
  }
  if (
    input.origin === 'git-url' &&
    (!input.sourceUrl || !input.sourceUrl.startsWith('https://'))
  ) {
    throw new InstallRejectedError(
      'unsafe-source-url',
      `git-url install requires sourceUrl to start with https:// (got ${
        input.sourceUrl ?? '<null>'
      })`,
    );
  }

  const networkAllowDomains: string[] =
    input.manifest.type === 'mcp-server' && 'allowedHosts' in input.manifest
      ? ((input.manifest as { allowedHosts?: string[] }).allowedHosts ?? [])
      : [];

  const sandbox = buildSandboxDescriptor({
    platform: input.sandboxPlatform,
    installPath: input.installPath,
    networkAllowDomains,
    nodeBinaryPath: input.nodeBinaryPath,
    nodeModulesPath: input.nodeModulesPath,
  });

  const bundleHash = sha256(input.bundleBytes);
  const pluginKind =
    input.manifest.type === 'agent'
      ? `agent:${(input.manifest as AgentManifest).kind}`
      : input.manifest.type;

  return {
    pluginManifestId: input.manifest.id,
    pluginKind,
    version: input.manifest.version,
    origin: input.origin,
    sourceUrl: input.sourceUrl,
    installedBy: input.installedBy,
    status: 'enabled',
    acceptedCapabilities: [...input.acceptedCapabilities],
    installPath: input.installPath,
    sandboxDescriptor: sandbox,
    bundleHashSha256: bundleHash,
  };
}

function sha256(input: Uint8Array | string): string {
  const h = createHash('sha256');
  h.update(input);
  return h.digest('hex');
}
