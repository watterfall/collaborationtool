// Phase 6: typed webview → Rust client for the native vault commands
// (apps/desktop/src-tauri/src/commands/vault.rs).
//
// 桌面端 webview 调用原生 vault 命令的类型化封装。These are the *native*
// operations Rust owns (open a vault, list its markdown docs, read its
// plaintext public key). The CRDT reconcile + signing live in the Node host
// (@collaborationtool/vault-host) and are reached separately once the sidecar
// transport lands — deliberately NOT invoked from here.
//
// Browser-safe: no node:fs. In a plain browser tab (no Tauri) every call
// degrades to null via safeInvoke, so callers must isTauri()-gate the UI.

import { safeInvoke } from './desktop-bridge';

/** Mirror of the Rust `VaultInfo` struct. */
export interface VaultInfo {
  /** Absolute path of the vault root. */
  root: string;
  /** True if the directory already existed before opening. */
  existed: boolean;
  /** True once the `.vault/` control plane is present. */
  initialized: boolean;
}

/**
 * Open (creating if absent) a vault at `path` and ensure its `.vault/`
 * skeleton. Returns null outside the Tauri runtime.
 */
export async function openVault(path: string): Promise<VaultInfo | null> {
  return safeInvoke<VaultInfo>('vault_open', { path });
}

/**
 * List top-level markdown documents in a vault. Returns null outside Tauri.
 */
export async function listVaultDocuments(path: string): Promise<string[] | null> {
  return safeInvoke<string[]>('vault_list_documents', { path });
}

/**
 * Read the vault's plaintext ed25519 public key (e.g. `ed25519:<hex>`), or
 * null when the vault has no identity yet or outside Tauri. Callers cannot
 * distinguish "no key" from "no Tauri" here — gate on isTauri() first.
 */
export async function readVaultPublicKey(path: string): Promise<string | null> {
  return safeInvoke<string | null>('vault_public_key', { path });
}
