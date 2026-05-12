// Shared types for the vault-fs spike.
// All public types live here so consumers import a single shape source.

export type VaultPath = string; // absolute fs path to vault root (e.g. /Users/x/MyVault)
export type DocumentRelativePath = string; // path inside vault, e.g. "paper-1.md"
export type SidecarBytes = Uint8Array;
export type ContentHash = string; // sha-256 hex

export interface DriftReport {
  drifted: boolean;
  markdownHash: ContentHash;
  emittedHash: ContentHash;
}

export interface ConflictRegion {
  startLineNumber: number;
  endLineNumber: number;
  baseContent: string;
  localContent: string;
  remoteContent: string;
}

export interface ThreeWayMergeResult {
  // The merged Y.Doc encoded as an update binary (callers apply onto fresh
  // Y.Doc to materialise).
  mergedUpdate: Uint8Array;
  conflicts: readonly ConflictRegion[];
}
