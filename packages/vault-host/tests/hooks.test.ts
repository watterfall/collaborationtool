import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import * as Y from 'yjs';

import { createFileSystemHooks } from '../src/hooks';

test('createFileSystemHooks: sidecar read returns null when absent, round-trips bytes after write', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-hooks-'));
  try {
    const hooks = createFileSystemHooks();
    const path = join(dir, 'sidecar.bin');
    assert.equal(await hooks.readSidecar(path), null);

    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    await hooks.writeSidecar(path, bytes);
    assert.deepEqual(await hooks.readSidecar(path), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('createFileSystemHooks: parseMarkdown/emitMarkdown seam preserves text (single yjs identity)', () => {
  const hooks = createFileSystemHooks();
  const doc = hooks.parseMarkdown('Hello vault host');
  // Dedup canary: the Y.Doc vault-fs produces must be the same class
  // doc-store consumes. If pnpm splits yjs, this instanceof fails.
  assert.ok(doc instanceof Y.Doc);
  assert.match(hooks.emitMarkdown(doc), /Hello vault host/);
});

test('createFileSystemHooks: frontmatter survives the parse → emit round-trip (ADR-0021 §3)', () => {
  const hooks = createFileSystemHooks();
  const fm = '---\nnight: thought\nid: n-1\ntitle: 相分离隐喻\n---\n';
  const doc = hooks.parseMarkdown(`${fm}\n液滴是无膜的组织方式。`);
  const emitted = hooks.emitMarkdown(doc);
  assert.ok(emitted.startsWith(fm), 'typed header must be re-attached verbatim');
  assert.match(emitted, /液滴是无膜的组织方式/);
  // Frontmatter keys must NOT leak into the PM body.
  const bodyOnly = emitted.slice(fm.length);
  assert.doesNotMatch(bodyOnly, /night: thought/);
});

test('createFileSystemHooks: stash is per-doc — two hooks instances do not cross-contaminate', () => {
  const a = createFileSystemHooks();
  const b = createFileSystemHooks();
  const docA = a.parseMarkdown('---\nid: a\n---\nbody A');
  const docB = b.parseMarkdown('plain body B');
  assert.match(a.emitMarkdown(docA), /^---\nid: a\n---\n/);
  assert.doesNotMatch(b.emitMarkdown(docB), /^---/);
});
