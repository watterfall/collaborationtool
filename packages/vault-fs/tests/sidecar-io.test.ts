import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readSidecar, writeSidecar, SidecarCorruptError } from '../src/sidecar-io';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vault-fs-spike-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('sidecar-io (Spike-2 Task 4)', () => {
  it('writeSidecar creates file with bytes', async () => {
    const target = join(dir, 'paper-1.bin');
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await writeSidecar(target, bytes);
    const read = await readSidecar(target);
    assert.ok(read);
    assert.deepEqual(read, bytes);
  });

  it('writeSidecar is atomic (no .tmp leftover on success)', async () => {
    const target = join(dir, 'paper-2.bin');
    await writeSidecar(target, new Uint8Array([1]));
    await assert.rejects(stat(`${target}.tmp`));
  });

  it('readSidecar returns null when file missing', async () => {
    assert.equal(await readSidecar(join(dir, 'missing.bin')), null);
  });

  it('readSidecar returns bytes for existing file (round-trip through write)', async () => {
    const target = join(dir, 'paper-3.bin');
    const bytes = new Uint8Array([9, 8, 7]);
    await writeSidecar(target, bytes);
    const read = await readSidecar(target);
    assert.ok(read);
    assert.deepEqual(read, bytes);
  });

  it('readSidecar throws SidecarCorruptError when header marker bad', async () => {
    // 4-byte magic header check; corrupt = wrong magic
    const target = join(dir, 'corrupt.bin');
    await writeFile(target, new Uint8Array([0, 0, 0, 0, 1, 2, 3])); // bad magic
    await assert.rejects(readSidecar(target), (err) => err instanceof SidecarCorruptError);
  });
});
