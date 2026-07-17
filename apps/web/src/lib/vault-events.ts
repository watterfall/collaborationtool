// vault-host push events — webview-side parsing.
//
// Rust (`commands/vault_host.rs`) forwards每条 host ndjson event line到
// Tauri event "vault-host://event"。Payload 形状（server.ts vault.watch）：
//   {"event": "vault-event", "payload": {root, kind, path}}
// classify_line 转发的是整行 JSON value，所以这里防御性地兼容
// "已剥壳"（直接 {root,kind,path}）与"带壳"（{event,payload}）两种形状。

export const VAULT_HOST_EVENT = 'vault-host://event';

export type VaultHostEventKind = 'add' | 'change' | 'unlink';

export interface VaultHostEvent {
  root: string;
  kind: VaultHostEventKind;
  path: string;
}

const KINDS: readonly string[] = ['add', 'change', 'unlink'];

function shape(value: unknown): VaultHostEvent | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (
    typeof rec.root === 'string' &&
    typeof rec.path === 'string' &&
    typeof rec.kind === 'string' &&
    KINDS.includes(rec.kind)
  ) {
    return {
      root: rec.root,
      kind: rec.kind as VaultHostEventKind,
      path: rec.path,
    };
  }
  return null;
}

/** Parse a raw "vault-host://event" payload; null when malformed. */
export function parseVaultHostEvent(raw: unknown): VaultHostEvent | null {
  const direct = shape(raw);
  if (direct) return direct;
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    if (rec.event === 'vault-event') {
      return shape(rec.payload);
    }
  }
  return null;
}
