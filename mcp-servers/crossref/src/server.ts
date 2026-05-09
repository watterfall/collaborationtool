// Real CrossRef MCP server.
//
// Wraps the public CrossRef REST API (https://api.crossref.org/works/{doi})
// as MCP tools that match the mock server's schema:
//
//   lookup_doi(doi)         → CSL-JSON-shaped record or { error: 'not_found' }
//   search_by_title(query)  → array of records (CSL-JSON-shaped) up to `limit`
//
// The CrossRef public API is rate-limited politely (no auth required for
// up to ~50 req/sec). Phase 1 dev: no rate-limit handling. Phase 1.5
// will add backoff + a User-Agent header per CrossRef etiquette guide.
//
// fetchImpl is injectable so tests can run without network.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

export interface CrossrefServerConfig {
  /** Override base URL — useful for testing. */
  baseUrl?: string;
  /** User-Agent (CrossRef recommends "App/version (mailto:contact)"). */
  userAgent?: string;
  /** Per-request timeout in ms. Default 8s. */
  timeoutMs?: number;
  /** Override fetch impl (for tests). */
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE = 'https://api.crossref.org';
const DEFAULT_UA =
  'collaborationtool/0.0 (mailto:dev@collaborationtool.example)';

interface CrossrefMessage {
  status?: string;
  message?: unknown;
}

export function buildCrossrefServer(
  config: CrossrefServerConfig = {},
): Server {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
  const userAgent = config.userAgent ?? DEFAULT_UA;
  const timeoutMs = config.timeoutMs ?? 8_000;
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const server = new Server(
    { name: 'crossref', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'lookup_doi',
        description:
          'Look up a DOI on CrossRef and return its CSL-JSON record. Returns { error: "not_found" } when CrossRef has no record.',
        inputSchema: {
          type: 'object',
          properties: {
            doi: {
              type: 'string',
              description: 'A DOI string, e.g. 10.1145/3531146.3533104',
            },
          },
          required: ['doi'],
        },
      },
      {
        name: 'search_by_title',
        description:
          'Search CrossRef for works whose title matches the query. Returns up to `limit` records (default 5).',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number', default: 5 },
          },
          required: ['query'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === 'lookup_doi') {
      const doi = String((args as { doi?: string })?.doi ?? '').trim();
      if (!doi) {
        return errorContent({ error: 'missing-doi' });
      }
      const url = `${baseUrl}/works/${encodeURIComponent(doi)}`;
      try {
        const json = await fetchJson(fetchImpl, url, userAgent, timeoutMs);
        if (!json) {
          return notFoundContent({ doi });
        }
        const message = (json as CrossrefMessage).message;
        const record = crossrefMessageToCsl(message);
        return {
          content: [{ type: 'text', text: JSON.stringify(record) }],
        };
      } catch (err) {
        if (err instanceof CrossrefNotFound) {
          return notFoundContent({ doi });
        }
        return errorContent({ error: 'crossref-error', detail: String(err) });
      }
    }

    if (name === 'search_by_title') {
      const q = String((args as { query?: string })?.query ?? '').trim();
      const limitRaw = (args as { limit?: number })?.limit;
      const limit = typeof limitRaw === 'number' ? limitRaw : 5;
      if (!q) {
        return {
          content: [{ type: 'text', text: JSON.stringify([]) }],
        };
      }
      const url = `${baseUrl}/works?query.title=${encodeURIComponent(q)}&rows=${limit}`;
      try {
        const json = await fetchJson(fetchImpl, url, userAgent, timeoutMs);
        const message = (json as CrossrefMessage)?.message as
          | { items?: unknown[] }
          | undefined;
        const items = (message?.items ?? []) as unknown[];
        const records = items.map((m) => crossrefMessageToCsl(m));
        return {
          content: [{ type: 'text', text: JSON.stringify(records) }],
        };
      } catch (err) {
        return errorContent({ error: 'crossref-error', detail: String(err) });
      }
    }

    return errorContent({ error: 'unknown_tool', name });
  });

  return server;
}

// ---------- HTTP + JSON helpers ----------

class CrossrefNotFound extends Error {
  override name = 'CrossrefNotFound';
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  userAgent: string,
  timeoutMs: number,
): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': userAgent,
      },
      signal: ac.signal,
    });
    if (res.status === 404) throw new CrossrefNotFound(url);
    if (!res.ok) {
      throw new Error(`CrossRef HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface CrossrefMessageShape {
  DOI?: unknown;
  type?: unknown;
  title?: unknown;
  author?: unknown;
  issued?: unknown;
  'container-title'?: unknown;
  publisher?: unknown;
  language?: unknown;
  URL?: unknown;
}

/**
 * Strip the CrossRef envelope down to the CSL-JSON-equivalent fields the
 * editor cares about. CrossRef's response is already mostly CSL-JSON
 * compatible — we just normalise array-of-strings titles.
 */
function crossrefMessageToCsl(message: unknown): Record<string, unknown> {
  const m = (message ?? {}) as CrossrefMessageShape;
  const titleArr = Array.isArray(m.title) ? (m.title as string[]) : [];
  const containerArr = Array.isArray(m['container-title'])
    ? (m['container-title'] as string[])
    : [];
  const out: Record<string, unknown> = {
    type: m.type ?? 'article',
    title: titleArr[0] ?? '',
    DOI: m.DOI ?? '',
    author: m.author ?? [],
  };
  if (m.issued !== undefined) out['issued'] = m.issued;
  if (containerArr[0]) out['container-title'] = containerArr[0];
  if (m.publisher !== undefined) out['publisher'] = m.publisher;
  if (m.language !== undefined) out['language'] = m.language;
  if (m.URL !== undefined) out['URL'] = m.URL;
  return out;
}

function notFoundContent(body: { doi: string }): {
  content: { type: 'text'; text: string }[];
} {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: 'not_found', ...body }) }],
  };
}

function errorContent(body: Record<string, unknown>): {
  content: { type: 'text'; text: string }[];
  isError: boolean;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(body) }],
    isError: true,
  };
}

// ---------- in-memory pair convenience (used by ai-runtime tests) ----------

export async function startInMemoryCrossrefServer(
  config: CrossrefServerConfig = {},
): Promise<{
  serverTransport: InMemoryTransport;
  clientTransport: InMemoryTransport;
  server: Server;
}> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildCrossrefServer(config);
  await server.connect(serverTransport);
  return { serverTransport, clientTransport, server };
}
