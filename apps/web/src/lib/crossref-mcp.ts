// Build the citation agent's crossref MCP spec from env, or return null
// to fall back to the in-memory mock (CI / offline dev).
//
// Env contract (Phase 1.5):
//   CROSSREF_MCP_COMMAND  shell executable, e.g. `node`, `tsx`, or an absolute path
//   CROSSREF_MCP_ARGS     JSON array of args, e.g. `["mcp-servers/crossref/src/bin.ts"]`
//   CROSSREF_MCP_CWD      optional working dir for the spawn
//
// Anything inherited by the child (CROSSREF_BASE_URL / USER_AGENT / TIMEOUT_MS)
// is read by `mcp-servers/crossref/src/bin.ts`.

import {
  stdioServerTransport,
  type McpServerSpec,
} from '@collaborationtool/ai-runtime';

export function crossrefMcpFromEnv(): McpServerSpec | null {
  const command = process.env['CROSSREF_MCP_COMMAND'];
  if (!command) return null;

  const argsRaw = process.env['CROSSREF_MCP_ARGS'];
  let args: string[] = [];
  if (argsRaw) {
    try {
      const parsed: unknown = JSON.parse(argsRaw);
      if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
        throw new Error('CROSSREF_MCP_ARGS must be a JSON array of strings');
      }
      args = parsed;
    } catch (err) {
      throw new Error(
        `Invalid CROSSREF_MCP_ARGS: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const cwd = process.env['CROSSREF_MCP_CWD'];
  const factory = stdioServerTransport({
    command,
    args,
    ...(cwd ? { cwd } : {}),
  });
  return {
    id: 'crossref',
    label: 'CrossRef (real, stdio)',
    buildTransport: factory.buildTransport,
  };
}
