// Phase 5 Wave B Spike-1: detect Tauri runtime + safely invoke Rust commands.
//
// In a plain Next.js page (browser tab), Tauri globals are absent → all
// invoke calls degrade to null. UI components should check isTauri() before
// rendering desktop-only affordances.

interface TauriInternals {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  /** Tauri 2 registers callbacks for event push through this helper. */
  transformCallback?<T>(cb: (payload: T) => void, once?: boolean): number;
}

function getInternals(): TauriInternals | null {
  const w = globalThis as unknown as Record<string, unknown>;
  const internals = w['__TAURI_INTERNALS__'];
  if (!internals || typeof internals !== 'object') return null;
  if (typeof (internals as TauriInternals).invoke !== 'function') return null;
  return internals as TauriInternals;
}

export function isTauri(): boolean {
  return getInternals() !== null;
}

export async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const internals = getInternals();
  if (!internals) return null;
  try {
    return await internals.invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

/**
 * Subscribe to a Tauri event (e.g. "vault-host://event") without pulling
 * in @tauri-apps/api — uses the same __TAURI_INTERNALS__ surface as
 * safeInvoke (zero new deps, PR #10 约束). Returns an unlisten function,
 * or null outside Tauri / when the internals lack transformCallback.
 */
export async function safeListen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<(() => void) | null> {
  const internals = getInternals();
  if (!internals || typeof internals.transformCallback !== 'function') {
    return null;
  }
  const callbackId = internals.transformCallback<{ payload: T }>((evt) => {
    handler(evt.payload);
  });
  try {
    await internals.invoke('plugin:event|listen', {
      event,
      target: { kind: 'Any' },
      handler: callbackId,
    });
  } catch {
    return null;
  }
  return () => {
    void internals
      .invoke('plugin:event|unlisten', { event, eventId: callbackId })
      .catch(() => {});
  };
}
