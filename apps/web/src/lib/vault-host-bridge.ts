// Typed webview client for the vault-host dev-tier transport
// (apps/desktop/src-tauri/src/commands/vault_host.rs → packages/vault-host).
//
// 桌面端 webview 调用 Node vault host 的类型化封装。The Rust shell spawns the
// Node host and proxies ndjson JSON-RPC over stdio; this file wraps the four
// Tauri commands (`vault_host_start/rpc/status/stop`) with per-method types.
//
// Browser-safe: no node:fs. Outside the Tauri runtime every call degrades to
// null via safeInvoke — callers must isTauri()-gate the UI (same contract as
// vault-bridge.ts). Server push events are emitted Rust-side on
// "vault-host://event"; webview listening lands with the vault UI wave.

import { safeInvoke } from './desktop-bridge';

/** Mirror of the Rust `VaultHostStatus` struct. */
export interface VaultHostStatus {
  running: boolean;
  pid: number | null;
}

/** Result of `doc.open` / `doc.state` — Y.Doc bytes travel base64-encoded. */
export interface VaultDocState {
  id: string;
  stateBase64: string;
}

/** Result of `identity.load`. */
export interface VaultIdentityInfo {
  publicKeyHex: string;
  created: boolean;
}

/**
 * Start (or reuse) the Node vault host. `entry` overrides the server entry
 * file; omit it in dev — the shell walks up from cwd to find the repo
 * checkout. Returns null outside Tauri or when the spawn fails (missing
 * Node / no repo checkout — the Rust error is bilingual and logged).
 */
export async function startVaultHost(
  entry?: string,
): Promise<VaultHostStatus | null> {
  return safeInvoke<VaultHostStatus>(
    'vault_host_start',
    entry ? { entry } : {},
  );
}

export async function vaultHostStatus(): Promise<VaultHostStatus | null> {
  return safeInvoke<VaultHostStatus>('vault_host_status');
}

/** Graceful shutdown: the host flushes every open vault before exiting. */
export async function stopVaultHost(): Promise<void> {
  await safeInvoke<null>('vault_host_stop');
}

async function rpc<T>(
  method: string,
  params?: Record<string, unknown>,
): Promise<T | null> {
  return safeInvoke<T>('vault_host_rpc', { method, params: params ?? {} });
}

export async function pingVaultHost(): Promise<{
  pong: boolean;
  protocol: number;
} | null> {
  return rpc('host.ping');
}

export async function openVaultSession(
  root: string,
): Promise<{ root: string; opened: boolean } | null> {
  return rpc('vault.open', { root });
}

export async function closeVaultSession(
  root: string,
): Promise<{ root: string; closed: boolean } | null> {
  return rpc('vault.close', { root });
}

/** Start pushing external-edit events for `root` on "vault-host://event". */
export async function watchVaultSession(
  root: string,
): Promise<{ root: string; watching: boolean } | null> {
  return rpc('vault.watch', { root });
}

export async function unwatchVaultSession(
  root: string,
): Promise<{ root: string; watching: boolean } | null> {
  return rpc('vault.unwatch', { root });
}

/**
 * Open a document and receive its full Y.Doc state for editor hydration.
 * The returned `id` keys all further doc.* calls.
 */
export async function openVaultDocument(
  root: string,
  relativePath: string,
  options?: { id?: string; sidecarFlushMs?: number; markdownFlushMs?: number },
): Promise<VaultDocState | null> {
  return rpc('doc.open', { root, relativePath, ...options });
}

/**
 * Fetch a state snapshot; pass the local state vector (base64) to receive
 * only the missing delta instead of the full state.
 */
export async function vaultDocumentState(
  root: string,
  id: string,
  baseStateVectorBase64?: string,
): Promise<VaultDocState | null> {
  return rpc('doc.state', {
    root,
    id,
    ...(baseStateVectorBase64 ? { baseStateVectorBase64 } : {}),
  });
}

/** Apply an incremental Y.Doc update produced by the webview editor. */
export async function applyVaultDocumentUpdate(
  root: string,
  id: string,
  updateBase64: string,
): Promise<{ id: string; applied: boolean } | null> {
  return rpc('doc.applyUpdate', { root, id, updateBase64 });
}

/** Force-flush sidecar + markdown twin (e.g. before navigating away). */
export async function flushVaultDocument(
  root: string,
  id: string,
): Promise<{ id: string; flushed: boolean } | null> {
  return rpc('doc.flush', { root, id });
}

/**
 * Load (or first-run create) the vault's ed25519 identity. The keypair stays
 * in the Node host process; only the public key crosses the wire.
 * 密钥对留在 Node 主机进程内，只有公钥过线。
 */
export async function loadVaultIdentity(
  root: string,
  passphrase: string,
): Promise<VaultIdentityInfo | null> {
  return rpc('identity.load', { root, passphrase });
}

/** Sign canonical payload bytes (base64) with the loaded vault identity. */
export async function signWithVaultIdentity(
  root: string,
  payloadBase64: string,
): Promise<{ signatureHex: string } | null> {
  return rpc('identity.sign', { root, payloadBase64 });
}
