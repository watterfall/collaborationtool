// Parse + validate a plugin.yaml into a typed PluginManifest.
//
// Strict by default: shape errors throw `PluginManifestError`. Soft
// findings (capability outside ADR-0002 vocab; unknown tool form;
// kernelVersion mismatch) accumulate in `warnings` so the loader can
// surface them without rejecting an otherwise-loadable plugin.
//
// We use the `yaml` npm package rather than the minimal handwritten
// parser in skills-loader.ts because plugin manifests have nested
// objects (`runtime`, `quota`) and inline arrays. Once W2-W3 migrates
// SKILL.md frontmatter through this same parser, skills-loader's
// minimal parser is retired (ADR-0010 §2.4).

import { parse as parseYaml } from 'yaml';

import {
  CAPABILITY_SET,
  type Capability,
  isCapability,
} from '@collaborationtool/permissions';

import type {
  AgentManifest,
  BasePluginManifest,
  BilingualString,
  LoadedPlugin,
  McpServerManifest,
  PluginKind,
  PluginManifest,
  SkillManifest,
  UiPanelManifest,
} from './types';

const PLUGIN_KINDS: ReadonlySet<PluginKind> = new Set([
  'skill',
  'agent',
  'mcp-server',
  'ui-panel',
]);

const AGENT_KINDS = new Set<AgentManifest['kind']>([
  'editor',
  'citation',
  'reviewer',
  'researcher',
  'coordinator',
  'custom',
]);

const TRANSPORTS = new Set<McpServerManifest['transport']>([
  'stdio',
  'http',
  'http-sse',
]);

const MOUNT_POINTS = new Set<UiPanelManifest['mountPoint']>([
  'sidebar',
  'drawer',
  'inspector',
]);

const RUNTIME_TARGETS = new Set<BasePluginManifest['runtime']['target']>([
  'node',
  'wasm',
  'webcontainer',
]);

export class PluginManifestError extends Error {
  override name = 'PluginManifestError';
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
  }
}

export interface ParseOptions {
  /** Manifest source path, used in error messages. Required for clear
   * diagnostics; the loader passes the absolute path of plugin.yaml. */
  sourcePath: string;
}

/** Parse a YAML string into a typed manifest with warnings. Throws
 * `PluginManifestError` on shape violations. */
export function parseManifest(
  yamlText: string,
  options: ParseOptions,
): { manifest: PluginManifest; warnings: string[] } {
  const { sourcePath } = options;
  const warnings: string[] = [];

  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (cause) {
    throw new PluginManifestError(
      sourcePath,
      `YAML parse error: ${(cause as Error).message}`,
    );
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PluginManifestError(
      sourcePath,
      'manifest root must be a YAML mapping',
    );
  }

  const obj = raw as Record<string, unknown>;
  const base = parseBase(obj, sourcePath, warnings);

  let manifest: PluginManifest;
  switch (base.type) {
    case 'skill':
      manifest = parseSkill(obj, base, sourcePath, warnings);
      break;
    case 'agent':
      manifest = parseAgent(obj, base, sourcePath, warnings);
      break;
    case 'mcp-server':
      manifest = parseMcpServer(obj, base, sourcePath, warnings);
      break;
    case 'ui-panel':
      manifest = parseUiPanel(obj, base, sourcePath, warnings);
      break;
  }

  return { manifest, warnings };
}

// ---------- Base ----------

