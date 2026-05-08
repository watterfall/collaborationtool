// Phase 1 D8 backend extracted as a regression-preserving impl.
// Identical semantics to the pre-D11 DocRoom: fixed-size ring buffer,
// no persistence beyond gateway process lifetime.
//
// Used:
//   - by default when no YSWEET_URL is configured (single-instance dev)
//   - in unit tests where we want a deterministic, in-process backend

import type { BodyBackend, BodyUpdateRecord } from './types';

export class InMemoryBodyBackend implements BodyBackend {
  private readonly history: BodyUpdateRecord[] = [];
  private readonly listeners = new Set<(update: Uint8Array) => void>();
  private readonly maxHistory: number;

  constructor(opts: { maxHistory?: number } = {}) {
    this.maxHistory = opts.maxHistory ?? 100;
  }

  persist(update: BodyUpdateRecord): void {
    this.history.push(update);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  async getState(): Promise<Uint8Array | null> {
    if (this.history.length === 0) return null;
    // Concatenate all body updates so a fresh joiner can receive them
    // sequentially. This is intentionally lossy versus a true Yjs
    // state-merge — Phase 1 single-gateway dev doesn't need merge
    // because clients re-apply each update independently. The y-sweet
    // backend returns a properly merged update.
    let total = 0;
    for (const u of this.history) total += u.bytes.byteLength;
    const out = new Uint8Array(total);
    let off = 0;
    for (const u of this.history) {
      out.set(u.bytes, off);
      off += u.bytes.byteLength;
    }
    return out;
  }

  /**
   * In-memory backend never receives external updates (no other gateway
   * instances share state). The listener is registered for symmetry but
   * is never invoked.
   */
  onExternalUpdate(listener: (update: Uint8Array) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    this.history.length = 0;
    this.listeners.clear();
  }

  // ----- test affordances (not part of the BodyBackend interface) -----

  get historySize(): number {
    return this.history.length;
  }

  /** Returns the raw history array — for assertion in tests only. */
  snapshot(): readonly BodyUpdateRecord[] {
    return this.history;
  }
}
