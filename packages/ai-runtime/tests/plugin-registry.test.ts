// Phase 2.5 ADR-0010 review log follow-up: plugin registry tests.

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it, beforeEach } from 'node:test';

import {
  _resetPluginRegistryCache,
  findAgentByKind,
  loadPluginRegistry,
  resolvePluginAbsolutePath,
} from '../src/plugins';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

describe('plugin registry (built-in)', () => {
  beforeEach(() => {
    _resetPluginRegistryCache();
  });

  it('loads registry.json with all built-in agents (P2.5+P3 set)', async () => {
    const all = await loadPluginRegistry(REPO_ROOT);
    const ids = all.map((p) => p.id).sort();
    assert.deepEqual(ids, [
      '@official/citation-agent',
      '@official/coordinator-agent',
      '@official/inline-editor-agent',
      '@official/researcher-agent',
      '@official/reviewer-agent',
      '@official/source-extractor',
    ]);
    assert.ok(all.every((p) => p.origin === 'built-in'));
  });

  it('findAgentByKind returns the citation plugin', async () => {
    const p = await findAgentByKind(REPO_ROOT, 'citation');
    assert.ok(p);
    assert.equal(p!.id, '@official/citation-agent');
    assert.equal(p!.kind, 'citation');
    assert.equal(p!.skillId, 'citation-lookup');
  });

  it('findAgentByKind returns the editor plugin', async () => {
    const p = await findAgentByKind(REPO_ROOT, 'editor');
    assert.ok(p);
    assert.equal(p!.id, '@official/inline-editor-agent');
    assert.equal(p!.skillId, 'inline-editor');
  });

  it('findAgentByKind returns null for an unregistered kind', async () => {
    // 'editor' / 'citation' / 'reviewer' / 'researcher' / 'coordinator'
    // / 'custom' are now all registered. Use an undefined-by-typing
    // marker to test the negative path.
    const p = await findAgentByKind(
      REPO_ROOT,
      'definitely-unregistered' as Parameters<typeof findAgentByKind>[1],
    );
    assert.equal(p, null);
  });

  it('resolvePluginAbsolutePath returns absolute path', async () => {
    const p = await findAgentByKind(REPO_ROOT, 'citation');
    const abs = resolvePluginAbsolutePath(REPO_ROOT, p!);
    assert.ok(path.isAbsolute(abs));
    assert.ok(abs.endsWith('plugins/citation-agent'));
  });

  it('caches across calls (no re-read)', async () => {
    const a = await loadPluginRegistry(REPO_ROOT);
    const b = await loadPluginRegistry(REPO_ROOT);
    assert.equal(a, b); // same array reference
  });
});