function parseBase(
  obj: Record<string, unknown>,
  path: string,
  warnings: string[],
): BasePluginManifest {
  const id = requireString(obj, 'id', path);
  if (!/^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(id)) {
    warnings.push(
      `id '${id}' does not match the conventional @owner/name form (ADR-0010 §5)`,
    );
  }

  const version = requireString(obj, 'version', path);
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new PluginManifestError(
      path,
      `version '${version}' is not SemVer-shaped`,
    );
  }

  const typeRaw = requireString(obj, 'type', path);
  if (!PLUGIN_KINDS.has(typeRaw as PluginKind)) {
    throw new PluginManifestError(
      path,
      `type must be one of ${[...PLUGIN_KINDS].join(', ')}; got '${typeRaw}'`,
    );
  }
  const type = typeRaw as PluginKind;

  const title = requireBilingual(obj, 'title', path);
  const description = requireBilingual(obj, 'description', path);

  const authors = requireStringArray(obj, 'authors', path);
  if (authors.length === 0) {
    throw new PluginManifestError(path, 'authors must be non-empty');
  }

  const license = requireString(obj, 'license', path);
  const homepage = optionalString(obj, 'homepage');

  const requiredCapabilitiesRaw = requireStringArray(
    obj,
    'required_capabilities',
    path,
  );
  const requiredCapabilities: Capability[] = [];
  for (const cap of requiredCapabilitiesRaw) {
    if (isCapability(cap)) {
      requiredCapabilities.push(cap);
    } else {
      warnings.push(
        `required_capabilities '${cap}' is not in the ADR-0002 36 vocabulary (CAPABILITY_SET size: ${CAPABILITY_SET.size}). Plugin install will require an ADR amendment.`,
      );
    }
  }

  const providesCapabilities = optionalStringArray(obj, 'provides_capabilities');

  const runtimeRaw = obj['runtime'];
  if (runtimeRaw === null || typeof runtimeRaw !== 'object' || Array.isArray(runtimeRaw)) {
    throw new PluginManifestError(path, 'runtime must be a mapping');
  }
  const runtimeObj = runtimeRaw as Record<string, unknown>;
  const kernelVersion = requireString(runtimeObj, 'kernel_version', path);
  const targetRaw = optionalString(runtimeObj, 'target') ?? 'node';
  if (!RUNTIME_TARGETS.has(targetRaw as BasePluginManifest['runtime']['target'])) {
    throw new PluginManifestError(
      path,
      `runtime.target must be one of ${[...RUNTIME_TARGETS].join(', ')}; got '${targetRaw}'`,
    );
  }
  if (targetRaw !== 'node') {
    warnings.push(
      `runtime.target '${targetRaw}' is Phase 3+ (per ADR-0010 §2.6); Phase 2 will not load it`,
    );
  }
  const nodeRange = optionalString(runtimeObj, 'node');

  return {
    id,
    version,
    type,
    title,
    description,
    authors,
    license,
    ...(homepage !== undefined ? { homepage } : {}),
    requiredCapabilities,
    providesCapabilities,
    runtime: {
      kernelVersion,
      target: targetRaw as BasePluginManifest['runtime']['target'],
      ...(nodeRange !== undefined ? { nodeRange } : {}),
    },
  };
}

// ---------- Kind extensions ----------

function parseSkill(
  obj: Record<string, unknown>,
  base: BasePluginManifest,
  path: string,
  warnings: string[],
): SkillManifest {
  const triggerPatternsRaw = obj['trigger_patterns'];
  const triggerPatterns: Array<string | { readonly regex: string }> = [];
  if (triggerPatternsRaw !== undefined) {
    if (!Array.isArray(triggerPatternsRaw)) {
      throw new PluginManifestError(path, 'trigger_patterns must be an array');
    }
    for (const item of triggerPatternsRaw) {
      if (typeof item === 'string') {
        triggerPatterns.push(item);
      } else if (
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof (item as Record<string, unknown>)['regex'] === 'string'
      ) {
        triggerPatterns.push({
          regex: (item as Record<string, string>)['regex'] as string,
        });
      } else {
        throw new PluginManifestError(
          path,
          'trigger_patterns items must be strings or { regex: string }',
        );
      }
    }
  } else {
    warnings.push(
      'skill has no trigger_patterns — dispatcher will only load it via explicit user/agent reference',
    );
  }

  const matchAll = optionalBoolean(obj, 'match_all') ?? false;
  const providesTools = optionalStringArray(obj, 'provides_tools');
  const allowedMcpServers = optionalStringArray(obj, 'allowed_mcp_servers');
  const nestedSkills = optionalStringArray(obj, 'nested_skills');

  return {
    ...base,
    type: 'skill',
    triggerPatterns,
    matchAll,
    providesTools,
    allowedMcpServers,
    nestedSkills,
  };
}

