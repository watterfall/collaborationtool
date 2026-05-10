// Phase 4 W1 + W8 plugin install lib tests.
//
// Both /settings/plugins page and /api/settings/plugins call
// previewManifest() and filterAcceptedCapabilities() to ensure
// uniform parsing + capability gating. These pure tests pin those
// invariants.
//
// W8 (P4(17)) extends the suite with URL-mode validation +
// fetchManifestFromGitHubUrl() coverage so the new tab on the
// install panel has the same gating contract as the paste tab.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fetchManifestFromGitHubUrl,
  filterAcceptedCapabilities,
  PLUGIN_MANIFEST_URL_HOSTS,
  previewManifest,
  validateGitHubManifestUrl,
} from '../src/lib/plugin-install';

function manifestJson(
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    id: '@example/test-agent',
    version: '0.1.0',
    type: 'agent',
    title: { zh: '示例 Agent', en: 'Example Agent' },
    description: { zh: '测试用', en: 'test' },
    authors: ['alice@example.com'],
    license: 'MIT',
    required_capabilities: ['block.read', 'block.propose'],
    runtime: { kernel_version: '^2.0.0', target: 'node' },
    kind: 'custom',
    prompt_template: './prompt.md',
    entry_point: './agent.ts',
    ...overrides,
  });
}

describe('previewManifest — happy path', () => {
  it('parses a valid agent manifest and produces a capability prompt', () => {
    const v = previewManifest(manifestJson());
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.preview.manifest.id, '@example/test-agent');
    assert.equal(v.preview.manifest.type, 'agent');
    assert.equal(v.preview.capabilityPrompt.length, 2);
    const caps = v.preview.capabilityPrompt.map((r) => r.capability);
    assert.deepEqual(caps.sort(), ['block.propose', 'block.read']);
    for (const row of v.preview.capabilityPrompt) {
      assert.ok(row.explanation.zh);
      assert.ok(row.explanation.en);
    }
  });

  it('detected hostPlatform is one of the 3 known', () => {
    const v = previewManifest(manifestJson());
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.ok(['linux', 'macos', 'windows'].includes(v.preview.hostPlatform));
  });
});

describe('previewManifest — denials', () => {
  it('rejects malformed JSON with reason=invalid-json', () => {
    const v = previewManifest('{ not json');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'invalid-json');
  });

  it('rejects manifest missing required fields with reason=invalid-manifest', () => {
    // valid JSON but invalid manifest (missing type, id, etc.)
    const v = previewManifest('{"hello":"world"}');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'invalid-manifest');
  });
});

describe('filterAcceptedCapabilities', () => {
  it('returns intersection of requested and manifest required', () => {
    const v = previewManifest(manifestJson());
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const filtered = filterAcceptedCapabilities(v.preview.manifest, [
      'block.read',
      'block.delete', // not declared by manifest → must drop
      'block.propose',
    ]);
    assert.deepEqual(filtered.sort(), ['block.propose', 'block.read']);
  });

  it('drops everything when nothing matches', () => {
    const v = previewManifest(manifestJson());
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.deepEqual(
      filterAcceptedCapabilities(v.preview.manifest, ['document.fork']),
      [],
    );
  });

  it('returns empty when manifest declares no capabilities', () => {
    const v = previewManifest(manifestJson({ required_capabilities: [] }));
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.deepEqual(
      filterAcceptedCapabilities(v.preview.manifest, ['block.read']),
      [],
    );
  });
});

describe('validateGitHubManifestUrl — W8 URL-mode', () => {
  it('rejects empty input', () => {
    const v = validateGitHubManifestUrl('   ');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'invalid-url');
  });

  it('rejects unparseable URLs', () => {
    const v = validateGitHubManifestUrl('not a url at all');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'invalid-url');
  });

  it('rejects http://', () => {
    const v = validateGitHubManifestUrl('http://github.com/foo/bar');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'not-https');
  });

  it('rejects git@ scheme', () => {
    const v = validateGitHubManifestUrl('git@github.com:foo/bar.git');
    assert.equal(v.ok, false);
    if (v.ok) return;
    // URL parser may accept this as opaque, but protocol won't be https:
    assert.ok(['invalid-url', 'not-https'].includes(v.reason));
  });

  it('rejects file:// scheme', () => {
    const v = validateGitHubManifestUrl('file:///etc/passwd');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'not-https');
  });

  it('rejects hosts outside the allow-list', () => {
    const v = validateGitHubManifestUrl('https://gitlab.com/foo/bar');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'host-not-allowed');
    assert.match(v.detail, /gitlab\.com/);
  });

  it('rejects github.com URL without /owner/repo', () => {
    const v = validateGitHubManifestUrl('https://github.com/');
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'not-a-repo-url');
  });

  it('accepts canonical https://github.com/owner/repo', () => {
    const v = validateGitHubManifestUrl('https://github.com/foo/bar-plugin');
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.sourceUrl, 'https://github.com/foo/bar-plugin');
    assert.ok(v.rawUrls.length >= 4); // 2 branches × ≥2 filenames
    assert.ok(
      v.rawUrls.every((u) => u.startsWith('https://raw.githubusercontent.com/foo/bar-plugin/')),
      'raw URLs must point at the same owner/repo',
    );
    // Both plugin.json and plugin.yaml must be in the candidate list.
    assert.ok(v.rawUrls.some((u) => u.endsWith('/plugin.json')));
    assert.ok(v.rawUrls.some((u) => u.endsWith('/plugin.yaml')));
  });

  it('strips trailing .git', () => {
    const v = validateGitHubManifestUrl(
      'https://github.com/foo/bar-plugin.git',
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.sourceUrl, 'https://github.com/foo/bar-plugin');
    assert.ok(
      v.rawUrls.every((u) => !u.includes('.git/')),
      'derived raw URLs must not retain .git segment',
    );
  });

  it('accepts a raw.githubusercontent.com URL as-is', () => {
    const url =
      'https://raw.githubusercontent.com/foo/bar/main/plugin.json';
    const v = validateGitHubManifestUrl(url);
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.deepEqual(v.rawUrls, [url]);
  });

  it('exports the host allow-list', () => {
    assert.ok(PLUGIN_MANIFEST_URL_HOSTS.includes('github.com'));
    assert.ok(PLUGIN_MANIFEST_URL_HOSTS.includes('raw.githubusercontent.com'));
  });
});

