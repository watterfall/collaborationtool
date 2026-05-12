// fixture-sync-interrupt.test.ts — 验收 5：sync 在 sidecar 半写时中断，
// 验证 atomic rename 模式 + .tmp 路径不污染最终 sidecar。
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Y from 'yjs';
import {
  parseMarkdown,
  emitMarkdown,
  readSidecar,
  writeSidecar,
} from '../src/index';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'fixture-si-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('Fixture 5: sync 中断（atomic rename invariant）', () => {
  it('中断遗留 .tmp 不被 readSidecar 误读为合法 sidecar', async () => {
    const sidecarPath = join(dir, '.vault', 'yjs', 'paper.bin');
    const sidecarTmpPath = `${sidecarPath}.tmp`;
    await mkdir(join(dir, '.vault', 'yjs'), { recursive: true });

    // 1. 模拟先前中断：留下 .tmp（半写损坏数据）
    await writeFile(sidecarTmpPath, new Uint8Array([0x00, 0x00, 0x00, 0x00, 1, 2]));

    // 2. readSidecar(real path) 返回 null（不存在）
    assert.equal(await readSidecar(sidecarPath), null);

    // 3. 正常 writeSidecar 应当：覆盖 .tmp、原子 rename 到 real path
    const md = '# Survivor\n\ncontent v3\n';
    const doc = parseMarkdown(md);
    await writeSidecar(sidecarPath, Y.encodeStateAsUpdate(doc));

    // 4. real sidecar 现在 valid；.tmp 不应残留
    const read = await readSidecar(sidecarPath);
    assert.ok(read);
    await assert.rejects(stat(sidecarTmpPath), 'leftover .tmp must be cleaned by rename');

    // 5. round-trip: restore Y.Doc + emit
    const restored = new Y.Doc();
    Y.applyUpdate(restored, read);
    assert.match(emitMarkdown(restored), /Survivor/);
    assert.match(emitMarkdown(restored), /content v3/);
  });
});
