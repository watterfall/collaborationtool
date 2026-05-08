// Unit tests for the y-sweet snapshot source. Mocked fetch — no
// network — so this runs without a live y-sweet (the live integration
// is verified manually per README).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createYSweetFetcher } from '../src/sources/y-sweet';

interface MockCall {
  input: RequestInfo | URL;
  init?: RequestInit;
}

function makeMockFetch(handler: (call: MockCall) => Response | Promise<Response>): {
  fetch: typeof fetch;
  calls: MockCall[];
} {
  const calls: MockCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: MockCall = { input };
    if (init !== undefined) call.init = init;
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

describe('createYSweetFetcher', () => {
  it('GETs /api/docs/<docId>/as-update and returns Uint8Array', async () => {
    const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
    const { fetch, calls } = makeMockFetch(() =>
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    const fetcher = createYSweetFetcher({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv-token',
      fetchImpl: fetch,
    });

    const result = await fetcher('doc-1');
    assert.deepEqual(Array.from(result!), [0xab, 0xcd, 0xef]);
    assert.equal(calls.length, 1);
    assert.equal(
      String(calls[0]!.input),
      'http://ysweet:8080/api/docs/doc-1/as-update',
    );
    const headers = calls[0]!.init?.headers as Record<string, string>;
    assert.equal(headers['authorization'], 'Bearer srv-token');
  });

  it('returns null on 404', async () => {
    const { fetch } = makeMockFetch(() => new Response('', { status: 404 }));
    const fetcher = createYSweetFetcher({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    assert.equal(await fetcher('missing'), null);
  });

  it('returns null on empty body even with 200', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response(new ArrayBuffer(0), { status: 200 }),
    );
    const fetcher = createYSweetFetcher({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    assert.equal(await fetcher('empty'), null);
  });

  it('throws on 5xx with body in message', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response('upstream-down', { status: 502 }),
    );
    const fetcher = createYSweetFetcher({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    await assert.rejects(() => fetcher('doc'), /upstream-down/);
  });

  it('aborts on timeout', async () => {
    // Fetch that never resolves on its own; rely on AbortController.
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })) as unknown as typeof fetch;

    const fetcher = createYSweetFetcher({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl,
      timeoutMs: 100,
    });

    await assert.rejects(() => fetcher('slow-doc'), /aborted/);
  });

  it('encodes special characters in docId', async () => {
    const { fetch, calls } = makeMockFetch(() =>
      new Response(new Uint8Array([1]), { status: 200 }),
    );
    const fetcher = createYSweetFetcher({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    await fetcher('doc/with spaces');
    assert.equal(
      String(calls[0]!.input),
      'http://ysweet:8080/api/docs/doc%2Fwith%20spaces/as-update',
    );
  });
});