function parseAgent(
  obj: Record<string, unknown>,
  base: BasePluginManifest,
  path: string,
  warnings: string[],
): AgentManifest {
  const kindRaw = requireString(obj, 'kind', path);
  if (!AGENT_KINDS.has(kindRaw as AgentManifest['kind'])) {
    throw new PluginManifestError(
      path,
      `agent kind must be one of ${[...AGENT_KINDS].join(', ')}; got '${kindRaw}'`,
    );
  }
  const kind = kindRaw as AgentManifest['kind'];

  const promptTemplate = requireString(obj, 'prompt_template', path);
  const tools = optionalStringArray(obj, 'tools');
  const runtimeModeRaw = optionalString(obj, 'runtime_mode') ?? 'propose';
  if (runtimeModeRaw !== 'propose' && runtimeModeRaw !== 'autonomous') {
    throw new PluginManifestError(
      path,
      `runtime_mode must be 'propose' or 'autonomous'; got '${runtimeModeRaw}'`,
    );
  }
  const runtimeMode = runtimeModeRaw as AgentManifest['runtimeMode'];
  if (runtimeMode === 'autonomous') {
    warnings.push(
      "runtime_mode 'autonomous' requires explicit user authorisation per ADR-0002 role 5; install flow must surface this",
    );
  }

  const quotaRaw = obj['quota'];
  const quota: AgentManifest['quota'] = {};
  if (quotaRaw !== undefined) {
    if (quotaRaw === null || typeof quotaRaw !== 'object' || Array.isArray(quotaRaw)) {
      throw new PluginManifestError(path, 'quota must be a mapping');
    }
    const q = quotaRaw as Record<string, unknown>;
    const daily = optionalNumber(q, 'daily_invocations');
    const timeout = optionalNumber(q, 'timeout_seconds');
    if (daily !== undefined) quota.dailyInvocations = daily;
    if (timeout !== undefined) quota.timeoutSeconds = timeout;
  }

  // Phase 4 W2 ADR-0013 §2.5: prefers_provider (optional)
  let prefersProvider: AgentManifest['prefersProvider'];
  const prefersRaw = obj['prefers_provider'];
  if (prefersRaw !== undefined) {
    if (
      prefersRaw === null ||
      typeof prefersRaw !== 'object' ||
      Array.isArray(prefersRaw)
    ) {
      throw new PluginManifestError(
        path,
        'prefers_provider must be a mapping when set',
      );
    }
    const p = prefersRaw as Record<string, unknown>;
    const wf = requireString(p, 'wire_format', path);
    if (
      wf !== 'anthropic' &&
      wf !== 'openai-compat' &&
      wf !== 'ollama' &&
      wf !== 'custom-http'
    ) {
      throw new PluginManifestError(
        path,
        `prefers_provider.wire_format must be one of anthropic|openai-compat|ollama|custom-http; got '${wf}'`,
      );
    }
    prefersProvider = {
      wireFormat: wf,
      ...(optionalString(p, 'model_id') !== undefined
        ? { modelId: optionalString(p, 'model_id')! }
        : {}),
      ...(optionalString(p, 'rationale') !== undefined
        ? { rationale: optionalString(p, 'rationale')! }
        : {}),
    };
  }

  return {
    ...base,
    type: 'agent',
    kind,
    promptTemplate,
    tools,
    runtimeMode,
    quota,
    ...(prefersProvider !== undefined ? { prefersProvider } : {}),
  };
}

