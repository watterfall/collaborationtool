// Unit tests for the y-sweet HTTP client. Uses a mock fetch — no
// network — so we can run these in CI without a live y-sweet.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { YSweetClient, YSweetError } from '../src/y-sweet/client';

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

describe('YSweetClient.issueClientToken', () => {
  it('POSTs to /api/auth/<docId> with bearer + parses response', async () => {
    const { fetch, calls } = makeMockFetch(() =>
      new Response(
        JSON.stringify({
          url: 'ws://ysweet:8080/d/doc-1?token=abc',
          token: 'abc',
          docId: 'doc-1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv-token',
      fetchImpl: fetch,
    });

    const out = await client.issueClientToken('doc-1');
    assert.equal(out.url, 'ws://ysweet:8080/d/doc-1?token=abc');
    assert.equal(out.token, 'abc');
    assert.equal(out.docId, 'doc-1');

    assert.equal(calls.length, 1);
    const c = calls[0]!;
    assert.equal(String(c.input), 'http://ysweet:8080/api/auth/doc-1');
    assert.equal(c.init?.method, 'POST');
    const headers = c.init?.headers as Record<string, string>;
    assert.equal(headers['authorization'], 'Bearer srv-token');
  });

  it('URL-encodes the docId', async () => {
    const { fetch, calls } = makeMockFetch(() =>
      new Response(
        JSON.stringify({ url: 'ws://x', token: 't', docId: 'a/b c' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    await client.issueClientToken('a/b c');
    assert.equal(String(calls[0]!.input), 'http://ysweet:8080/api/auth/a%2Fb%20c');
  });

  it('handles trailing slash in baseUrl', async () => {
    const { fetch, calls } = makeMockFetch(() =>
      new Response(
        JSON.stringify({ url: 'ws://x', token: 't' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080/',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    await client.issueClientToken('doc-1');
    assert.equal(String(calls[0]!.input), 'http://ysweet:8080/api/auth/doc-1');
  });

  it('throws YSweetError on 4xx', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response('forbidden', { status: 403 }),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    await assert.rejects(
      () => client.issueClientToken('doc-x'),
      (err: unknown) => {
        assert.ok(err instanceof YSweetError);
        assert.equal(err.status, 403);
        assert.equal(err.body, 'forbidden');
        return true;
      },
    );
  });

  it('throws YSweetError on malformed JSON shape', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response(JSON.stringify({ wrong: 'shape' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    await assert.rejects(
      () => client.issueClientToken('doc'),
      /malformed/,
    );
  });

  it('parses optional expiresAt as Date', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response(
        JSON.stringify({
          url: 'ws://x',
          token: 't',
          expiresAt: 1_700_000_000_000,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    const out = await client.issueClientToken('doc');
    assert.ok(out.expiresAt instanceof Date);
    assert.equal(out.expiresAt!.getTime(), 1_700_000_000_000);
  });
});

describe('YSweetClient.getDocumentAsUpdate', () => {
  it('returns Uint8Array of body bytes on 200', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const { fetch, calls } = makeMockFetch(() =>
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    const out = await client.getDocumentAsUpdate('doc-1');
    assert.ok(out instanceof Uint8Array);
    assert.deepEqual(Array.from(out!), [1, 2, 3, 4, 5]);
    assert.equal(
      String(calls[0]!.input),
      'http://ysweet:8080/api/docs/doc-1/as-update',
    );
  });

  it('returns null on 404', async () => {
    const { fetch } = makeMockFetch(() => new Response('', { status: 404 }));
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    assert.equal(await client.getDocumentAsUpdate('nope'), null);
  });

  it('throws on 5xx', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response('boom', { status: 503 }),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    await assert.rejects(
      () => client.getDocumentAsUpdate('doc'),
      (err: unknown) => err instanceof YSweetError && err.status === 503,
    );
  });
});

describe('YSweetClient.ping', () => {
  it('returns true on 2xx', async () => {
    const { fetch } = makeMockFetch(() => new Response('ok', { status: 200 }));
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    assert.equal(await client.ping(), true);
  });

  it('returns false on network error', async () => {
    const fetchImpl = (async () => {
      throw new Error('econnrefused');
    }) as unknown as typeof fetch;
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl,
    });
    assert.equal(await client.ping(), false);
  });

  it('returns false on non-2xx', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response('', { status: 500 }),
    );
    const client = new YSweetClient({
      baseUrl: 'http://ysweet:8080',
      serverAuthToken: 'srv',
      fetchImpl: fetch,
    });
    assert.equal(await client.ping(), false);
  });
});
