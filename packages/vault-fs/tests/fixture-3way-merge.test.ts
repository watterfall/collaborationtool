// fixture-3way-merge.test.ts — 验收 3：用户在 app 编辑同时外部编辑器
// 也改了 markdown → 3-way merge surface conflict regions。
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Y from 'yjs';
import { parseMarkdown, emitMarkdown, threeWayMerge } from '../src/index';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'fixture-3w-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('Fixture 3: 3-way merge (local + remote divergent edit)', () => {
  it('base / local / remote 三方分叉 → ConflictRegion[] 暴露', async () => {
    const baseMd = '# Paper\n\noriginal body\n';
    await writeFile(join(dir, 'paper.md'), baseMd);

    // base + local: 用户在 app 内编辑
    const base = parseMarkdown(baseMd);
    const local = parseMarkdown('# Paper\n\nlocal body in app\n');

    // remote: 外部编辑器同时改
    const remoteMd = '# Paper\n\nremote body via VS Code\n';
    await writeFile(join(dir, 'paper.md'), remoteMd);

    const result = threeWayMerge({ base, local, remoteMarkdown: remoteMd });
    assert.ok(result.conflicts.length >= 1, 'expected ≥1 conflict region');
    const c = result.conflicts[0]!;
    assert.match(c.localContent, /local body in app/);
    assert.match(c.remoteContent, /remote body via VS Code/);

    // merge update can materialise
    const merged = new Y.Doc();
    Y.applyUpdate(merged, result.mergedUpdate);
    const mergedText = emitMarkdown(merged);
    // Spike-2 local-wins simplification
    assert.match(mergedText, /local body in app/);
  });
});
