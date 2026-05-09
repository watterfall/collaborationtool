#!/usr/bin/env node
// Stdio entrypoint for the real CrossRef MCP server.
//
// Spawned by the ai-runtime in production via `crossrefStdioTransport`
// (per ADR-0004 §2.1, sixth process in the topology). All JSON-RPC
// traffic flows over stdin/stdout; never write anything else to stdout
// or you will corrupt the framing. Diagnostics go to stderr.
//
// Env vars:
//   CROSSREF_BASE_URL   override base URL (tests / staging proxies)
//   CROSSREF_USER_AGENT override the polite UA string
//   CROSSREF_TIMEOUT_MS per-request timeout (default 8000)

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildCrossrefServer } from './server';

async function main(): Promise<void> {
  const config: Parameters<typeof buildCrossrefServer>[0] = {};
  const baseUrl = process.env['CROSSREF_BASE_URL'];
  if (baseUrl) config.baseUrl = baseUrl;
  const userAgent = process.env['CROSSREF_USER_AGENT'];
  if (userAgent) config.userAgent = userAgent;
  const timeoutRaw = process.env['CROSSREF_TIMEOUT_MS'];
  if (timeoutRaw) {
    const parsed = Number(timeoutRaw);
    if (Number.isFinite(parsed) && parsed > 0) config.timeoutMs = parsed;
  }

  const server = buildCrossrefServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = (signal: NodeJS.Signals) => {
    process.stderr.write(`crossref-mcp: received ${signal}, shutting down\n`);
    server
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  process.stderr.write(
    `crossref-mcp: fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
