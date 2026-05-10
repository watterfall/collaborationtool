// Phase 4 W4 doi-resolver tests.
//
// Pure unit: stubs fetch and asserts the resolver maps HTTP status to
// the {ok, reason} contract used by maintenance-scan broken-citation.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { httpDoiResolver } from '../src/doi-resolver';

function makeFetchStub(
  responseFor: (url: string) => Response | Promise<Response>,
): typeof fetch {
  return ((url: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(responseFor(String(url)))) as unknown as typeof fetch;
}

describe('httpDoiResolver', () => {
  it('returns ok=true for 302 (resolvable DOI)', async () => {
    const resolver = httpDoiResolver({
      fetch: makeFetchStub(
        () =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://publisher.example/paper/123' },
          }),
      ),
    });
    const verdict = await resolver.resolve('10.1234/ok');
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, undefined);
  });

  it('returns ok=true for 200', async () => {
    const resolver = httpDoiResolver({
      fetch: makeFetchStub(() => new Response(null, { status: 200 })),
    });
    assert.equal((await resolver.resolve('10.1234/x')).ok, true);
  });

  it('returns ok=false reason=http-404 for not-found DOI', async () => {
    const resolver = httpDoiResolver({
      fetch: makeFetchStub(() => new Response(null, { status: 404 })),
    });
    const v = await resolver.resolve('10.1234/dead');
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'http-404');
  });

  it('returns ok=false reason=http-410 for retracted DOI', async () => {
    const resolver = httpDoiResolver({
      fetch: makeFetchStub(() => new Response(null, { status: 410 })),
    });
    assert.equal((await resolver.resolve('10.1234/gone')).reason, 'http-410');
  });

  it('returns ok=false with timeout reason when fetch aborts', async () => {
    const resolver = httpDoiResolver({
      timeoutMs: 5,
      fetch: ((_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted') as Error & { name: string };
            err.name = 'AbortError';
            reject(err);
          });
        })) as unknown as typeof fetch,
    });
    const v = await resolver.resolve('10.1234/slow');
    assert.equal(v.ok, false);
    assert.match(String(v.reason), /^timeout-/);
  });

  it('passes user-agent header to fetch', async () => {
    let capturedUa: string | undefined;
    const resolver = httpDoiResolver({
      userAgent: 'test-agent/1.0',
      fetch: ((_url: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        capturedUa = headers.get('user-agent') ?? undefined;
        return Promise.resolve(new Response(null, { status: 302 }));
      }) as unknown as typeof fetch,
    });
    await resolver.resolve('10.1/y');
    assert.equal(capturedUa, 'test-agent/1.0');
  });

  it('respects baseUrl override', async () => {
    let capturedUrl = '';
    const resolver = httpDoiResolver({
      baseUrl: 'https://stage.doi.org/',
      fetch: ((url: RequestInfo | URL) => {
        capturedUrl = String(url);
        return Promise.resolve(new Response(null, { status: 302 }));
      }) as unknown as typeof fetch,
    });
    await resolver.resolve('10.1/y');
    assert.equal(capturedUrl, 'https://stage.doi.org/10.1/y');
  });
});
