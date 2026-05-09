// stdio bin smoke test — spawns the real bin via tsx, verifies the
// MCP handshake + listTools, and exercises lookup_doi against a tiny
// in-process HTTP stub via CROSSREF_BASE_URL. No network egress.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const binPath = path.resolve(pkgRoot, 'src', 'bin.ts');
const tsxBin = path.resolve(pkgRoot, 'node_modules', '.bin', 'tsx');

interface StubRoute {
  match: (url: string) => boolean;
  reply: (res: ServerResponse) => void;
}

async function startStubServer(routes: StubRoute[]): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
  calls: string[];
}> {
  const calls: string[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    calls.push(req.url ?? '');
    const route = routes.find((r) => r.match(req.url ?? ''));
    if (!route) {
      res.statusCode = 404;
      res.end();
      return;
    }
    route.reply(res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('bad addr');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    calls,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function startBin(env: Record<string, string>): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const transport = new StdioClientTransport({
    command: tsxBin,
    args: [binPath],
    env: {
      PATH: process.env['PATH'] ?? '',
      ...env,
    },
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'stdio-bin-test', version: '0.0.0' },
    { capabilities: {} },
  );
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close().catch(() => {});
    },
  };
}

describe('crossref stdio bin', () => {
  it('lists the two tools on connect', async () => {
    const stub = await startStubServer([]);
    try {
      const { client, close } = await startBin({
        CROSSREF_BASE_URL: stub.baseUrl,
      });
      try {
        const listed = await client.listTools();
        const names = listed.tools.map((t) => t.name).sort();
        assert.deepEqual(names, ['lookup_doi', 'search_by_title']);
      } finally {
        await close();
      }
    } finally {
      await stub.close();
    }
  });

  it('lookup_doi: forwards to base url and returns CSL-JSON record', async () => {
    const stub = await startStubServer([
      {
        match: (u) => u.startsWith('/works/'),
        reply: (res) => {
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              message: {
                DOI: '10.1145/3531146.3533104',
                type: 'paper-conference',
                title: ['On the Opportunities and Risks of Foundation Models'],
                author: [{ family: 'Bommasani', given: 'Rishi' }],
                'container-title': ['FAccT'],
                publisher: 'ACM',
                language: 'en',
              },
            }),
          );
        },
      },
    ]);
    try {
      const { client, close } = await startBin({
        CROSSREF_BASE_URL: stub.baseUrl,
        CROSSREF_USER_AGENT: 'stdio-bin-test/0.0',
      });
      try {
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
        assert.equal(parsed['publisher'], 'ACM');
        assert.equal(stub.calls.length, 1);
        assert.match(stub.calls[0]!, /\/works\/10\.1145%2F3531146\.3533104$/);
      } finally {
        await close();
      }
    } finally {
      await stub.close();
    }
  });

  it('lookup_doi: empty doi short-circuits without HTTP call', async () => {
    const stub = await startStubServer([
      {
        match: () => true,
        reply: (res) => {
          res.statusCode = 500;
          res.end('should-not-be-called');
        },
      },
    ]);
    try {
      const { client, close } = await startBin({
        CROSSREF_BASE_URL: stub.baseUrl,
      });
      try {
        const result = await client.callTool({
          name: 'lookup_doi',
          arguments: { doi: '' },
        });
        assert.equal(result.isError, true);
        assert.equal(stub.calls.length, 0);
      } finally {
        await close();
      }
    } finally {
      await stub.close();
    }
  });
});
