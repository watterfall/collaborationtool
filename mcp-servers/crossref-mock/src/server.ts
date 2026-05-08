// Mock CrossRef MCP server.
// Returns deterministic CSL-JSON metadata for a fixed set of DOIs.
// Phase 0 D5 demo dependency — Phase 1 replaces with real CrossRef API.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

export interface CslJsonRecord {
  type: string;
  title: string;
  author: { family: string; given: string }[];
  issued?: { 'date-parts': number[][] };
  DOI: string;
  'container-title'?: string;
  publisher?: string;
  language?: string;
  URL?: string;
}

const FIXTURES: Record<string, CslJsonRecord> = {
  '10.1145/3531146.3533104': {
    type: 'paper-conference',
    title: 'On the Opportunities and Risks of Foundation Models',
    author: [
      { family: 'Bommasani', given: 'Rishi' },
      { family: 'Hudson', given: 'Drew A.' },
    ],
    issued: { 'date-parts': [[2022]] },
    DOI: '10.1145/3531146.3533104',
    'container-title': 'FAccT 22',
    publisher: 'ACM',
    language: 'en',
  },
  '10.48550/arXiv.2310.06770': {
    type: 'article-journal',
    title: 'Yjs: A Framework for Collaborative Software',
    author: [{ family: 'Nicolaescu', given: 'Petru' }],
    issued: { 'date-parts': [[2023]] },
    DOI: '10.48550/arXiv.2310.06770',
    'container-title': 'arXiv preprint',
    language: 'en',
  },
  '10.1126/science.abe6396': {
    type: 'article-journal',
    title: 'Open peer review and the credibility of scientific publishing',
    author: [{ family: 'Ross-Hellauer', given: 'Tony' }],
    issued: { 'date-parts': [[2024]] },
    DOI: '10.1126/science.abe6396',
    'container-title': 'Science',
    publisher: 'AAAS',
    language: 'en',
  },
  '10.7717/peerj-cs.2024-zh': {
    type: 'article-journal',
    title: '面向中文学术出版的协作工具研究 / Research on collaborative tools for Chinese-language academic publishing',
    author: [
      { family: '王', given: '明' },
      { family: 'Zhang', given: 'Wei' },
    ],
    issued: { 'date-parts': [[2024]] },
    DOI: '10.7717/peerj-cs.2024-zh',
    'container-title': 'PeerJ Computer Science',
    language: 'zh',
  },
  '10.5281/zenodo.10000001': {
    type: 'dataset',
    title: 'IPUMS Cohort 2024: Open dataset for collaboration patterns',
    author: [{ family: 'Anonymous', given: 'IPUMS Team' }],
    issued: { 'date-parts': [[2024]] },
    DOI: '10.5281/zenodo.10000001',
    'container-title': 'Zenodo',
    publisher: 'CERN Zenodo',
    language: 'en',
  },
};

export interface CrossrefMockConfig {
  // future: rate limit, latency simulation, error injection
}

export function buildCrossrefMockServer(_config: CrossrefMockConfig = {}): Server {
  const server = new Server(
    {
      name: 'crossref-mock',
      version: '0.0.0',
    },
    {
      capabilities: { tools: {} },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'lookup_doi',
        description:
          'Look up a DOI and return its CSL-JSON metadata if known. Returns null when DOI is unknown to this mock server.',
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
          'Search records by partial title (case-insensitive substring match against the mock fixtures).',
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
      const record = FIXTURES[doi];
      if (record) {
        return {
          content: [{ type: 'text', text: JSON.stringify(record) }],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'not_found', doi }),
          },
        ],
        isError: false,
      };
    }

    if (name === 'search_by_title') {
      const q = String((args as { query?: string })?.query ?? '').toLowerCase();
      const limitRaw = (args as { limit?: number })?.limit;
      const limit = typeof limitRaw === 'number' ? limitRaw : 5;
      const matches = Object.values(FIXTURES)
        .filter((r) => r.title.toLowerCase().includes(q))
        .slice(0, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(matches) }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'unknown_tool', name }) }],
      isError: true,
    };
  });

  return server;
}

// Convenience: spin up server + client both connected to an in-memory transport.
// Used by the proto-c demo without needing a stdio child process.
export async function startInMemoryServer(): Promise<{
  serverTransport: InMemoryTransport;
  clientTransport: InMemoryTransport;
  server: Server;
}> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildCrossrefMockServer();
  await server.connect(serverTransport);
  return { serverTransport, clientTransport, server };
}
