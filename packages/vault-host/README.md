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

## Transport (dev-tier, zero new dependencies)

The webview reaches this host over **stdio ndjson JSON-RPC**:

```
webview (vault-host-bridge.ts)
  → tauri invoke vault_host_rpc          (apps/desktop commands/vault_host.rs)
  → spawn: node --import tsx src/server-main.ts   (system Node, repo checkout)
  → createVaultHostServer (src/server.ts)
```

Methods: `host.ping / vault.open|close|watch|unwatch / doc.open|state|
applyUpdate|flush / identity.load|sign / host.shutdown`. Y.Doc bytes travel
base64-encoded through the `DocumentHandle` abstract API (the `.yDoc` escape
hatch stays untouched). Server push events reach the webview on the
`vault-host://event` Tauri event.

**Deliberately deferred**: bundling a Node runtime into the desktop release
(Tauri sidecar `externalBin` / Node SEA, ±60MB per platform). That is release
engineering gated behind the Phase 6 W2-W3 runtime gates — dev machines and
dogfood run from the repo checkout (`VAULT_HOST_ENTRY` overrides the entry
path; `VAULT_HOST_NODE` overrides the Node binary). Until it lands, a packaged
desktop build reports a bilingual "entry not found" error instead of
pretending vault features work.
打包 Node runtime 进发行版被显式推迟——dev/dogfood 走仓库 checkout；发行版在
打包决策落地前会返回双语"未找到入口"错误，而不是假装可用。

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
