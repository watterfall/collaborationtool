// fixture-external-edit.test.ts — 验收 2：外部编辑器改 markdown，
// drift-detector 报 drift，并能 parse 进 Y.Doc。
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Y from 'yjs';
import { parseMarkdown, emitMarkdown, detectDrift } from '../src/index';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'fixture-ee-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('Fixture 2: external-edit (VS Code edit markdown out-of-band)', () => {
  it('外部编辑触发 drift，parse 后 Y.Doc 反映新内容', async () => {
    const mdPath = join(dir, 'paper.md');
    // 1. 初态：用户在 app 内编辑 → Y.Doc 与 markdown 一致
    const initial = '# Title\n\nbody v1\n';
    await writeFile(mdPath, initial);
    const doc = parseMarkdown(initial);
    const canonical = emitMarkdown(doc);
    // 同步 markdown 到 canonical 形态（模拟 app 的 flush）
    await writeFile(mdPath, canonical);
    const r0 = detectDrift({ yDoc: doc, markdownFileContent: canonical });
    assert.equal(r0.drifted, false, 'baseline should not drift');

    // 2. 外部编辑器改 markdown
    const externalEdited = canonical.replace('body v1', 'body v2 external');
    await writeFile(mdPath, externalEdited);

    // 3. 检测 drift
    const onDisk = await readFile(mdPath, 'utf8');
    const r1 = detectDrift({ yDoc: doc, markdownFileContent: onDisk });
    assert.equal(r1.drifted, true, 'external edit should be detected as drift');

    // 4. parse 新 markdown 进 Y.Doc，验证内容已更新
    const updated = parseMarkdown(onDisk);
    assert.match(emitMarkdown(updated), /body v2 external/);
  });
});
