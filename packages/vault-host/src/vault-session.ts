// VaultSession — the desktop Node host's handle on one open vault.
//
// One session == one `~/MyVault` directory. It owns the `.vault/` skeleton,
// hands out `FileSystemDocumentHandle`s (Y.Doc + sidecar + markdown twin),
// and exposes the vault-fs file watcher so the host can react to external
// edits (spec §5 F1). Flush-all + close exist so the desktop shell can force
// a durable write before app quit (spec §5 F2).

import {
  FileSystemDocumentHandle,
  type FileSystemDocumentHandleOptions,
} from '@collaborationtool/doc-store/filesystem';
import {
  watchVault,
  type VaultEvent,
  type VaultWatchHandle,
} from '@collaborationtool/vault-fs';

import {
  deriveDocId,
  ensureVaultSkeleton,
  type DocumentRelativePath,
  type OpenDocumentOptions,
  type VaultRoot,
} from './_shared';
import { createFileSystemHooks } from './hooks';

export type { VaultEvent, VaultWatchHandle } from '@collaborationtool/vault-fs';

/**
 * An open vault. Construct via `VaultSession.open` (async — it ensures the
 * `.vault/` skeleton on disk before returning).
 */
export class VaultSession {
  readonly root: VaultRoot;

  /** Live handles keyed by document id, so `flushAll`/`close` can reach them. */
  private readonly handles = new Map<string, FileSystemDocumentHandle>();

  private constructor(root: VaultRoot) {
    this.root = root;
  }

  /** Open (and initialise if needed) a vault rooted at `root`. */
  static async open(root: VaultRoot): Promise<VaultSession> {
    await ensureVaultSkeleton(root);
    return new VaultSession(root);
  }

  /**
   * Open a document by its vault-relative path. Cold-start resolution
   * (sidecar → markdown → empty) is handled by `FileSystemDocumentHandle`.
   * Re-opening the same id returns the already-live handle.
   */
  async openDocument(
    relativePath: DocumentRelativePath,
    options: OpenDocumentOptions = {},
  ): Promise<FileSystemDocumentHandle> {
    const id = options.id ?? deriveDocId(relativePath);
    const existing = this.handles.get(id);
    if (existing) return existing;

    const createOpts: FileSystemDocumentHandleOptions = {
      id,
      vaultRoot: this.root,
      relativePath,
      hooks: createFileSystemHooks(),
      ...(options.sidecarFlushMs !== undefined
        ? { sidecarFlushMs: options.sidecarFlushMs }
        : {}),
      ...(options.markdownFlushMs !== undefined
        ? { markdownFlushMs: options.markdownFlushMs }
        : {}),
    };
    const handle = await FileSystemDocumentHandle.create(createOpts);
    this.handles.set(id, handle);
    return handle;
  }

  /**
   * Watch the vault for external file changes (user edited markdown outside
   * the app). The `.vault/` control plane is excluded by vault-fs. Returns a
   * handle whose `close()` stops the watcher.
   */
  async watch(
    handler: (event: VaultEvent) => void,
  ): Promise<VaultWatchHandle> {
    return watchVault(this.root, handler);
  }

  /** Force-flush every open document's sidecar + markdown. Call before quit. */
  async flushAll(): Promise<void> {
    await Promise.all(
      [...this.handles.values()].map((handle) => handle.flush()),
    );
  }

  /** Flush then destroy every open handle and clear the session's map. */
  async close(): Promise<void> {
    await this.flushAll();
    for (const handle of this.handles.values()) {
      handle.destroy();
    }
    this.handles.clear();
  }
}
