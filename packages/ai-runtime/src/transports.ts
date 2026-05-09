// Transport factories — wire a TypeScript MCP `Server` instance to a
// `Client` via the in-memory transport. Used in tests + when the
// runtime is co-located with a mock MCP server (e.g. crossref-mock in
// CI, or Phase 1 dev when external services are unreachable).
//
// Phase 1.5 adds a stdio transport factory (spawn a node child, pipe
// stdin/stdout) for real MCP servers running as separate processes
// (per ADR-0004 §2.1's 6-process topology). The returned shape matches
// `McpServerSpec.buildTransport`, so the rest of ai-runtime never
// branches on transport type.

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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

export interface StdioFactoryParams {
  /** The executable to run (e.g. `node`, `tsx`, an absolute path to a binary). */
  command: string;
  /** Arguments after the executable (e.g. the bin script path). */
  args?: string[];
  /** Extra env vars merged into the child's environment. */
  env?: Record<string, string>;
  /** Working directory for the child. Defaults to inherit. */
  cwd?: string;
}

export interface StdioFactoryResult {
  buildTransport: () => Promise<Transport>;
}

/**
 * Spawn a child process and return a buildTransport factory that wraps
 * `StdioClientTransport`. The factory calls `start()` itself so the
 * shared `Client.connect` flow stays uniform with the in-memory path.
 *
 * The transport owns the child's lifecycle: closing the client (which
 * `McpServerSet.closeAll` does) sends SIGTERM to the child.
 */
export function stdioServerTransport(params: StdioFactoryParams): StdioFactoryResult {
  return {
    buildTransport: async () => {
      const transport = new StdioClientTransport({
        command: params.command,
        ...(params.args ? { args: params.args } : {}),
        ...(params.env ? { env: params.env } : {}),
        ...(params.cwd ? { cwd: params.cwd } : {}),
      });
      return transport;
    },
  };
}
