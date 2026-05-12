// fixture-cold-start.test.ts — 验收 1：sidecar 缺失，从 markdown 冷启动
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Y from 'yjs';
import { parseMarkdown, emitMarkdown, readSidecar, writeSidecar } from '../src/index';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'fixture-cs-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('Fixture 1: cold-start (sidecar missing)', () => {
  it('Y.Doc 从 markdown 重建 + 第一次 flush 后 sidecar 存在', async () => {
    const md = '# Cold start\n\nfresh body\n';
    const mdPath = join(dir, 'paper.md');
    const sidecarPath = join(dir, '.vault', 'yjs', 'paper.bin');
    await writeFile(mdPath, md);
    // sidecar 不存在
    assert.equal(await readSidecar(sidecarPath), null);
    // 冷启动 parse
    const doc = parseMarkdown(md);
    // emit 验证 round-trip 不丢内容
    const emitted = emitMarkdown(doc);
    assert.match(emitted, /Cold start/);
    assert.match(emitted, /fresh body/);
    // flush sidecar
    await mkdir(join(dir, '.vault', 'yjs'), { recursive: true });
    await writeSidecar(sidecarPath, Y.encodeStateAsUpdate(doc));
    // sidecar 现在存在 + 可读
    const read = await readSidecar(sidecarPath);
    assert.ok(read);
    // restore + emit 验证 sidecar 可用
    const restored = new Y.Doc();
    Y.applyUpdate(restored, read);
    assert.match(emitMarkdown(restored), /Cold start/);
  });
});
