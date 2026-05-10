// Phase 2.5 ADR-0010 review log follow-up: built-in plugin registry.
//
// Phase 2 hardcoded plugin paths inline in apps/web routes. This module
// loads `<repoRoot>/plugins/registry.json` once and exposes a typed
// lookup. Phase 3 will move user-installed plugin rows into a PG table
// `plugin` (per ADR-0010 §2.5) and merge with the JSON-seeded built-ins.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface RegisteredPlugin {
  id: string;
  type: 'agent' | 'skill' | 'mcp-server' | 'ui-panel';
  /** Agent kind when type='agent'. */
  kind?: 'citation' | 'editor' | 'reviewer' | 'researcher' | 'coordinator' | 'custom';
  /** Path relative to repoRoot. */
  path: string;
  /** Default skill the host loads when invoking this agent. */
  skillId?: string;
  origin: 'built-in' | 'user' | 'team';
}

interface RegistryFile {
  version: number;
  plugins: RegisteredPlugin[];
}

let cached: { repoRoot: string; entries: RegisteredPlugin[] } | null = null;

/**
 * Load the registry. Caches the JSON in-memory keyed by repoRoot so
 * repeat calls in the same process don't re-read. Phase 3 will add a
 * NOTIFY-driven invalidation when user installs/uninstalls a plugin.
 */
export async function loadPluginRegistry(
  repoRoot: string,
): Promise<RegisteredPlugin[]> {
  if (cached && cached.repoRoot === repoRoot) return cached.entries;
  const path = resolve(repoRoot, 'plugins', 'registry.json');
  const text = await readFile(path, 'utf8');
  const parsed = JSON.parse(text) as RegistryFile;
  if (parsed.version !== 1) {
    throw new Error(
      `plugin registry version ${parsed.version} unsupported (expected 1)`,
    );
  }
  cached = { repoRoot, entries: parsed.plugins };
  return parsed.plugins;
}

/** Reset cache; primarily for tests. */
export function _resetPluginRegistryCache(): void {
  cached = null;
}

/** Find an agent plugin by kind. Returns null if no matching agent. */
export async function findAgentByKind(
  repoRoot: string,
  kind: RegisteredPlugin['kind'],
): Promise<RegisteredPlugin | null> {
  const all = await loadPluginRegistry(repoRoot);
  return (
    all.find((p) => p.type === 'agent' && p.kind === kind) ?? null
  );
}

/** Resolve absolute path on disk. */
export function resolvePluginAbsolutePath(
  repoRoot: string,
  registered: RegisteredPlugin,
): string {
  return resolve(repoRoot, registered.path);
}
