// Vault-native spine integration test — Wave A3（真脊柱防腐）。
//
// 证明 ADR-0021 的完整链路串起来能工作，而不是各层单测各自绿：
//   vault.createFile（Night 文件 + frontmatter）
//     → doc.open（cold-start 从 markdown parse，hooks split frontmatter）
//     → 模拟 webview 编辑 body（doc.applyUpdate）
//     → doc.flush（hooks join frontmatter 回贴 + 落 markdown twin + sidecar）
//     → 磁盘 markdown 头部字节保全 + body 含新编辑
//     → 冷重开（新 client / 新 session）仍拿到编辑后的内容
//
// 这是 A2/A2.3 接线的防腐锁：现有 server.test.ts 的 round-trip 从**无
// frontmatter** 的纯文本起步，即便保全 hooks 坏了也照过；本测试从带
// frontmatter 的 Night 文件起步，头部丢失即 fail。

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import * as Y from 'yjs';

import { createVaultHostServer, type VaultHostServer } from '../src/index';

interface RpcResponse {
  id: number;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

class SpineClient {
  readonly server: VaultHostServer;
  private readonly input = new PassThrough();
  private nextId = 1;
  private readonly pending = new Map<number, (r: RpcResponse) => void>();
  private buffer = '';

  constructor() {
    const output = new PassThrough();
    output.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      let idx = this.buffer.indexOf('\n');
      while (idx >= 0) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        const msg = JSON.parse(line) as Record<string, unknown>;
        if (typeof msg['event'] !== 'string') {
          const r = msg as unknown as RpcResponse;
          const resolve = this.pending.get(r.id);
          this.pending.delete(r.id);
          resolve?.(r);
        }
        idx = this.buffer.indexOf('\n');
      }
    });
    this.server = createVaultHostServer({ input: this.input, output });
  }

  ok(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise<Record<string, unknown>>((resolve) => {
      this.pending.set(id, (r) => {
        assert.equal(r.ok, true, `${method} failed: ${JSON.stringify(r.error)}`);
        resolve(r.result ?? {});
      });
      this.input.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  close(): Promise<void> {
    return this.server.close();
  }
}

// A Night thought file exactly as the discovery-graph codec emits it
// (ADR-0021 §2). The frontmatter block is what must survive the edit.
const NIGHT_FILE =
  [
    '---',
    'night: thought',
    'id: night-thought-spine01',
    'author: ed25519:cafe01',
    'created: 2026-07-18T03:00:00.000Z',
    'updated: 2026-07-18T03:00:00.000Z',
    'visibility: private',
    'status: active',
    'mode-tags: metaphor, cross-domain',
    'provenance: prov-local-spine01',
    'title: 相分离液滴',
    '---',
    '',
    '无膜的组织方式。',
  ].join('\n') + '\n';

const FRONTMATTER_BLOCK = NIGHT_FILE.slice(0, NIGHT_FILE.indexOf('\n---\n') + 5);

test('vault-native spine: create → open → edit body → flush preserves frontmatter + persists edit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-spine-'));
  const client = new SpineClient();
  try {
    await client.ok('vault.open', { root: dir });
    await client.ok('vault.createFile', {
      root: dir,
      relativePath: 'night/2026-07-18-spine.md',
      contentUtf8: NIGHT_FILE,
    });

    const opened = await client.ok('doc.open', {
      root: dir,
      relativePath: 'night/2026-07-18-spine.md',
      sidecarFlushMs: 5,
      markdownFlushMs: 5,
    });
    const id = opened['id'] as string;
    const stateBase64 = opened['stateBase64'] as string;

    // Webview edit: hydrate from wire state, append to the body, send delta.
    const local = new Y.Doc();
    Y.applyUpdate(local, new Uint8Array(Buffer.from(stateBase64, 'base64')));
    let update: Uint8Array | null = null;
    local.on('update', (u: Uint8Array) => {
      update = u;
    });
    local.transact(() => {
      const fragment = local.getXmlFragment('prosemirror');
      const paragraph = new Y.XmlElement('paragraph');
      paragraph.insert(0, [new Y.XmlText('相分离是无膜细胞器的组织原理。')]);
      fragment.insert(fragment.length, [paragraph]);
    });
    assert.ok(update, 'edit produced an update');
    await client.ok('doc.applyUpdate', {
      root: dir,
      id,
      updateBase64: Buffer.from(update!).toString('base64'),
    });
    await client.ok('doc.flush', { root: dir, id });

    const onDisk = await readFile(join(dir, 'night/2026-07-18-spine.md'), 'utf8');
    // 1. Frontmatter block preserved byte-for-byte (the A2 防腐 target).
    assert.ok(
      onDisk.startsWith(FRONTMATTER_BLOCK),
      `frontmatter must survive verbatim, got:\n${onDisk.slice(0, 200)}`,
    );
    // 2. Both the original and the injected body are present.
    assert.match(onDisk, /无膜的组织方式/);
    assert.match(onDisk, /相分离是无膜细胞器的组织原理/);
    // 3. Frontmatter keys must NOT bleed into the body region.
    const body = onDisk.slice(FRONTMATTER_BLOCK.length);
    assert.doesNotMatch(body, /night: thought/);
    assert.doesNotMatch(body, /mode-tags:/);

    // 4. Sidecar (.vault/yjs/<id>.bin) materialised.
    const sidecar = await stat(join(dir, '.vault', 'yjs', `${id}.bin`));
    assert.ok(sidecar.isFile());

    await client.ok('vault.close', { root: dir });
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('vault-native spine: cold-reopen in a fresh session recovers the edited body', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-spine-reopen-'));
  const first = new SpineClient();
  try {
    await first.ok('vault.open', { root: dir });
    await first.ok('vault.createFile', {
      root: dir,
      relativePath: 'night/n.md',
      contentUtf8: NIGHT_FILE,
    });
    const opened = await first.ok('doc.open', {
      root: dir,
      relativePath: 'night/n.md',
      sidecarFlushMs: 5,
      markdownFlushMs: 5,
    });
    const id = opened['id'] as string;
    const local = new Y.Doc();
    Y.applyUpdate(
      local,
      new Uint8Array(Buffer.from(opened['stateBase64'] as string, 'base64')),
    );
    let update: Uint8Array | null = null;
    local.on('update', (u: Uint8Array) => {
      update = u;
    });
    local.transact(() => {
      const fragment = local.getXmlFragment('prosemirror');
      const p = new Y.XmlElement('paragraph');
      p.insert(0, [new Y.XmlText('persisted across sessions')]);
      fragment.insert(fragment.length, [p]);
    });
    await first.ok('doc.applyUpdate', {
      root: dir,
      id,
      updateBase64: Buffer.from(update!).toString('base64'),
    });
    await first.ok('doc.flush', { root: dir, id });
    await first.ok('vault.close', { root: dir });
  } finally {
    await first.close();
  }

  // Fresh host process (new server) — cold-start must recover the edit
  // from the sidecar/markdown twin left on disk.
  const second = new SpineClient();
  try {
    await second.ok('vault.open', { root: dir });
    const reopened = await second.ok('doc.open', {
      root: dir,
      relativePath: 'night/n.md',
    });
    const fresh = new Y.Doc();
    Y.applyUpdate(
      fresh,
      new Uint8Array(Buffer.from(reopened['stateBase64'] as string, 'base64')),
    );
    assert.match(
      fresh.getXmlFragment('prosemirror').toString(),
      /persisted across sessions/,
    );
  } finally {
    await second.close();
    await rm(dir, { recursive: true, force: true });
  }
});
