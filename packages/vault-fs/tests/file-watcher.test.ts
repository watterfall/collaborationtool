import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { watchVault, type VaultEvent } from '../src/file-watcher';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vault-watch-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('watchVault (Spike-2 Task 5)', () => {
  it('emits "add" when new markdown file appears', async () => {
    const events: VaultEvent[] = [];
    const handle = await watchVault(dir, (e) => events.push(e));
    // give chokidar a tick after ready
    await new Promise((r) => setTimeout(r, 100));
    await writeFile(join(dir, 'new.md'), '# hi\n');
    await new Promise((r) => setTimeout(r, 500));
    await handle.close();
    assert.ok(events.some((e) => e.kind === 'add' && e.path.endsWith('new.md')),
      `expected add event for new.md; got ${JSON.stringify(events)}`);
  });

  it('emits "change" when existing file is modified externally', async () => {
    await writeFile(join(dir, 'existing.md'), 'a\n');
    const events: VaultEvent[] = [];
    const handle = await watchVault(dir, (e) => events.push(e));
    await new Promise((r) => setTimeout(r, 200));
    await writeFile(join(dir, 'existing.md'), 'b\n');
    await new Promise((r) => setTimeout(r, 500));
    await handle.close();
    assert.ok(events.some((e) => e.kind === 'change' && e.path.endsWith('existing.md')),
      `expected change event; got ${JSON.stringify(events)}`);
  });

  it('ignores .vault/ subtree (sidecar churn must not surface)', async () => {
    await mkdir(join(dir, '.vault', 'yjs'), { recursive: true });
    const events: VaultEvent[] = [];
    const handle = await watchVault(dir, (e) => events.push(e));
    await new Promise((r) => setTimeout(r, 200));
    await writeFile(join(dir, '.vault', 'yjs', 'p1.bin'), new Uint8Array([1, 2]));
    await new Promise((r) => setTimeout(r, 500));
    await handle.close();
    assert.equal(
      events.filter((e) => e.path.includes('.vault')).length,
      0,
      `.vault/ events leaked through; got ${JSON.stringify(events)}`,
    );
  });
});