describe('fetchManifestFromGitHubUrl — W8 network gates', () => {
  it('returns invalid-url verdict without touching the network', async () => {
    let called = 0;
    const stub: typeof fetch = async () => {
      called++;
      throw new Error('network must not be called');
    };
    const v = await fetchManifestFromGitHubUrl('http://github.com/x/y', {
      fetchImpl: stub,
    });
    assert.equal(called, 0);
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'not-https');
  });

  it('rejects responses larger than maxBytes via Content-Length', async () => {
    const stub: typeof fetch = async () =>
      new Response('x'.repeat(10), {
        status: 200,
        headers: { 'content-length': '5000' },
      });
    const v = await fetchManifestFromGitHubUrl(
      'https://github.com/foo/bar',
      { fetchImpl: stub, maxBytes: 100 },
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'too-large');
  });

  it('rejects streamed bodies that exceed maxBytes when Content-Length is missing', async () => {
    const big = 'a'.repeat(2000);
    const stub: typeof fetch = async () =>
      new Response(big, { status: 200 });
    const v = await fetchManifestFromGitHubUrl(
      'https://github.com/foo/bar',
      { fetchImpl: stub, maxBytes: 500 },
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'too-large');
  });

  it('returns timeout verdict on AbortError', async () => {
    const stub: typeof fetch = async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    };
    const v = await fetchManifestFromGitHubUrl(
      'https://github.com/foo/bar',
      { fetchImpl: stub, timeoutMs: 10 },
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'timeout');
  });

  it('falls through 404 to next candidate, returns first 200', async () => {
    let calls = 0;
    const stub: typeof fetch = async (input) => {
      calls++;
      const url = String(input);
      if (url.endsWith('/main/plugin.json')) {
        return new Response('not found', { status: 404 });
      }
      if (url.endsWith('/main/plugin.yaml')) {
        return new Response('{"id":"@x/y","type":"agent"}', { status: 200 });
      }
      return new Response('boom', { status: 500 });
    };
    const v = await fetchManifestFromGitHubUrl(
      'https://github.com/foo/bar',
      { fetchImpl: stub },
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(calls, 2);
    assert.match(v.resolvedUrl, /\/main\/plugin\.yaml$/);
    assert.equal(v.manifestText, '{"id":"@x/y","type":"agent"}');
    assert.equal(v.sourceUrl, 'https://github.com/foo/bar');
  });

  it('returns http-error on 5xx (not retried)', async () => {
    const stub: typeof fetch = async () =>
      new Response('upstream blew up', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    const v = await fetchManifestFromGitHubUrl(
      'https://github.com/foo/bar',
      { fetchImpl: stub },
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'http-error');
    assert.match(v.detail, /503/);
  });

  it('returns fetch-failed when all candidates 404', async () => {
    const stub: typeof fetch = async () =>
      new Response('not found', { status: 404 });
    const v = await fetchManifestFromGitHubUrl(
      'https://github.com/foo/bar',
      { fetchImpl: stub },
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.reason, 'fetch-failed');
  });

  it('happy path: fetched manifest passes previewManifest()', async () => {
    const validManifest = manifestJson();
    const stub: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/main/plugin.json')) {
        return new Response(validManifest, {
          status: 200,
          headers: { 'content-length': String(validManifest.length) },
        });
      }
      return new Response('not found', { status: 404 });
    };
    const v = await fetchManifestFromGitHubUrl(
      'https://github.com/example/test-agent',
      { fetchImpl: stub },
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const preview = previewManifest(v.manifestText);
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.preview.manifest.id, '@example/test-agent');
  });
});
