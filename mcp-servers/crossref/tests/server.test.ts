// Real CrossRef MCP server — tested with a mock fetch impl, no network.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildCrossrefServer } from '../src/server';

interface MockCall {
  url: string;
  init?: RequestInit;
}

function makeMockFetch(handler: (call: MockCall) => Response | Promise<Response>): {
  fetch: typeof fetch;
  calls: MockCall[];
} {
  const calls: MockCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: MockCall = { url: String(input) };
    if (init !== undefined) call.init = init;
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

async function startClient(serverConfig: Parameters<typeof buildCrossrefServer>[0]) {
  const server = buildCrossrefServer(serverConfig);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client(
    { name: 'test', version: '0.0.0' },
    { capabilities: {} },
  );
  await client.connect(clientTransport);
  return { client, server };
}

describe('crossref real MCP server', () => {
  it('lookup_doi: returns CSL-JSON record on 200', async () => {
    const { fetch, calls } = makeMockFetch(() =>
      new Response(
        JSON.stringify({
          status: 'ok',
          message: {
            DOI: '10.1145/3531146.3533104',
            type: 'paper-conference',
            title: ['On the Opportunities and Risks of Foundation Models'],
            author: [{ family: 'Bommasani', given: 'Rishi' }],
            'container-title': ['FAccT'],
            publisher: 'ACM',
            issued: { 'date-parts': [[2022]] },
            language: 'en',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const { client } = await startClient({ fetchImpl: fetch });
    const result = await client.callTool({
      name: 'lookup_doi',
      arguments: { doi: '10.1145/3531146.3533104' },
    });
    const text = (
      result.content as Array<{ type: string; text?: string }>
    )[0]!.text!;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    assert.equal(parsed['DOI'], '10.1145/3531146.3533104');
    assert.equal(parsed['type'], 'paper-conference');
    assert.equal(parsed['title'], 'On the Opportunities and Risks of Foundation Models');
    assert.equal(parsed['publisher'], 'ACM');

    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/works\/10\.1145%2F3531146\.3533104$/);
    assert.equal(
      ((calls[0]!.init?.headers ?? {}) as Record<string, string>)['user-agent']?.includes(
        'collaborationtool',
      ),
      true,
    );
    await client.close();
  });

  it('lookup_doi: 404 → { error: not_found }', async () => {
    const { fetch } = makeMockFetch(() => new Response('', { status: 404 }));
    const { client } = await startClient({ fetchImpl: fetch });
    const result = await client.callTool({
      name: 'lookup_doi',
      arguments: { doi: '10.9999/missing' },
    });
    const text = (result.content as Array<{ text?: string }>)[0]!.text!;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    assert.equal(parsed['error'], 'not_found');
    assert.equal(parsed['doi'], '10.9999/missing');
    await client.close();
  });

  it('lookup_doi: 5xx → { error: crossref-error } with isError=true', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response('upstream-down', { status: 503 }),
    );
    const { client } = await startClient({ fetchImpl: fetch });
    const result = await client.callTool({
      name: 'lookup_doi',
      arguments: { doi: '10.0/x' },
    });
    assert.equal(result.isError, true);
    const parsed = JSON.parse(
      (result.content as Array<{ text?: string }>)[0]!.text!,
    ) as Record<string, unknown>;
    assert.equal(parsed['error'], 'crossref-error');
    await client.close();
  });

  it('lookup_doi: rejects empty doi', async () => {
    const { fetch, calls } = makeMockFetch(() =>
      new Response('{}', { status: 200 }),
    );
    const { client } = await startClient({ fetchImpl: fetch });
    const result = await client.callTool({
      name: 'lookup_doi',
      arguments: { doi: '' },
    });
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
    await client.close();
  });

  it('search_by_title: returns array of records', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response(
        JSON.stringify({
          status: 'ok',
          message: {
            items: [
              {
                DOI: '10.1/a',
                type: 'article-journal',
                title: ['Alpha'],
                author: [{ family: 'A', given: 'A' }],
              },
              {
                DOI: '10.1/b',
                type: 'article-journal',
                title: ['Beta'],
                author: [{ family: 'B', given: 'B' }],
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const { client } = await startClient({ fetchImpl: fetch });
    const result = await client.callTool({
      name: 'search_by_title',
      arguments: { query: 'foundation', limit: 2 },
    });
    const parsed = JSON.parse(
      (result.content as Array<{ text?: string }>)[0]!.text!,
    ) as Array<Record<string, unknown>>;
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]!['title'], 'Alpha');
    assert.equal(parsed[1]!['title'], 'Beta');
    await client.close();
  });

  it('search_by_title: empty query → empty array, no fetch', async () => {
    const { fetch, calls } = makeMockFetch(() =>
      new Response('{}', { status: 200 }),
    );
    const { client } = await startClient({ fetchImpl: fetch });
    const result = await client.callTool({
      name: 'search_by_title',
      arguments: { query: '' },
    });
    const parsed = JSON.parse(
      (result.content as Array<{ text?: string }>)[0]!.text!,
    );
    assert.deepEqual(parsed, []);
    assert.equal(calls.length, 0);
    await client.close();
  });

  it('unknown_tool returns isError', async () => {
    const { fetch } = makeMockFetch(() =>
      new Response('{}', { status: 200 }),
    );
    const { client } = await startClient({ fetchImpl: fetch });
    const result = await client.callTool({
      name: 'wat',
      arguments: {},
    });
    assert.equal(result.isError, true);
    const parsed = JSON.parse(
      (result.content as Array<{ text?: string }>)[0]!.text!,
    ) as Record<string, unknown>;
    assert.equal(parsed['error'], 'unknown_tool');
    await client.close();
  });
});
