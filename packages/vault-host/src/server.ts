// vault-host stdio JSON-RPC server — the transport that lets the Tauri
// webview reach this Node host (ADR-0017 §2.2 sidecar 拓扑的 dev-tier 实现).
//
// Protocol (ndjson, one JSON object per line):
//   request   {"id": 1, "method": "doc.open", "params": {...}}
//   response  {"id": 1, "ok": true, "result": {...}}
//           | {"id": 1, "ok": false, "error": {"code": "...", "message": "..."}}
//   event     {"event": "vault-event", "payload": {...}}   (server → client push)
//
// Design constraints:
//   - Zero new dependencies: node:readline framing, Buffer base64 for bytes.
//   - Y.Doc bytes cross the wire base64-encoded via the DocumentHandle
//     abstract API ONLY (encodeStateAsUpdate / encodeDelta / applyUpdate) —
//     the `.yDoc` escape hatch stays untouched (doc-store grep gate).
//   - Streams are injected so tests drive the server in-process; the real
//     entry (`server-main.ts`) wires process.stdin/stdout.
//
// 这是 dev-tier 传输：由 Tauri 侧 spawn 系统 Node 运行本 server。
// "打包 Node runtime 进发行版"是被推迟的 release 工程决策（见 README）。

import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import type { Keypair } from '@collaborationtool/identity';
import type { FileSystemDocumentHandle } from '@collaborationtool/doc-store/filesystem';

import type { VaultRoot } from './_shared';
import {
  loadOrCreateIdentity,
  signWithKeypair,
  toHex,
  type LoadIdentityOptions,
} from './identity-host';
import { VaultSession, type VaultWatchHandle } from './vault-session';

export const VAULT_HOST_PROTOCOL_VERSION = 1;

/** Error slugs are the machine contract; messages are bilingual for humans. */
export type VaultHostErrorCode =
  | 'bad-request'
  | 'unknown-method'
  | 'vault-not-open'
  | 'doc-not-open'
  | 'identity-not-loaded'
  | 'internal';

interface RpcError {
  code: VaultHostErrorCode;
  message: string;
}

