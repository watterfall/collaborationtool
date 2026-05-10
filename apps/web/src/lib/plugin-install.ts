// Phase 4 W1 ADR-0012 plugin install UI: shared parsing + preview helpers.
//
// The settings page and the API route both call previewManifest()
// to get a uniform validation + capability prompt response. The
// install action calls buildInstallRowPayload from ai-runtime
// directly.
//
// Phase 4 W8 (P4(17)) extensions:
//   - fetchManifestFromGitHubUrl() — URL-mode input (https-only,
//     GitHub host whitelist, 8s timeout, 1MB body cap). Replaces the
//     `?manifest=<JSON>` searchParam path called out as a P0 anti-
//     pattern in role-user.md §2.
//   - validateGitHubManifestUrl() — pre-flight URL parse so the UI
//     can show a typed error before doing the fetch.

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

// ---------- W8 URL-mode helpers ----------

/** Hosts the URL-mode input is allowed to fetch from. Keeping this
 * narrow is important: the UI advertises "GitHub repo URL" so any
 * other host is a strong "user copy-pasted the wrong thing" signal,
 * not a sandbox bypass we want to silently honour. */
export const PLUGIN_MANIFEST_URL_HOSTS: readonly string[] = [
  'github.com',
  'raw.githubusercontent.com',
];

/** Maximum body size we will read from a manifest URL (bytes). Real
 * manifests are <2 KB; 1 MB lets us absorb pathologically large keys
 * sections without becoming a DoS sink. */
export const PLUGIN_MANIFEST_URL_MAX_BYTES = 1_000_000;

/** Network timeout for URL-mode fetch (ms). 8 s comfortably covers
 * `raw.githubusercontent.com` worst case while still failing fast
 * for typo'd hosts. */
export const PLUGIN_MANIFEST_URL_TIMEOUT_MS = 8_000;

export type GitHubManifestUrlVerdict =
  | { ok: true; rawUrls: string[]; sourceUrl: string }
  | {
      ok: false;
      reason:
        | 'invalid-url'
        | 'not-https'
        | 'host-not-allowed'
        | 'not-a-repo-url';
      detail: string;
    };

/** Validate a user-supplied GitHub repo URL and derive the candidate
 * raw-content URLs we will try in order (plugin.json → plugin.yaml).
 * Returns the canonical sourceUrl that gets recorded on the row. */
export function validateGitHubManifestUrl(
  input: string,
): GitHubManifestUrlVerdict {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'invalid-url', detail: 'empty' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid-url',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: 'not-https',
      detail: `protocol=${parsed.protocol} (only https:// accepted)`,
    };
  }
  if (!PLUGIN_MANIFEST_URL_HOSTS.includes(parsed.host)) {
    return {
      ok: false,
      reason: 'host-not-allowed',
      detail: `host=${parsed.host} (allowed: ${PLUGIN_MANIFEST_URL_HOSTS.join(', ')})`,
    };
  }

  // Already a raw.githubusercontent.com URL → trust as-is.
  if (parsed.host === 'raw.githubusercontent.com') {
    return { ok: true, rawUrls: [parsed.toString()], sourceUrl: trimmed };
  }

  // github.com/owner/repo[/...] → pull owner+repo and try main+master.
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return {
      ok: false,
      reason: 'not-a-repo-url',
      detail: `pathname=${parsed.pathname} (expected /owner/repo)`,
    };
  }
  const owner = segments[0];
  const repo = segments[1];
  if (!owner || !repo) {
    return {
      ok: false,
      reason: 'not-a-repo-url',
      detail: `pathname=${parsed.pathname} (expected /owner/repo)`,
    };
  }
  // Strip a trailing `.git` if the user pasted the clone URL.
  const repoName = repo.endsWith('.git') ? repo.slice(0, -4) : repo;
  const branches = ['main', 'master'];
  const filenames = ['plugin.json', 'plugin.yaml', 'plugin.yml'];
  const rawUrls: string[] = [];
  for (const branch of branches) {
    for (const filename of filenames) {
      rawUrls.push(
        `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${filename}`,
      );
    }
  }
  return {
    ok: true,
    rawUrls,
    sourceUrl: `https://github.com/${owner}/${repoName}`,
  };
}

export type FetchManifestFromUrlReason =
  | 'invalid-url'
  | 'not-https'
  | 'host-not-allowed'
  | 'not-a-repo-url'
  | 'fetch-failed'
  | 'http-error'
  | 'too-large'
  | 'timeout';

export type FetchManifestFromUrlVerdict =
  | { ok: true; manifestText: string; resolvedUrl: string; sourceUrl: string }
  | { ok: false; reason: FetchManifestFromUrlReason; detail: string };

/** Fetch a manifest by GitHub repo URL. Tries the candidates from
 * validateGitHubManifestUrl() in order, returning the first success.
 * The 1 MB cap is enforced both via Content-Length (cheap) and a
 * streaming read (defends against servers that omit the header). */
export async function fetchManifestFromGitHubUrl(
  input: string,
  options: {
    timeoutMs?: number;
    maxBytes?: number;
    /** Injected for tests so we can stub network without touching
     * the global fetch. Defaults to globalThis.fetch. */
    fetchImpl?: typeof fetch;
  } = {},
): Promise<FetchManifestFromUrlVerdict> {
  const validation = validateGitHubManifestUrl(input);
  if (!validation.ok) return validation;

  const timeoutMs = options.timeoutMs ?? PLUGIN_MANIFEST_URL_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? PLUGIN_MANIFEST_URL_MAX_BYTES;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  let lastDetail = '';
  for (const rawUrl of validation.rawUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(rawUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: 'application/json, text/plain, */*' },
      });
      if (res.status === 404) {
        lastDetail = `404 at ${rawUrl}`;
        continue; // try next branch / filename
      }
      if (!res.ok) {
        return {
          ok: false,
          reason: 'http-error',
          detail: `${res.status} ${res.statusText} at ${rawUrl}`,
        };
      }
      const contentLength = res.headers.get('content-length');
      if (contentLength && Number(contentLength) > maxBytes) {
        return {
          ok: false,
          reason: 'too-large',
          detail: `Content-Length=${contentLength} > ${maxBytes}`,
        };
      }
      // Streaming read with running byte count so we abort if the
      // server lies about / omits Content-Length.
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        if (text.length > maxBytes) {
          return {
            ok: false,
            reason: 'too-large',
            detail: `body length ${text.length} > ${maxBytes}`,
          };
        }
        return {
          ok: true,
          manifestText: text,
          resolvedUrl: rawUrl,
          sourceUrl: validation.sourceUrl,
        };
      }
      const decoder = new TextDecoder('utf-8');
      let received = 0;
      let text = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > maxBytes) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            return {
              ok: false,
              reason: 'too-large',
              detail: `streamed ${received} bytes > ${maxBytes}`,
            };
          }
          text += decoder.decode(value, { stream: true });
        }
      }
      text += decoder.decode();
      return {
        ok: true,
        manifestText: text,
        resolvedUrl: rawUrl,
        sourceUrl: validation.sourceUrl,
      };
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || /aborted/i.test(err.message));
      if (isAbort) {
        return {
          ok: false,
          reason: 'timeout',
          detail: `aborted after ${timeoutMs}ms at ${rawUrl}`,
        };
      }
      lastDetail = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ok: false,
    reason: 'fetch-failed',
    detail: lastDetail || 'all candidate URLs failed',
  };
}
