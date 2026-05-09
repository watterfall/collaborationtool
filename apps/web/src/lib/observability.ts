// Phase 1.5 #3 — Sentry + PostHog observability (env-gated, no SDK).
//
// Hand-rolled HTTP capture so apps/web doesn't pull ~150KB of vendor
// code; the protocols are stable and we only need two endpoints:
//
//   Sentry  → POST <DSN host>/api/<project>/envelope/   (Authorization
//             header per X-Sentry-Auth spec; envelope = ndjson with a
//             header line + item-header line + payload line)
//   PostHog → POST $POSTHOG_HOST/capture/                {api_key, event,
//             distinct_id, properties}
//
// Both fns are fire-and-forget: they `void` the fetch promise so route
// latency never blocks on the upstream (catch logs to stderr).
//
// PII scrubbing per ADR-0004 §2.5: never send the agent passage / user
// instruction / email / DOI value. Pass only structural metadata
// (route, kind, status code, error class). Property allow-list shape
// is enforced at the call site.

import { randomUUID } from 'node:crypto';

export interface ObservabilityEnv {
  sentryDsn?: string;
  posthogApiKey?: string;
  posthogHost?: string;
}

interface ParsedSentryDsn {
  endpoint: string;
  publicKey: string;
}

let cachedSentry: ParsedSentryDsn | null | undefined;

function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, '');
    if (!u.username || !projectId) return null;
    return {
      endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/`,
      publicKey: u.username,
    };
  } catch {
    return null;
  }
}

function getSentry(env: ObservabilityEnv): ParsedSentryDsn | null {
  if (cachedSentry !== undefined) return cachedSentry;
  if (!env.sentryDsn) {
    cachedSentry = null;
    return null;
  }
  cachedSentry = parseSentryDsn(env.sentryDsn);
  return cachedSentry;
}

/** Reset cached parse — for tests. */
export function _resetObservabilityCache(): void {
  cachedSentry = undefined;
}

const SENTRY_CLIENT = 'collaborationtool-web/0.0';
const SLOW_REQUEST_MS = 1_000; // ADR-0004 §2.5 threshold.

export interface CaptureErrorContext {
  /** Route or operation tag (e.g. `api.agent.invoke`). Stable / non-PII. */
  route: string;
  /** Optional anonymised principal id — never an email / display name. */
  principalId?: string;
  /** Optional structural tags (kind, status, etc). Strings only. */
  tags?: Record<string, string>;
}

export function captureError(
  err: unknown,
  context: CaptureErrorContext,
  envOverride?: ObservabilityEnv,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): void {
  const env = envOverride ?? readEnv();
  const sentry = getSentry(env);
  if (!sentry) return;

  const errorObj =
    err instanceof Error ? err : new Error(String(err ?? 'unknown error'));
  const eventId = randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();

  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    sent_at: now,
    dsn: env.sentryDsn,
  });
  const itemHeader = JSON.stringify({ type: 'event' });
  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    logger: context.route,
    tags: context.tags ?? {},
    user: context.principalId ? { id: context.principalId } : undefined,
    exception: {
      values: [
        {
          type: errorObj.name,
          value: errorObj.message.slice(0, 500),
          stacktrace: parseStack(errorObj.stack),
        },
      ],
    },
  });
  const body = `${envelopeHeader}\n${itemHeader}\n${payload}\n`;

  void fetchImpl(sentry.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-sentry-envelope',
      'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${sentry.publicKey}, sentry_client=${SENTRY_CLIENT}`,
    },
    body,
  }).catch((e) => {
    process.stderr.write(`[observability] sentry capture failed: ${String(e)}\n`);
  });
}

function parseStack(stack: string | undefined): unknown {
  if (!stack) return undefined;
  // Sentry expects { frames: [{filename, function, lineno, colno}] }.
  const lines = stack.split('\n').slice(1, 11);
  const frames = lines
    .map((line) => {
      const m = /^\s*at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/.exec(line);
      if (m) {
        return {
          function: m[1],
          filename: m[2],
          lineno: Number(m[3]),
          colno: Number(m[4]),
        };
      }
      const m2 = /^\s*at\s+(.+):(\d+):(\d+)/.exec(line);
      if (m2) {
        return {
          filename: m2[1],
          lineno: Number(m2[2]),
          colno: Number(m2[3]),
        };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .reverse();
  return frames.length > 0 ? { frames } : undefined;
}

export interface CaptureEventInput {
  /** PostHog event name, e.g. `agent.invoke.ok`. */
  event: string;
  /** Anon UUID — never a user id / email. Caller is responsible. */
  distinctId: string;
  /** Structural properties only (kind, status, durationMs, etc). */
  properties?: Record<string, unknown>;
}

export function captureEvent(
  input: CaptureEventInput,
  envOverride?: ObservabilityEnv,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): void {
  const env = envOverride ?? readEnv();
  if (!env.posthogApiKey) return;
  const host = env.posthogHost ?? 'https://app.posthog.com';
  const url = `${host.replace(/\/+$/, '')}/capture/`;
  void fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: env.posthogApiKey,
      event: input.event,
      distinct_id: input.distinctId,
      properties: {
        ...input.properties,
        $lib: SENTRY_CLIENT,
      },
      timestamp: new Date().toISOString(),
    }),
  }).catch((e) => {
    process.stderr.write(`[observability] posthog capture failed: ${String(e)}\n`);
  });
}

/** True when the request exceeded ADR-0004 §2.5's 1s slow-request threshold. */
export function isSlow(durationMs: number): boolean {
  return durationMs >= SLOW_REQUEST_MS;
}

function readEnv(): ObservabilityEnv {
  const out: ObservabilityEnv = {};
  const dsn = process.env['SENTRY_DSN'];
  if (dsn) out.sentryDsn = dsn;
  const ph = process.env['POSTHOG_API_KEY'];
  if (ph) out.posthogApiKey = ph;
  const phHost = process.env['POSTHOG_HOST'];
  if (phHost) out.posthogHost = phHost;
  return out;
}

/**
 * Build a stable per-request anon id without persisting anything. Hashes
 * a deterministic seed (e.g. principalId + day bucket) so PostHog still
 * gets cardinality-friendly distinct_ids without storing user identity.
 * For Phase 1 we use a per-request random when the seed is unknown.
 */
export function anonDistinctId(seed?: string): string {
  if (!seed) return randomUUID();
  // Day bucket the seed so PostHog rolls users daily — avoids long-lived
  // identifiers per ADR-0004 §2.5 ("only anon UUID, never user id").
  const day = new Date().toISOString().slice(0, 10);
  return hashString(`${seed}|${day}`);
}

function hashString(s: string): string {
  // FNV-1a 32-bit; cheap, no crypto needed since we just want a stable
  // bucket id (not security-sensitive).
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Produce a UUID-shaped string so PostHog treats it as opaque.
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `anon-${hex}`;
}
