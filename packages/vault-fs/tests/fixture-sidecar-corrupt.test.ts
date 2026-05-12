// fixture-sidecar-corrupt.test.ts — 验收 4：sidecar 文件损坏，
// readSidecar 抛 SidecarCorruptError，调用方可回退到 markdown 冷启动。
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parseMarkdown,
  emitMarkdown,
  readSidecar,
  SidecarCorruptError,
} from '../src/index';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'fixture-sc-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('Fixture 4: sidecar 损坏 → fallback to markdown', () => {
  it('损坏的 sidecar 抛 SidecarCorruptError，markdown 仍能冷启动', async () => {
    const mdPath = join(dir, 'paper.md');
    const sidecarPath = join(dir, '.vault', 'yjs', 'paper.bin');
    const md = '# Recovery\n\nsurvivor body\n';
    await writeFile(mdPath, md);

    // 故意写一个损坏的 sidecar（bad magic）
    await mkdir(join(dir, '.vault', 'yjs'), { recursive: true });
    await writeFile(sidecarPath, new Uint8Array([0xff, 0xff, 0xff, 0xff, 1, 2, 3, 4]));

    // 试读 sidecar — 抛 SidecarCorruptError
    let caught: unknown = null;
    try {
      await readSidecar(sidecarPath);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof SidecarCorruptError);
    assert.equal((caught as SidecarCorruptError).reason, 'bad magic');

    // 调用方回退：从 markdown 冷启动
    const doc = parseMarkdown(md);
    assert.match(emitMarkdown(doc), /Recovery/);
    assert.match(emitMarkdown(doc), /survivor body/);
  });
});
