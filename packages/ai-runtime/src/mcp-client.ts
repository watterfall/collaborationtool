// MCP client registry + lifecycle for ai-runtime.
//
// A single agent invocation may need multiple MCP servers (citation
// agent uses crossref / arxiv / semantic-scholar). This module manages
// a per-invocation `McpServerSet`: each server has a typed transport
// (in-memory for tests / mock; stdio child process for production
// servers like real CrossRef / Zotero).

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: object;
  /** Server id from the server set, used in Provenance.toolCalls[].mcpServerId. */
  mcpServerId: string;
}

export interface ToolCallOutcome {
  text: string;
  durationMs: number;
  succeeded: boolean;
  /** True when the server returned `isError: true` or threw. */
  errored: boolean;
}

export interface McpServerHandle {
  /** Stable id used by Provenance + skill `allowed_mcp_servers`. */
  id: string;
  client: Client;
  tools: McpToolDescriptor[];
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallOutcome>;
  close(): Promise<void>;
}

export interface McpServerSet {
  /** All servers indexed by id. */
  servers: Map<string, McpServerHandle>;
  /** Flattened tool list across all servers (handy for the LLM tool definitions). */
  tools: McpToolDescriptor[];
  /** Look up the server for a tool by name. Returns null if unknown. */
  resolve(toolName: string): McpServerHandle | null;
  closeAll(): Promise<void>;
}

export interface McpServerSpec {
  id: string;
  /** Async factory that returns a connected Transport. Caller owns lifecycle. */
  buildTransport: () => Promise<Transport>;
  /** Optional per-server label for human logs. */
  label?: string;
}

/**
 * Wire up a Client per spec, list its tools, build the index.
 * If any server fails to connect we close the ones already up and rethrow.
 */
export async function buildMcpServerSet(
  specs: readonly McpServerSpec[],
): Promise<McpServerSet> {
  const servers = new Map<string, McpServerHandle>();
  const tools: McpToolDescriptor[] = [];
  const toolNameToServer = new Map<string, McpServerHandle>();

  try {
    for (const spec of specs) {
      const handle = await connectOne(spec);
      servers.set(spec.id, handle);
      for (const t of handle.tools) {
        tools.push(t);
        toolNameToServer.set(t.name, handle);
      }
    }
    return {
      servers,
      tools,
      resolve(toolName) {
        return toolNameToServer.get(toolName) ?? null;
      },
      async closeAll() {
        await Promise.allSettled(
          [...servers.values()].map((s) => s.close()),
        );
      },
    };
  } catch (err) {
    await Promise.allSettled([...servers.values()].map((s) => s.close()));
    throw err;
  }
}

async function connectOne(spec: McpServerSpec): Promise<McpServerHandle> {
  const transport = await spec.buildTransport();
  const client = new Client(
    { name: 'collaborationtool-ai-runtime', version: '0.0.0' },
    { capabilities: {} },
  );
  await client.connect(transport);

  const listed = await client.listTools();
  const tools: McpToolDescriptor[] = listed.tools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: (t.inputSchema as object) ?? { type: 'object' },
    mcpServerId: spec.id,
  }));

  return {
    id: spec.id,
    client,
    tools,
    async callTool(name, args) {
      const start = Date.now();
      try {
        const result = await client.callTool({ name, arguments: args });
        const blocks = (result.content ?? []) as Array<{
          type: string;
          text?: string;
        }>;
        const textBlock = blocks.find((b) => b.type === 'text');
        return {
          text: textBlock?.text ?? '',
          durationMs: Date.now() - start,
          succeeded: !result.isError,
          errored: !!result.isError,
        };
      } catch (err) {
        return {
          text: JSON.stringify({ error: (err as Error).message }),
          durationMs: Date.now() - start,
          succeeded: false,
          errored: true,
        };
      }
    },
    async close() {
      try {
        await client.close();
      } catch {
        /* ignore double-close */
      }
    },
  };
}
