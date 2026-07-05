// @collaborationtool/vault-host — shared types + vault-layout helpers.
//
// vault-host 把三个已存在但从未被组合的包接线成一个 desktop 侧的
// "Node 主机" —— vault-fs（markdown↔Y.Doc reconcile + sidecar IO + watch）
// / doc-store filesystem-backend（DocumentHandle）/ identity（ed25519）。
// 在 client-first 拓扑里（ADR-0017 §2.2）这一层运行在 Node 侧，未来由
// Tauri 作为 sidecar 拉起；webview 只是 UI。
//
// vault-host composes three packages that existed in isolation into a
// single desktop-side "Node host": vault-fs (markdown↔Y.Doc reconcile +
// sidecar IO + watch) / doc-store filesystem-backend (DocumentHandle) /
// identity (ed25519). Per the client-first topology (ADR-0017 §2.2) this
// layer runs on the Node side, later spawned by Tauri as a sidecar; the
// webview is UI only.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Absolute filesystem path to a vault root, e.g. `/Users/x/MyVault`. */
export type VaultRoot = string;

/** Path of a document relative to the vault root, e.g. `papers/draft-1.md`. */
export type DocumentRelativePath = string;

/**
 * Sub-directories that make up the `.vault/` control plane (spec §3 /
 * ADR-0017 §2.2). Created eagerly on `VaultSession.open` so downstream
 * writers (sidecar / keys / pending-sync) never race on a missing dir.
 */
export const VAULT_CONTROL_DIRS = [
  '.vault',
  '.vault/yjs',
  '.vault/keys',
  '.vault/pending-sync',
] as const;

/** Options accepted when opening a document inside a vault session. */
export interface OpenDocumentOptions {
  /**
   * Stable identifier used for the sidecar filename (`.vault/yjs/<id>.bin`)
   * and log lines. Defaults to a slug derived from `relativePath`.
   */
  id?: string;
  /** Debounce window (ms) before flushing the Y.Doc sidecar. */
  sidecarFlushMs?: number;
  /** Debounce window (ms) before flushing the markdown twin. */
  markdownFlushMs?: number;
}

/**
 * Derive a stable, filesystem-safe document id from a vault-relative path.
 *
 * `papers/draft-1.md` → `papers-draft-1`. Deterministic so the same
 * markdown file always maps to the same `.vault/yjs/<id>.bin` sidecar
 * across sessions (cold-start relies on this).
 */
export function deriveDocId(relativePath: DocumentRelativePath): string {
  const withoutExt = relativePath.replace(/\.md$/i, '');
  const slug = withoutExt
    .replace(/[\\/]+/g, '-') // path separators → dash
    .replace(/[^a-zA-Z0-9._-]+/g, '-') // anything unsafe → dash
    .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
  return slug.length > 0 ? slug : 'document';
}

/**
 * Create the `.vault/` control-plane skeleton under a vault root. Idempotent
 * (mkdir recursive). Mirrors the Rust-side `ensure_vault_skeleton` so a vault
 * opened from either the desktop shell or the Node host has the same layout.
 */
export async function ensureVaultSkeleton(root: VaultRoot): Promise<void> {
  for (const sub of VAULT_CONTROL_DIRS) {
    await mkdir(join(root, sub), { recursive: true });
  }
}
