// Base64 ↔ Uint8Array — vault-host RPC carries Y.Doc bytes base64-encoded
// over the stdio transport (packages/vault-host/src/server.ts contract).
// Browser-safe (atob/btoa); Node ≥ 16 exposes the same globals for tests.

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to stay under the argument-spread limit on large documents.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
