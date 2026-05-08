// BodyBackend — abstraction over where the per-document body history
// lives.
//
// Phase 1 D11 ships TWO implementations:
//   - InMemoryBackend  — capped ring buffer, lifetime = gateway process
//   - YSweetBackend    — durable; persists to S3-compat via y-sweet
//
// The DocRoom always owns broadcast to local members. The backend is
// responsible for:
//   1. persisting body updates that members write
//   2. re-emitting updates that originated outside this gateway (e.g.
//      another gateway instance pushed via y-sweet) so members can be
//      kept in sync horizontally
//   3. providing the doc's current full state to a fresh joiner (state
//      replay path)
//
// Keeping these three concerns in the backend means the room logic
// (capability gating, mode classification, draft routing) doesn't change
// when we swap the backend.

export interface BodyUpdateRecord {
  bytes: Uint8Array;
  /** Optional — used by the in-memory backend's catch-up replay. */
  receivedAt?: Date;
}

export interface BodyBackend {
  /**
   * Persist + acknowledge a body update originating from this gateway.
   * The room has already broadcast to local members; this call is a
   * fire-and-forget durable write.
   */
  persist(update: BodyUpdateRecord): Promise<void> | void;

  /**
   * Current full state of the doc as a Yjs `update` binary, or null when
   * the doc has no state yet. New joiners get this once at handshake to
   * catch up.
   */
  getState(): Promise<Uint8Array | null>;

  /**
   * Subscribe to updates that arrived from outside this room (e.g. from
   * another gateway instance via y-sweet). The room will broadcast these
   * to all its members.
   *
   * Returns an unsubscribe function.
   */
  onExternalUpdate(listener: (update: Uint8Array) => void): () => void;

  /** Free any resources (WebSocket to y-sweet, timers, etc.). */
  close(): Promise<void>;
}
