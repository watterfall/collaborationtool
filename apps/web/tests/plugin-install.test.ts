// Phase 4 W1 plugin install lib tests.
//
// Both /settings/plugins page and /api/settings/plugins call
// previewManifest() and filterAcceptedCapabilities() to ensure
// uniform parsing + capability gating. These pure tests pin those
// invariants.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterAcceptedCapabilities,
  previewManifest,
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
