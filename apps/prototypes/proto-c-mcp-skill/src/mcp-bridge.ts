// Bridge between proto-c's runner and the MCP server.
// Uses the in-memory transport so we don't need a stdio child process.
// The protocol surface is identical to a stdio MCP server.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { startInMemoryServer } from '@collaborationtool/mcp-server-crossref-mock';

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: object;
  // Identifier of the originating MCP server; populated by the bridge.
  mcpServerId: string;
}

export interface McpClientHandle {
  client: Client;
  tools: McpToolDescriptor[];
  callTool(name: string, args: Record<string, unknown>): Promise<{
    text: string;
    durationMs: number;
    succeeded: boolean;
  }>;
  shutdown(): Promise<void>;
}

const MCP_SERVER_ID = 'crossref-mock';

export async function startCrossrefMockBridge(): Promise<McpClientHandle> {
  const { clientTransport } = await startInMemoryServer();

  const client = new Client(
    { name: 'proto-c-runner', version: '0.0.0' },
    { capabilities: {} }
  );
  await client.connect(clientTransport);

  const listed = await client.listTools();
  const tools: McpToolDescriptor[] = listed.tools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: (t.inputSchema as object) ?? { type: 'object' },
    mcpServerId: MCP_SERVER_ID,
  }));

  return {
    client,
    tools,
    async callTool(name, args) {
      const start = Date.now();
      try {
        const result = await client.callTool({ name, arguments: args });
        const blocks = (result.content ?? []) as Array<{ type: string; text?: string }>;
        const textBlock = blocks.find((b) => b.type === 'text');
        return {
          text: textBlock?.text ?? '',
          durationMs: Date.now() - start,
          succeeded: !result.isError,
        };
      } catch (err) {
        return {
          text: JSON.stringify({ error: (err as Error).message }),
          durationMs: Date.now() - start,
          succeeded: false,
        };
      }
    },
    async shutdown() {
      await client.close();
    },
  };
}
