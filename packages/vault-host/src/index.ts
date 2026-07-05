// @collaborationtool/vault-host — desktop Node host that composes vault-fs +
// doc-store filesystem-backend + identity into one vault API.
//
// Runs on the Node side of the client-first runtime (ADR-0017 §2.2). The
// Tauri shell owns native path operations (see apps/desktop commands/vault.rs);
// this package owns the CRDT reconcile + signing that must run in Node.
//
// Public surface:
//   - VaultSession — open a vault, open documents, watch, flush, close
//   - loadOrCreateIdentity / signWithKeypair — vault keypair + signing
//   - createVaultHostServer — stdio ndjson JSON-RPC transport (dev-tier)
//   - createFileSystemHooks — the vault-fs → doc-store binding (escape hatch)
//   - deriveDocId / ensureVaultSkeleton / VAULT_CONTROL_DIRS — layout helpers

export {
  deriveDocId,
  ensureVaultSkeleton,
  VAULT_CONTROL_DIRS,
} from './_shared';
export type {
  DocumentRelativePath,
  OpenDocumentOptions,
  VaultRoot,
} from './_shared';

export { createFileSystemHooks } from './hooks';

export { VaultSession } from './vault-session';
export type { VaultEvent, VaultWatchHandle } from './vault-session';

export {
  createVaultHostServer,
  VAULT_HOST_PROTOCOL_VERSION,
} from './server';
export type {
  VaultHostErrorCode,
  VaultHostServer,
  VaultHostServerOptions,
} from './server';

export {
  loadOrCreateIdentity,
  signWithKeypair,
  verify,
  toHex,
} from './identity-host';
export type {
  Ed25519Signature,
  Keypair,
  LoadedIdentity,
  LoadIdentityOptions,
} from './identity-host';
