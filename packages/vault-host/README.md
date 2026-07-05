# @collaborationtool/vault-host

Desktop-side **Node host** that composes three previously-isolated packages
into one vault API:

- `@collaborationtool/vault-fs` — markdown ↔ Y.Doc reconcile, sidecar IO, file watch
- `@collaborationtool/doc-store` (`/filesystem`) — `FileSystemDocumentHandle`
- `@collaborationtool/identity` — ed25519 keypair + signing

## Why this package exists

`doc-store` shipped the `FileSystemHooks` injection seam (Phase 4 W7.1) and
`vault-fs` shipped the exact functions that fill it (Spike-2), but **nobody
wired them together**. This package is that wiring, plus the identity glue the
desktop shell needs to sign provenance entries.

## Where it runs (ADR-0017 §2.2)

In the client-first runtime, `vault-fs` (chokidar), `doc-store` filesystem
backend (`node:fs`) and `identity` (node crypto) are **Node-only** — they
cannot run in the browser webview or in Rust. So they run on the Node side.
The Tauri shell (`apps/desktop`) owns native path operations
(`commands/vault.rs`: validate + create the `.vault/` skeleton, list docs,
read the plaintext public key); this package owns the CRDT reconcile + signing.

The **transport** that lets the Tauri webview talk to this host (bundling a
Node runtime + Tauri sidecar spawn + IPC) is deliberately **not** built here —
it needs a runtime-bundling dependency decision. Until then, `vault-host` is
consumed as a library (and is fully unit-tested as one).

## API

```ts
import {
  VaultSession,
  loadOrCreateIdentity,
  signWithKeypair,
  verify,
} from '@collaborationtool/vault-host';

const session = await VaultSession.open('/Users/x/MyVault');
const doc = await session.openDocument('papers/draft-1.md');
// ...edit the Y.Doc via doc; debounced flush writes sidecar + markdown twin...
await session.flushAll(); // force durable write before quit
await session.close();

const { keypair } = await loadOrCreateIdentity('/Users/x/MyVault', passphrase);
const sig = signWithKeypair(keypair, canonicalBytes);
```