class VaultHostRpcError extends Error {
  readonly code: VaultHostErrorCode;
  constructor(code: VaultHostErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function bad(message: string): VaultHostRpcError {
  return new VaultHostRpcError('bad-request', message);
}

interface OpenVault {
  session: VaultSession;
  docs: Map<string, FileSystemDocumentHandle>;
  watch: VaultWatchHandle | null;
  identity: Keypair | null;
}

export interface VaultHostServerOptions {
  input: Readable;
  output: Writable;
  /** Called after `host.shutdown` has flushed + responded (entry exits here). */
  onShutdown?: () => void;
}

export interface VaultHostServer {
  /** Flush + close every open vault and stop reading input. */
  close(): Promise<void>;
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw bad(`${what} must be an object / ${what} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function requireString(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw bad(`missing string param "${key}" / 缺少字符串参数 "${key}"`);
  }
  return v;
}

function optionalNumber(
  params: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = params[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw bad(`param "${key}" must be a number / 参数 "${key}" 必须是数字`);
  }
  return v;
}

function fromBase64(b64: string, what: string): Uint8Array {
  try {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  } catch {
    throw bad(`${what} is not valid base64 / ${what} 不是合法 base64`);
  }
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Create a vault-host JSON-RPC server bound to the given streams. Returns a
 * handle whose `close()` flushes + closes every open vault.
 */
export function createVaultHostServer(
  options: VaultHostServerOptions,
): VaultHostServer {
  const vaults = new Map<VaultRoot, OpenVault>();
  let closed = false;

  const send = (msg: unknown): void => {
    if (closed) return;
    options.output.write(`${JSON.stringify(msg)}\n`);
  };

  const getVault = (root: string): OpenVault => {
    const open = vaults.get(root);
    if (!open) {
      throw new VaultHostRpcError(
        'vault-not-open',
        `vault not open: ${root} — call vault.open first / vault 未打开，请先调用 vault.open`,
      );
    }
    return open;
  };

  const getDoc = (root: string, id: string): FileSystemDocumentHandle => {
    const doc = getVault(root).docs.get(id);
    if (!doc) {
      throw new VaultHostRpcError(
        'doc-not-open',
        `document not open: ${id} — call doc.open first / 文档未打开，请先调用 doc.open`,
      );
    }
    return doc;
  };

  const closeVault = async (root: string): Promise<void> => {
    const open = vaults.get(root);
    if (!open) return;
    open.watch?.close();
    await open.session.close();
    open.docs.clear();
    vaults.delete(root);
  };

  const closeAll = async (): Promise<void> => {
    await Promise.all([...vaults.keys()].map((root) => closeVault(root)));
  };

  const handlers: Record<
    string,
    (params: Record<string, unknown>) => Promise<unknown>
  > = {
    'host.ping': async () => ({
      pong: true,
      protocol: VAULT_HOST_PROTOCOL_VERSION,
    }),

    'vault.open': async (params) => {
      const root = requireString(params, 'root');
      if (!vaults.has(root)) {
        const session = await VaultSession.open(root);
        vaults.set(root, {
          session,
          docs: new Map(),
          watch: null,
          identity: null,
        });
      }
      return { root, opened: true };
    },

    'vault.close': async (params) => {
      const root = requireString(params, 'root');
      await closeVault(root);
      return { root, closed: true };
    },

    'vault.watch': async (params) => {
      const root = requireString(params, 'root');
      const open = getVault(root);
      if (!open.watch) {
        open.watch = await open.session.watch((event) => {
          send({ event: 'vault-event', payload: { root, ...event } });
        });
      }
      return { root, watching: true };
    },

    'vault.unwatch': async (params) => {
      const root = requireString(params, 'root');
      const open = getVault(root);
      open.watch?.close();
      open.watch = null;
      return { root, watching: false };
    },

    'doc.open': async (params) => {
      const root = requireString(params, 'root');
      const relativePath = requireString(params, 'relativePath');
      const open = getVault(root);
      const handle = await open.session.openDocument(relativePath, {
        ...(typeof params['id'] === 'string' && params['id'].length > 0
          ? { id: params['id'] }
          : {}),
        ...(optionalNumber(params, 'sidecarFlushMs') !== undefined
          ? { sidecarFlushMs: optionalNumber(params, 'sidecarFlushMs')! }
          : {}),
        ...(optionalNumber(params, 'markdownFlushMs') !== undefined
          ? { markdownFlushMs: optionalNumber(params, 'markdownFlushMs')! }
          : {}),
      });
      open.docs.set(handle.id, handle);
      return { id: handle.id, stateBase64: toBase64(handle.encodeStateAsUpdate()) };
    },

    'doc.state': async (params) => {
      const root = requireString(params, 'root');
      const id = requireString(params, 'id');
      const doc = getDoc(root, id);
      const baseB64 = params['baseStateVectorBase64'];
      if (typeof baseB64 === 'string' && baseB64.length > 0) {
        const base = fromBase64(baseB64, 'baseStateVectorBase64');
        return { id, stateBase64: toBase64(doc.encodeDelta(base)) };
      }
      return { id, stateBase64: toBase64(doc.encodeStateAsUpdate()) };
    },

    'doc.applyUpdate': async (params) => {
      const root = requireString(params, 'root');
      const id = requireString(params, 'id');
      const update = fromBase64(
        requireString(params, 'updateBase64'),
        'updateBase64',
      );
      getDoc(root, id).applyUpdate(update);
      return { id, applied: true };
    },

    'doc.flush': async (params) => {
      const root = requireString(params, 'root');
      const id = requireString(params, 'id');
      await getDoc(root, id).flush();
      return { id, flushed: true };
    },

    'identity.load': async (params) => {
      const root = requireString(params, 'root');
      const passphrase = requireString(params, 'passphrase');
      const open = getVault(root);
      // Test-only cheap KDF, gated behind an explicit env opt-in so a
      // production caller can never weaken key derivation over RPC.
      const kdf =
        process.env['VAULT_HOST_ALLOW_TEST_KDF'] === '1' &&
        typeof params['kdfInsecureForTest'] === 'object' &&
        params['kdfInsecureForTest'] !== null
          ? (params['kdfInsecureForTest'] as LoadIdentityOptions['kdf'])
          : undefined;
      const { keypair, created } = await loadOrCreateIdentity(
        root,
        passphrase,
        kdf ? { kdf } : {},
      );
      open.identity = keypair;
      return { publicKeyHex: toHex(keypair.publicKey), created };
    },

    'identity.sign': async (params) => {
      const root = requireString(params, 'root');
      const open = getVault(root);
      if (!open.identity) {
        throw new VaultHostRpcError(
          'identity-not-loaded',
          'identity not loaded — call identity.load first / 身份未加载，请先调用 identity.load',
        );
      }
      const payload = fromBase64(
        requireString(params, 'payloadBase64'),
        'payloadBase64',
      );
      const signature = signWithKeypair(open.identity, payload);
      return { signatureHex: toHex(signature) };
    },

    'host.shutdown': async () => ({ shuttingDown: true }),
  };

  const handleLine = async (line: string): Promise<void> => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Noise on stdin (e.g. a stray log line) — ignore rather than crash.
      return;
    }

    let id: unknown;
    try {
      const req = asRecord(parsed, 'request');
      id = req['id'];
      if (typeof id !== 'number') {
        throw bad('request.id must be a number / request.id 必须是数字');
      }
      const method = requireString(req, 'method');
      const handler = handlers[method];
      if (!handler) {
        throw new VaultHostRpcError(
          'unknown-method',
          `unknown method: ${method} / 未知方法：${method}`,
        );
      }
      const params =
        req['params'] === undefined
          ? {}
          : asRecord(req['params'], 'request.params');
      const result = await handler(params);
      send({ id, ok: true, result });
      if (method === 'host.shutdown') {
        await server.close();
        options.onShutdown?.();
      }
    } catch (error) {
      const rpcError: RpcError =
        error instanceof VaultHostRpcError
          ? { code: error.code, message: error.message }
          : {
              code: 'internal',
              message: `internal error / 内部错误: ${
                error instanceof Error ? error.message : String(error)
              }`,
            };
      if (typeof id === 'number') {
        send({ id, ok: false, error: rpcError });
      }
    }
  };

  const rl = createInterface({ input: options.input });
  // Serialize request handling so per-vault state mutations never interleave.
  let queue: Promise<void> = Promise.resolve();
  rl.on('line', (line) => {
    queue = queue.then(() => handleLine(line));
  });

  // NOTE: close() must NOT await `queue` — host.shutdown calls close() from
  // inside a queued handler, and awaiting the queue there would deadlock on
  // the very promise that is executing. Callers close after their last
  // response has arrived, so skipping the queue await is safe.
  const server: VaultHostServer = {
    close: async () => {
      if (closed) return;
      closed = true;
      rl.close();
      await closeAll();
    },
  };

  return server;
}
