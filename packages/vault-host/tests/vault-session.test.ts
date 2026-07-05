import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { VaultSession, deriveDocId, ensureVaultSkeleton } from '../src/index';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test('deriveDocId: slugifies vault-relative paths deterministically', () => {
  assert.equal(deriveDocId('papers/draft-1.md'), 'papers-draft-1');
  assert.equal(deriveDocId('paper-1.md'), 'paper-1');
  assert.equal(deriveDocId('a/b/c.md'), 'a-b-c');
});

test('ensureVaultSkeleton: creates the .vault control plane', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-skel-'));
  try {
    await ensureVaultSkeleton(dir);
    assert.ok(await exists(join(dir, '.vault', 'yjs')));
    assert.ok(await exists(join(dir, '.vault', 'keys')));
    assert.ok(await exists(join(dir, '.vault', 'pending-sync')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('VaultSession: markdown cold-start → flush writes sidecar + twin → reopen from sidecar preserves content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-session-'));
  try {
    // A user drops a markdown file into the vault from outside the app.
    await writeFile(join(dir, 'paper-1.md'), 'Hello vault host', 'utf8');

    const session1 = await VaultSession.open(dir);
    const doc1 = await session1.openDocument('paper-1.md', {
      sidecarFlushMs: 5,
      markdownFlushMs: 5,
    });
    // Cold-start resolved from markdown (no sidecar yet) → non-empty state.
    assert.ok(doc1.encodeStateAsUpdate().length > 0);

    await doc1.flush();
    const sidecar = join(dir, '.vault', 'yjs', `${deriveDocId('paper-1.md')}.bin`);
    assert.ok(await exists(sidecar), 'sidecar written on flush');
    assert.match(
      await readFile(join(dir, 'paper-1.md'), 'utf8'),
      /Hello vault host/,
      'markdown twin preserved on flush',
    );
    await session1.close();

    // Reopen: sidecar now exists → cold-start resolves from it, not markdown.
    const session2 = await VaultSession.open(dir);
    const doc2 = await session2.openDocument('paper-1.md', { markdownFlushMs: 5 });
    assert.ok(doc2.encodeStateAsUpdate().length > 0, 'state restored from sidecar');
    await doc2.flush();
    assert.match(
      await readFile(join(dir, 'paper-1.md'), 'utf8'),
      /Hello vault host/,
      'content survives a full close/reopen cycle',
    );
    await session2.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('VaultSession: openDocument returns the same live handle for the same id', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-dedup-'));
  try {
    const session = await VaultSession.open(dir);
    const a = await session.openDocument('note.md');
    const b = await session.openDocument('note.md');
    assert.equal(a, b);
    await session.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
