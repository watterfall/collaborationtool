// Phase 5 Wave B Spike-1: detect Tauri runtime + safely invoke Rust commands.
//
// In a plain Next.js page (browser tab), Tauri globals are absent → all
// invoke calls degrade to null. UI components should check isTauri() before
// rendering desktop-only affordances.

interface TauriInternals {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
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
