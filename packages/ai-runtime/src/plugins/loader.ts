// Plugin loader — read a plugin from a filesystem path, parse + validate
// its manifest, return a `LoadedPlugin`.
//
// This is the W1-末 skeleton per ADR-0010 §2.7 step 1. W2-W3 will:
//   (a) wire `loadPlugin` into ai-runtime/agent-runner.ts so the runner
//       resolves agent + skill plugins through this path
//   (b) extract `packages/ai-runtime/src/agents/citation.ts` into a
//       plugin form `plugins/citation-agent/{plugin.yaml, agent.ts,
//       prompt.md}` and prove dogfood gate (ADR-0010 §2.7)
//
// What this skeleton intentionally does NOT do:
//   - resolve dependencies between plugins (Phase 3)
//   - sandbox / isolate plugin code execution (Phase 3)
//   - download from Git URL (only filesystem paths in Phase 2 W1)
//   - parse SKILL.md frontmatter as a manifest (Phase 2 W2-W3 migration)

import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseManifest, PluginManifestError } from './manifest';
import type {
  AgentManifest,
  AgentPluginModule,
  LoadedAgentPlugin,
  LoadedPlugin,
} from './types';

/** Manifest filename. SKILL.md frontmatter is also a valid source after
 * Phase 2 W2-W3 migration; that path lives in skills-loader.ts. */
export const MANIFEST_FILENAME = 'plugin.yaml';

export class PluginLoadError extends Error {
  override name = 'PluginLoadError';
  constructor(
    public readonly pluginRoot: string,
    public readonly reason: 'not-found' | 'manifest-invalid' | 'io',
    message: string,
  ) {
    super(message);
  }
}

export interface LoadOptions {
  /** Skip warnings collection (useful in tight loops; default false). */
  quiet?: boolean;
}

/**
 * Load a plugin from a filesystem path. The path may point at the
 * plugin root directory OR directly at the plugin.yaml — we accept both.
 */
export async function loadPlugin(
  pathInput: string,
  options: LoadOptions = {},
): Promise<LoadedPlugin> {
  const absolute = isAbsolute(pathInput) ? pathInput : resolve(pathInput);
  const { manifestPath, pluginRoot } = await resolveManifestPath(absolute);

  let yamlText: string;
  try {
    yamlText = await readFile(manifestPath, 'utf8');
  } catch (cause) {
    throw new PluginLoadError(
      pluginRoot,
      'io',
      `failed to read manifest at ${manifestPath}: ${(cause as Error).message}`,
    );
  }

  let parsed: ReturnType<typeof parseManifest>;
  try {
    parsed = parseManifest(yamlText, { sourcePath: manifestPath });
  } catch (err) {
    if (err instanceof PluginManifestError) {
      throw new PluginLoadError(pluginRoot, 'manifest-invalid', err.message);
    }
    throw err;
  }

  return {
    manifest: parsed.manifest,
    manifestPath,
    pluginRoot,
    warnings: options.quiet === true ? [] : parsed.warnings,
  };
}

/**
 * Load an agent plugin: read manifest, validate `type === 'agent'`,
 * dynamic-import the module from `pluginRoot/<entry>` (default
 * `agent.ts` resolved through Node ESM + tsx for built-ins; `agent.js`
 * for compiled distributions). Verify the module exports a `runAgent`
 * function — the AgentPluginModule contract.
 *
 * The host then calls `module.runAgent(input)` with pre-resolved
 * skill / MCP / LLM client. See ADR-0010 §2.7.
 */
export async function loadAgentPlugin(
  pathInput: string,
  options: LoadOptions = {},
): Promise<LoadedAgentPlugin> {
  const loaded = await loadPlugin(pathInput, options);
  if (loaded.manifest.type !== 'agent') {
    throw new PluginLoadError(
      loaded.pluginRoot,
      'manifest-invalid',
      `loadAgentPlugin: manifest.type is '${loaded.manifest.type}', expected 'agent'`,
    );
  }
  const manifest = loaded.manifest as AgentManifest;

  // Resolve module entry. Phase 2 W2 convention: plugin root contains
  // `agent.ts` (built-in) or `agent.js` (compiled). We let Node's
  // ESM resolver figure it out; if there's a package.json with
  // `"main"` / `"exports"`, that takes precedence.
  const entry = await resolveAgentEntry(loaded.pluginRoot);

  let mod: unknown;
  try {
    mod = await import(pathToFileURL(entry).href);
  } catch (cause) {
    throw new PluginLoadError(
      loaded.pluginRoot,
      'io',
      `failed to import agent module ${entry}: ${(cause as Error).message}`,
    );
  }

  if (
    mod === null ||
    typeof mod !== 'object' ||
    typeof (mod as Record<string, unknown>)['runAgent'] !== 'function'
  ) {
    throw new PluginLoadError(
      loaded.pluginRoot,
      'manifest-invalid',
      `agent module ${entry} must export a runAgent(input) function (AgentPluginModule contract)`,
    );
  }

  const module: AgentPluginModule = {
    runAgent: (mod as { runAgent: AgentPluginModule['runAgent'] }).runAgent,
  };

  return { ...loaded, manifest, module };
}

async function resolveAgentEntry(pluginRoot: string): Promise<string> {
  // Try package.json first (workspace-package style — matches our
  // plugins/citation-agent layout).
  const pkgPath = resolve(pluginRoot, 'package.json');
  try {
    const text = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(text) as { main?: string };
    if (typeof pkg.main === 'string' && pkg.main.length > 0) {
      return resolve(pluginRoot, pkg.main);
    }
  } catch {
    // No package.json (or unreadable) — fall through to convention.
  }
  // Convention: <root>/agent.ts (built-in tsx) or <root>/agent.js
  // (compiled distribution). Try .ts first since built-ins are
  // common in workspace dev.
  for (const candidate of ['agent.ts', 'agent.js']) {
    const p = resolve(pluginRoot, candidate);
    try {
      await stat(p);
      return p;
    } catch {
      /* try next */
    }
  }
  throw new PluginLoadError(
    pluginRoot,
    'not-found',
    `agent entry not found: tried package.json#main, agent.ts, agent.js in ${pluginRoot}`,
  );
}

/** Resolve the input path to the manifest file. Accepts either the
 * plugin root or the manifest itself. */
async function resolveManifestPath(absolute: string): Promise<{
  manifestPath: string;
  pluginRoot: string;
}> {
  let s;
  try {
    s = await stat(absolute);
  } catch {
    throw new PluginLoadError(
      absolute,
      'not-found',
      `path does not exist: ${absolute}`,
    );
  }
  if (s.isDirectory()) {
    return {
      manifestPath: resolve(absolute, MANIFEST_FILENAME),
      pluginRoot: absolute,
    };
  }
  if (s.isFile()) {
    return {
      manifestPath: absolute,
      pluginRoot: dirname(absolute),
    };
  }
  throw new PluginLoadError(
    absolute,
    'not-found',
    `path is neither file nor directory: ${absolute}`,
  );
}
