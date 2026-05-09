// Plugin manifest types per ADR-0010 §2.3.
//
// Four plugin kinds share a base manifest; each kind extends the base
// with kind-specific fields. The base + extensions are loaded from
// plugin.yaml at the plugin root (or SKILL.md frontmatter for skills,
// per ADR-0010 §2.4 — that migration is Phase 2 W2-W3).
//
// Validation rules live in `manifest.ts`; this file only defines shapes.

import type { Capability } from '@collaborationtool/permissions';

/** Kinds enumerated by ADR-0010 §2.2. We deliberately do NOT add 5/6
 * for "Template" / "Export-format" — those are special cases of Skill /
 * Agent (resources-only / pure function), not new types. */
export type PluginKind = 'skill' | 'agent' | 'mcp-server' | 'ui-panel';

/** Bilingual i18n string. Either form may be a non-empty string; loader
 * fills the missing side from the present side at validation time
 * (`{ zh: '...' }` becomes `{ zh: '...', en: '...' }` with en === zh). */
export interface BilingualString {
  zh: string;
  en: string;
}

/** Base manifest fields shared by all plugin kinds. */
export interface BasePluginManifest {
  /** Globally unique id, conventional form `@owner/name` (ADR-0010 §5). */
  id: string;
  /** SemVer. */
  version: string;
  type: PluginKind;
  title: BilingualString;
  description: BilingualString;
  authors: string[];
  license: string;
  homepage?: string;
  /** Caller-side capability requirements; must be a subset of ADR-0002
   * 36 vocabulary (per `@collaborationtool/permissions` CAPABILITY_SET).
   * User authorises these on install. */
  requiredCapabilities: Capability[];
  /** Capabilities this plugin itself contributes (Phase 3 — empty in
   * Phase 2 since no plugin synthesises new capability words yet). */
  providesCapabilities: string[];
  /** Runtime constraints. */
  runtime: {
    /** SemVer range against the platform kernel version. */
    kernelVersion: string;
    /** Phase 2 always 'node'; Phase 3 evaluates 'wasm' / 'webcontainer'
     * (per ADR-0010 §2.6). */
    target: 'node' | 'wasm' | 'webcontainer';
    nodeRange?: string;
  };
}

/** Skill — natural-language definition + resources, AI-loaded on demand
 * (ADR-0010 §2.4). */
export interface SkillManifest extends BasePluginManifest {
  type: 'skill';
  /** Patterns the dispatcher matches against task context to recall
   * candidate skills. Either keyword strings or `{ regex }` objects;
   * matched as OR by default, AND if `matchAll: true`. */
  triggerPatterns: ReadonlyArray<string | { readonly regex: string }>;
  /** OR vs AND for trigger_patterns (default OR; ADR-0010 §5). */
  matchAll: boolean;
  /** Tools the agent can invoke when this skill is loaded. Tool ids
   * follow the form `<source>:<id>` — currently `mcp:<server>:<tool>`
   * or `builtin:<id>` (ADR-0010 §2.3 Agent example). */
  providesTools: string[];
  /** Whitelist of MCP servers this skill is allowed to invoke. Resolved
   * against `mcp_server` table at runtime per ADR-0006 §2.2. */
  allowedMcpServers: string[];
  /** Other skill ids this skill imports as nested context (Phase 3). */
  nestedSkills: string[];
}

/** Agent — TypeScript module + manifest + prompt + tool references. */
export interface AgentManifest extends BasePluginManifest {
  type: 'agent';
  /** ADR-0001 agent_kind enum; new kinds (`reviewer`, `researcher`)
   * land in Phase 2 via ADR-0008. */
  kind: 'editor' | 'citation' | 'reviewer' | 'researcher' | 'coordinator' | 'custom';
  /** Path to the prompt template file relative to plugin root. The
   * loader hashes its contents to derive `promptTemplateId` for
   * Provenance (ADR-0001 §2.3.7). */
  promptTemplate: string;
  /** Tools available to the agent. Must be a subset of the union of
   * `providesTools` from skills the agent loads + `builtin:*` tools. */
  tools: string[];
  /** ADR-0002 role 4 (propose) vs role 5 (autonomous). Default propose. */
  runtimeMode: 'propose' | 'autonomous';
  /** Optional per-invocation quotas. */
  quota: {
    dailyInvocations?: number;
    timeoutSeconds?: number;
  };
}

/** MCP server — independent process speaking the MCP protocol. The
 * registry table (ADR-0006) is the source of truth at runtime; this
 * manifest is what the install flow reads to populate it. */
export interface McpServerManifest extends BasePluginManifest {
  type: 'mcp-server';
  transport: 'stdio' | 'http' | 'http-sse';
  /** stdio only: command argv. */
  command?: string[];
  args?: string[];
  cwd?: string;
  /** http / http-sse only. */
  url?: string;
  envVarsRequired: string[];
  /** Statically declared tool names; runtime cross-checks via
   * `tools/list`. Drift = warning. */
  declaresTools: string[];
}

/** UI Panel — iframe-mounted plugin, postMessage capability bus
 * (ADR-0010 §2.6 Figma model). Phase 2 only declared; runtime mounting
 * is Phase 3. */
export interface UiPanelManifest extends BasePluginManifest {
  type: 'ui-panel';
  mountPoint: 'sidebar' | 'drawer' | 'inspector';
  /** Path to the panel's HTML entry, relative to plugin root. */
  entry: string;
  postMessageProtocolVersion: number;
}

/** Discriminated union over the 4 kinds. */
export type PluginManifest =
  | SkillManifest
  | AgentManifest
  | McpServerManifest
  | UiPanelManifest;

/** A loaded plugin, including the absolute path the manifest was read
 * from and any non-fatal warnings flagged at validation time. The
 * dispatcher consumes this; it never re-reads the file. */
export interface LoadedPlugin {
  manifest: PluginManifest;
  manifestPath: string;
  pluginRoot: string;
  /** Non-fatal validation findings. Common cases: capability outside
   * ADR-0002 vocab (e.g. ADR-0006's candidate `mcp.install`), unknown
   * tool form, kernelVersion mismatch with current kernel. */
  warnings: string[];
}
