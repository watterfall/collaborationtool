// Vault file watcher — wraps chokidar with vault-aware path filtering.
// `.vault/` subtree is excluded (sidecar / index / provenance churn must
// NOT surface as user-visible drift).

import chokidar, { type FSWatcher } from 'chokidar';
import { resolve, sep } from 'node:path';

export type VaultEventKind = 'add' | 'change' | 'unlink';

export interface VaultEvent {
  kind: VaultEventKind;
  /** Absolute path. */
  path: string;
}

export interface VaultWatchHandle {
  close(): Promise<void>;
}

export async function watchVault(
  vaultRoot: string,
  handler: (event: VaultEvent) => void,
): Promise<VaultWatchHandle> {
  const root = resolve(vaultRoot);
  const vaultDirMarker = `${sep}.vault${sep}`;
  const vaultDirSuffix = `${sep}.vault`;
  const watcher: FSWatcher = chokidar.watch(root, {
    ignored: (p: string) =>
      p.includes(vaultDirMarker) || p.endsWith(vaultDirSuffix) || p.endsWith('.tmp'),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });
  watcher.on('add', (p) => handler({ kind: 'add', path: p }));
  watcher.on('change', (p) => handler({ kind: 'change', path: p }));
  watcher.on('unlink', (p) => handler({ kind: 'unlink', path: p }));
  // chokidar 4: wait for initial scan
  await new Promise<void>((res) => watcher.once('ready', () => res()));
  return {
    close: async () => {
      await watcher.close();
    },
  };
}
