// Phase 4 W4: production DoiResolver via doi.org HTTP redirect.
//
// doi.org issues a 30x redirect when the DOI resolves at the registrar
// (CrossRef / DataCite / etc.) or 404 / 5xx when it doesn't. We use
// HEAD with redirect=manual so we don't follow to the publisher —
// that saves bandwidth and avoids triggering bot mitigation on the
// publisher side.
//
// Tests inject their own resolver; this module is wired only in the
// agent-worker entrypoint when scope opts into broken-citation.

import type { DoiResolver } from './maintenance-scan';

export interface HttpDoiResolverOptions {
  /** Override fetch (tests). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout (default 8000ms). */
  timeoutMs?: number;
  /** Override base URL (default https://doi.org). */
  baseUrl?: string;
  /** User-Agent header. doi.org operators ask polite identification. */
  userAgent?: string;
}

export function httpDoiResolver(opts: HttpDoiResolverOptions = {}): DoiResolver {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const baseUrl = (opts.baseUrl ?? 'https://doi.org').replace(/\/+$/, '');
  const userAgent =
    opts.userAgent ??
    'collaborationtool-maintenance-scan/0.0 (+https://github.com/watterfall/collaborationtool)';

  return {
    async resolve(doi) {
      const url = `${baseUrl}/${encodeURI(doi)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchFn(url, {
          method: 'HEAD',
          redirect: 'manual',
          signal: ctrl.signal,
          headers: { 'user-agent': userAgent },
        });
        // 200/300-range = ok; doi.org issues 302 to publisher when
        // resolvable. 404 / 410 / 5xx = broken.
        if (res.status >= 200 && res.status < 400) {
          return { ok: true };
        }
        return { ok: false, reason: `http-${res.status}` };
      } catch (err) {
        return {
          ok: false,
          reason:
            err instanceof Error && err.name === 'AbortError'
              ? `timeout-${timeoutMs}ms`
              : err instanceof Error
                ? err.message
                : String(err),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
