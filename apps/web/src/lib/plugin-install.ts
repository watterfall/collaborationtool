// Phase 4 W1 ADR-0012 plugin install UI: shared parsing + preview helpers.
//
// The settings page and the API route both call previewManifest()
// to get a uniform validation + capability prompt response. The
// install action calls buildInstallRowPayload from ai-runtime
// directly.

import {
  buildCapabilityPrompt,
  parseManifest,
  type CapabilityPromptRow,
  type PluginManifest,
  type SandboxPlatform,
} from '@collaborationtool/ai-runtime';

export interface ManifestPreview {
  manifest: PluginManifest;
  capabilityPrompt: CapabilityPromptRow[];
  /** Detected host platform — UI shows the sandbox the install will use. */
  hostPlatform: SandboxPlatform;
  /** Non-fatal warnings from manifest parser (e.g. unknown trigger
   * patterns). Surfaced to UI so user knows what the parser ignored. */
  warnings: string[];
}

export type ManifestPreviewVerdict =
  | { ok: true; preview: ManifestPreview }
  | { ok: false; reason: 'invalid-json' | 'invalid-manifest'; detail: string };

/** Parse + validate a pasted manifest JSON / YAML string. Returns
 * either a ready-to-render preview or a structured error suitable
 * for the UI. */
export function previewManifest(manifestText: string): ManifestPreviewVerdict {
  // First sanity-check that it's parseable as JSON (we accept JSON
  // input from the paste box; parseManifest itself reads YAML which
  // is a JSON superset, but we want a clean error early when the
  // user pastes unbalanced braces).
  try {
    JSON.parse(manifestText);
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid-json',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  try {
    const { manifest, warnings } = parseManifest(manifestText, {
      sourcePath: '<paste>',
    });
    return {
      ok: true,
      preview: {
        manifest,
        capabilityPrompt: buildCapabilityPrompt(manifest),
        hostPlatform: detectHostPlatform(),
        warnings,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid-manifest',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function detectHostPlatform(): SandboxPlatform {
  if (process.platform === 'linux') return 'linux';
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'windows';
  // Default to linux: the canonical sandbox target. macOS/Windows
  // descriptors are placeholders until Phase 5.
  return 'linux';
}

/** Filter the requested accepted-capabilities against the manifest's
 * required set. Returns the intersection (accepted ⊆ required). UI
 * derives this when the user unchecks individual rows. */
export function filterAcceptedCapabilities(
  manifest: PluginManifest,
  requested: readonly string[],
): string[] {
  const required = new Set(manifest.requiredCapabilities as readonly string[]);
  const out: string[] = [];
  for (const r of requested) {
    if (required.has(r)) out.push(r);
  }
  return out;
}
