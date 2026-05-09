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

import { parseManifest, PluginManifestError } from './manifest';
import type { LoadedPlugin } from './types';

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
