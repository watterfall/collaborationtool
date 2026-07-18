import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { DEFAULT_KDF_OPTS } from '@collaborationtool/identity';
import * as Y from 'yjs';

import {
  createVaultHostServer,
  VAULT_HOST_PROTOCOL_VERSION,
  verify,
  type VaultHostServer,
} from '../src/index';

// Cheap KDF for tests only — production uses the intentionally-slow default.
const FAST_KDF = { ...DEFAULT_KDF_OPTS, t: 1, m: 256, p: 1 };

interface RpcResponse {
  id: number;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

/** Drive the server over in-process streams like the Rust shell would. */
class TestClient {
  readonly server: VaultHostServer;
  readonly events: Array<Record<string, unknown>> = [];
  shutdownCalled = false;

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
        this.route(line);
        idx = this.buffer.indexOf('\n');
      }
    });
    this.server = createVaultHostServer({
      input: this.input,
      output,
      onShutdown: () => {
        this.shutdownCalled = true;
      },
    });
  }

  private route(line: string): void {
    const msg = JSON.parse(line) as Record<string, unknown>;
    if (typeof msg['event'] === 'string') {
      this.events.push(msg);
      return;
    }
    const response = msg as unknown as RpcResponse;
    const resolve = this.pending.get(response.id);
    this.pending.delete(response.id);
    resolve?.(response);
  }

  /** Write a raw line (for malformed-input tests). */
  raw(line: string): void {
    this.input.write(`${line}\n`);
  }

  call(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<RpcResponse> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.input.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  async expectOk(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await this.call(method, params);
    assert.equal(
      response.ok,
      true,
      `${method} should succeed, got: ${JSON.stringify(response.error)}`,
    );
    return response.result ?? {};
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

test('server: host.ping round-trips with protocol version', async () => {
  const client = new TestClient();
  try {
    const result = await client.expectOk('host.ping');
    assert.equal(result['pong'], true);
    assert.equal(result['protocol'], VAULT_HOST_PROTOCOL_VERSION);
  } finally {
    await client.close();
  }
});

test('server: unknown method + malformed line are handled without crashing', async () => {
  const client = new TestClient();
  try {
    client.raw('this is not json {{{');
    const bad = await client.call('no.such.method');
    assert.equal(bad.ok, false);
    assert.equal(bad.error?.code, 'unknown-method');
    // Server is still alive after both.
    const result = await client.expectOk('host.ping');
    assert.equal(result['pong'], true);
  } finally {
    await client.close();
  }
});

test('server: doc.open on an unopened vault fails with vault-not-open', async () => {
  const client = new TestClient();
  try {
    const response = await client.call('doc.open', {
      root: '/nowhere',
      relativePath: 'a.md',
    });
    assert.equal(response.ok, false);
    assert.equal(response.error?.code, 'vault-not-open');
  } finally {
    await client.close();
  }
});

test('server: full doc round-trip — open, state hydrate, applyUpdate from a webview-like Y.Doc, flush to markdown twin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-rpc-'));
  const client = new TestClient();
  try {
    await writeFile(join(dir, 'paper-1.md'), 'Hello over RPC', 'utf8');
    await client.expectOk('vault.open', { root: dir });

    const opened = await client.expectOk('doc.open', {
      root: dir,
      relativePath: 'paper-1.md',
      sidecarFlushMs: 5,
      markdownFlushMs: 5,
    });
    const id = opened['id'] as string;
    const stateBase64 = opened['stateBase64'] as string;
    assert.ok(stateBase64.length > 0, 'doc.open returns hydration state');

    // Simulate the webview editor: hydrate a local Y.Doc from the wire state,
    // make an edit, and send only the incremental update back.
    const local = new Y.Doc();
    Y.applyUpdate(local, new Uint8Array(Buffer.from(stateBase64, 'base64')));
    let update: Uint8Array | null = null;
    local.on('update', (u: Uint8Array) => {
      update = u;
    });
    local.transact(() => {
      const fragment = local.getXmlFragment('prosemirror');
      const paragraph = new Y.XmlElement('paragraph');
      paragraph.insert(0, [new Y.XmlText('Injected via applyUpdate')]);
      fragment.insert(fragment.length, [paragraph]);
    });
    assert.ok(update, 'local edit produced an update');
    await client.expectOk('doc.applyUpdate', {
      root: dir,
      id,
      updateBase64: Buffer.from(update!).toString('base64'),
    });

    await client.expectOk('doc.flush', { root: dir, id });
    const markdown = await readFile(join(dir, 'paper-1.md'), 'utf8');
    assert.match(markdown, /Hello over RPC/);
    assert.match(markdown, /Injected via applyUpdate/);

    // doc.state returns a snapshot a fresh client can hydrate from.
    const state = await client.expectOk('doc.state', { root: dir, id });
    const fresh = new Y.Doc();
    Y.applyUpdate(
      fresh,
      new Uint8Array(Buffer.from(state['stateBase64'] as string, 'base64')),
    );
    assert.match(
      fresh.getXmlFragment('prosemirror').toString(),
      /Injected via applyUpdate/,
    );

    await client.expectOk('vault.close', { root: dir });
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('server: identity load → sign → verify; sign before load is rejected', async () => {
  const previousEnv = process.env['VAULT_HOST_ALLOW_TEST_KDF'];
  process.env['VAULT_HOST_ALLOW_TEST_KDF'] = '1';
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-rpc-id-'));
  const client = new TestClient();
  try {
    await client.expectOk('vault.open', { root: dir });

    const early = await client.call('identity.sign', {
      root: dir,
      payloadBase64: Buffer.from('x').toString('base64'),
    });
    assert.equal(early.ok, false);
    assert.equal(early.error?.code, 'identity-not-loaded');

    const loaded = await client.expectOk('identity.load', {
      root: dir,
      passphrase: 'correct horse',
      kdfInsecureForTest: FAST_KDF,
    });
    assert.equal(loaded['created'], true);
    const publicKeyHex = loaded['publicKeyHex'] as string;
    assert.equal(publicKeyHex.length, 64);

    const payload = Buffer.from('canonical provenance bytes');
    const signed = await client.expectOk('identity.sign', {
      root: dir,
      payloadBase64: payload.toString('base64'),
    });
    const signatureHex = signed['signatureHex'] as string;
    const signatureBytes = new Uint8Array(Buffer.from(signatureHex, 'hex'));
    const publicKeyBytes = new Uint8Array(Buffer.from(publicKeyHex, 'hex'));
    assert.equal(
      verify(
        signatureBytes as Parameters<typeof verify>[0],
        new Uint8Array(payload),
        publicKeyBytes as Parameters<typeof verify>[2],
      ),
      true,
      'RPC signature verifies against RPC public key',
    );
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
    if (previousEnv === undefined) {
      delete process.env['VAULT_HOST_ALLOW_TEST_KDF'];
    } else {
      process.env['VAULT_HOST_ALLOW_TEST_KDF'] = previousEnv;
    }
  }
});

test('server: host.shutdown responds, closes vaults and fires onShutdown', async () => {
  const client = new TestClient();
  try {
    const result = await client.expectOk('host.shutdown');
    assert.equal(result['shuttingDown'], true);
    // onShutdown fires after close() completes inside the queued handler.
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(client.shutdownCalled, true);
  } finally {
    await client.close();
  }
});

test('server: vault.createFile writes night/ file create-only; second write → file-exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-night-'));
  const client = new TestClient();
  try {
    await client.expectOk('vault.open', { root: dir });
    const content = '---\nnight: thought\nid: n-1\ntitle: t\n---\n\n凌晨的想法。';
    const created = await client.expectOk('vault.createFile', {
      root: dir,
      relativePath: 'night/2026-07-18-t.md',
      contentUtf8: content,
    });
    assert.equal(created['created'], true);
    assert.equal(
      await readFile(join(dir, 'night/2026-07-18-t.md'), 'utf8'),
      content,
    );
    const dup = await client.call('vault.createFile', {
      root: dir,
      relativePath: 'night/2026-07-18-t.md',
      contentUtf8: 'other',
    });
    assert.equal(dup.ok, false);
    assert.equal(dup.error?.code, 'file-exists');
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('server: vault.createFile rejects path traversal out of the vault root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-guard-'));
  const client = new TestClient();
  try {
    await client.expectOk('vault.open', { root: dir });
    const escape = await client.call('vault.createFile', {
      root: dir,
      relativePath: '../outside.md',
      contentUtf8: 'x',
    });
    assert.equal(escape.ok, false);
    assert.equal(escape.error?.code, 'bad-request');
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('server: vault.listFiles lists night/ recursively, excludes .vault, missing subdir = empty', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-host-list-'));
  const client = new TestClient();
  try {
    await client.expectOk('vault.open', { root: dir });
    await client.expectOk('vault.createFile', {
      root: dir,
      relativePath: 'night/2026-07-18-b.md',
      contentUtf8: 'b',
    });
    await client.expectOk('vault.createFile', {
      root: dir,
      relativePath: 'night/2026-07-18-a.md',
      contentUtf8: 'a',
    });
    await writeFile(join(dir, 'top.md'), 'top', 'utf8');

    const night = await client.expectOk('vault.listFiles', {
      root: dir,
      subdir: 'night',
    });
    assert.deepEqual(night['files'], [
      'night/2026-07-18-a.md',
      'night/2026-07-18-b.md',
    ]);

    const all = await client.expectOk('vault.listFiles', { root: dir });
    assert.ok((all['files'] as string[]).includes('top.md'));
    assert.ok(
      (all['files'] as string[]).every((f) => !f.startsWith('.vault')),
      '.vault control plane must stay hidden',
    );

    const missing = await client.expectOk('vault.listFiles', {
      root: dir,
      subdir: 'bridge',
    });
    assert.deepEqual(missing['files'], []);
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
});
