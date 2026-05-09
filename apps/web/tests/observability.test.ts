// observability lib smoke test — verifies env-gating, Sentry envelope
// shape, PostHog payload shape, and that PII is not leaked.
//
// All HTTP is intercepted via a mock fetch passed in explicitly; no
// real network egress. Sentry / PostHog protocol assertions follow
// their public docs (sentry envelope ndjson, posthog /capture/ JSON).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  _resetObservabilityCache,
  anonDistinctId,
  captureError,
  captureEvent,
  isSlow,
  type ObservabilityEnv,
} from '../src/lib/observability';

interface MockFetchCall {
  url: string;
  init: RequestInit;
}

function mockFetch(): {
  fetch: typeof fetch;
  calls: MockFetchCall[];
  flush: () => Promise<void>;
} {
  const calls: MockFetchCall[] = [];
  const promises: Promise<unknown>[] = [];
  const fn = ((url: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    const p = Promise.resolve(new Response('', { status: 200 }));
    promises.push(p);
    return p;
  }) as unknown as typeof fetch;
  return {
    fetch: fn,
    calls,
    flush: async () => {
      await Promise.all(promises);
      // give the void-fetch microtask a turn to run
      await new Promise((r) => setImmediate(r));
    },
  };
}

beforeEach(() => {
  _resetObservabilityCache();
});

describe('observability', () => {
  it('captureError: no-op when SENTRY_DSN unset', async () => {
    const m = mockFetch();
    captureError(new Error('boom'), { route: 'test' }, {}, m.fetch);
    await m.flush();
    assert.equal(m.calls.length, 0);
  });

  it('captureError: posts envelope with auth header on valid DSN', async () => {
    const m = mockFetch();
    const env: ObservabilityEnv = {
      sentryDsn: 'https://abc123@o100.ingest.sentry.io/42',
    };
    captureError(new Error('boom'), { route: 'api.test', tags: { kind: 'x' } }, env, m.fetch);
    await m.flush();
    assert.equal(m.calls.length, 1);
    const call = m.calls[0]!;
    assert.equal(call.url, 'https://o100.ingest.sentry.io/api/42/envelope/');
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['content-type'], 'application/x-sentry-envelope');
    assert.match(headers['x-sentry-auth']!, /sentry_key=abc123/);
    const body = String(call.init.body);
    const lines = body.trim().split('\n');
    assert.equal(lines.length, 3, 'envelope has header + item-header + payload');
    const header = JSON.parse(lines[0]!);
    assert.ok(header.event_id);
    const itemHeader = JSON.parse(lines[1]!);
    assert.equal(itemHeader.type, 'event');
    const payload = JSON.parse(lines[2]!);
    assert.equal(payload.exception.values[0].type, 'Error');
    assert.equal(payload.exception.values[0].value, 'boom');
    assert.equal(payload.tags.kind, 'x');
    assert.equal(payload.logger, 'api.test');
  });

  it('captureError: malformed DSN → no-op', async () => {
    const m = mockFetch();
    captureError(
      new Error('boom'),
      { route: 'x' },
      { sentryDsn: 'not-a-url' },
      m.fetch,
    );
    await m.flush();
    assert.equal(m.calls.length, 0);
  });

  it('captureEvent: no-op when POSTHOG_API_KEY unset', async () => {
    const m = mockFetch();
    captureEvent({ event: 'x', distinctId: 'anon-1' }, {}, m.fetch);
    await m.flush();
    assert.equal(m.calls.length, 0);
  });

  it('captureEvent: posts to posthog /capture with api key + event', async () => {
    const m = mockFetch();
    captureEvent(
      {
        event: 'agent.invoke.ok',
        distinctId: 'anon-deadbeef',
        properties: { kind: 'citation', durationMs: 42 },
      },
      { posthogApiKey: 'phc_test', posthogHost: 'https://eu.posthog.example' },
      m.fetch,
    );
    await m.flush();
    assert.equal(m.calls.length, 1);
    const call = m.calls[0]!;
    assert.equal(call.url, 'https://eu.posthog.example/capture/');
    const body = JSON.parse(String(call.init.body));
    assert.equal(body.api_key, 'phc_test');
    assert.equal(body.event, 'agent.invoke.ok');
    assert.equal(body.distinct_id, 'anon-deadbeef');
    assert.equal(body.properties.kind, 'citation');
    assert.equal(body.properties.durationMs, 42);
  });

  it('captureEvent: defaults to app.posthog.com when POSTHOG_HOST unset', async () => {
    const m = mockFetch();
    captureEvent({ event: 'x', distinctId: 'a' }, { posthogApiKey: 'k' }, m.fetch);
    await m.flush();
    assert.equal(m.calls[0]!.url, 'https://app.posthog.com/capture/');
  });

  it('isSlow: 1s threshold per ADR-0004 §2.5', () => {
    assert.equal(isSlow(999), false);
    assert.equal(isSlow(1000), true);
    assert.equal(isSlow(50_000), true);
  });

  it('anonDistinctId: stable per seed/day, random when seedless', () => {
    const a = anonDistinctId('principal-1');
    const b = anonDistinctId('principal-1');
    assert.equal(a, b, 'same seed → same id within a day');
    const c = anonDistinctId('principal-2');
    assert.notEqual(a, c, 'different seed → different id');
    const r1 = anonDistinctId();
    const r2 = anonDistinctId();
    assert.notEqual(r1, r2, 'no seed → random');
    assert.match(a, /^anon-[a-f0-9]{8}$/);
  });
});