function parseMcpServer(
  obj: Record<string, unknown>,
  base: BasePluginManifest,
  path: string,
  warnings: string[],
): McpServerManifest {
  const transportRaw = requireString(obj, 'transport', path);
  if (!TRANSPORTS.has(transportRaw as McpServerManifest['transport'])) {
    throw new PluginManifestError(
      path,
      `transport must be one of ${[...TRANSPORTS].join(', ')}; got '${transportRaw}'`,
    );
  }
  const transport = transportRaw as McpServerManifest['transport'];

  const result: McpServerManifest = {
    ...base,
    type: 'mcp-server',
    transport,
    envVarsRequired: optionalStringArray(obj, 'env_vars_required'),
    declaresTools: optionalStringArray(obj, 'declares_tools'),
  };

  if (transport === 'stdio') {
    const command = optionalStringArray(obj, 'command');
    if (command.length === 0) {
      throw new PluginManifestError(
        path,
        "transport 'stdio' requires non-empty command",
      );
    }
    result.command = command;
    const args = optionalStringArray(obj, 'args');
    if (args.length > 0) result.args = args;
    const cwd = optionalString(obj, 'cwd');
    if (cwd !== undefined) result.cwd = cwd;
  } else {
    const url = optionalString(obj, 'url');
    if (!url) {
      throw new PluginManifestError(
        path,
        `transport '${transport}' requires url`,
      );
    }
    result.url = url;
    warnings.push(
      `transport '${transport}' is Phase 3+ (per ADR-0006 §2.3); Phase 2 will not exercise it`,
    );
  }

  return result;
}

function parseUiPanel(
  obj: Record<string, unknown>,
  base: BasePluginManifest,
  path: string,
  warnings: string[],
): UiPanelManifest {
  const mountPointRaw = requireString(obj, 'mount_point', path);
  if (!MOUNT_POINTS.has(mountPointRaw as UiPanelManifest['mountPoint'])) {
    throw new PluginManifestError(
      path,
      `mount_point must be one of ${[...MOUNT_POINTS].join(', ')}; got '${mountPointRaw}'`,
    );
  }
  const mountPoint = mountPointRaw as UiPanelManifest['mountPoint'];

  const entry = requireString(obj, 'entry', path);
  const postMessageProtocolVersion = optionalNumber(
    obj,
    'post_message_protocol_version',
  );
  if (postMessageProtocolVersion === undefined) {
    throw new PluginManifestError(
      path,
      'ui-panel requires post_message_protocol_version (number)',
    );
  }
  if (postMessageProtocolVersion !== 1) {
    warnings.push(
      `ui-panel post_message_protocol_version=${postMessageProtocolVersion} is unrecognised; Phase 2 only declares v1`,
    );
  }

  warnings.push(
    'ui-panel plugins are declared but not loaded in Phase 2 (per ADR-0010 §2.6); manifest validation only',
  );

  return {
    ...base,
    type: 'ui-panel',
    mountPoint,
    entry,
    postMessageProtocolVersion,
  };
}

// ---------- Field helpers ----------

function requireString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new PluginManifestError(
      path,
      `field '${key}' must be a non-empty string`,
    );
  }
  return v;
}

function optionalString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  return v.length === 0 ? undefined : v;
}

function optionalNumber(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return v;
}

function optionalBoolean(
  obj: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const v = obj[key];
  if (typeof v !== 'boolean') return undefined;
  return v;
}

function requireStringArray(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): string[] {
  const v = obj[key];
  if (!Array.isArray(v)) {
    throw new PluginManifestError(path, `field '${key}' must be an array`);
  }
  for (const item of v) {
    if (typeof item !== 'string') {
      throw new PluginManifestError(
        path,
        `field '${key}' items must all be strings`,
      );
    }
  }
  return [...(v as string[])];
}

function optionalStringArray(
  obj: Record<string, unknown>,
  key: string,
): string[] {
  const v = obj[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === 'string');
}

function requireBilingual(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): BilingualString {
  const v = obj[key];
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new PluginManifestError(
      path,
      `field '${key}' must be an object with at least one of { zh, en }`,
    );
  }
  const inner = v as Record<string, unknown>;
  const zh = typeof inner['zh'] === 'string' ? (inner['zh'] as string) : '';
  const en = typeof inner['en'] === 'string' ? (inner['en'] as string) : '';
  if (zh.length === 0 && en.length === 0) {
    throw new PluginManifestError(
      path,
      `field '${key}' must have at least one of zh / en non-empty (bilingual parity, ADR-0010 §2.3)`,
    );
  }
  // Mirror missing side from present side so consumers can read either
  // without falling back logic. Logged as warning by the caller.
  return { zh: zh || en, en: en || zh };
}

// Re-export for convenience.
export type { LoadedPlugin };
