// Tiny className combiner — same shape as `clsx`/`classnames` but with
// zero dependencies and a 10-line implementation, kept in-tree because
// Design.md §14 forbids pulling in shadcn/Radix/Headless UI utility libs.
//
// Accepts: string | number | false | null | undefined | record<string, truthy>
// Returns the space-joined non-empty classes. Stable order preserves
// the source order so cascade-sensitive overrides (e.g. variant > size >
// override) keep working.

export type CxInput =
  | string
  | number
  | false
  | null
  | undefined
  | Record<string, unknown>;

export function cx(...parts: CxInput[]): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === 'string' || typeof p === 'number') {
      const s = String(p).trim();
      if (s) out.push(s);
    } else if (typeof p === 'object') {
      for (const k of Object.keys(p)) {
        if (p[k]) out.push(k);
      }
    }
  }
  return out.join(' ');
}

export default cx;
