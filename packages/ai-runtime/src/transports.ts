// Transport factories — wire a TypeScript MCP `Server` instance to a
// `Client` via the in-memory transport. Used in tests + when the
// runtime is co-located with a mock MCP server (e.g. crossref-mock in
// CI, or Phase 1 dev when external services are unreachable).
//
// Phase 1.5 adds a stdio transport factory (spawn a node child, pipe
// stdin/stdout) for real MCP servers running as separate processes.
// The shape of the returned Transport is identical for both, so the
// rest of ai-runtime never branches on transport type.

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { buildCrossrefMockServer } from '@collaborationtool/mcp-server-crossref-mock';

export interface InMemoryFactoryResult {
  serverInstance: Server;
  buildTransport: () => Promise<Transport>;
}

/**
 * Build an in-memory MCP server-client pair. The returned `buildTransport`
 * is an async factory that connects the server side once when called and
 * returns the client-side transport. Run buildTransport ONCE per server
 * set — it lazily starts the server.
 */
export function inMemoryServerTransport(serverFactory: () => Server): InMemoryFactoryResult {
  const serverInstance = serverFactory();
  let started = false;
  return {
    serverInstance,
    buildTransport: async () => {
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      if (!started) {
        await serverInstance.connect(serverTransport);
        started = true;
      }
      return clientTransport;
    },
  };
}

/** Crossref-mock convenience — used by tests + dev mode without API keys. */
export function crossrefMockTransport(): InMemoryFactoryResult {
  return inMemoryServerTransport(() => buildCrossrefMockServer());
}
