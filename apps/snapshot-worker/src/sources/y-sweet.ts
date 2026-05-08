// y-sweet HTTP fetcher source. Returns the document's current Yjs
// binary state, or null when the doc doesn't exist yet (404).

export interface YSweetSourceConfig {
  /** y-sweet base URL — e.g. http://ysweet:8080 */
  baseUrl: string;
  /** Bearer token (matches y-sweet's Y_SWEET_AUTH). */
  serverAuthToken: string;
  /** Per-request timeout (default 10s). */
  timeoutMs?: number;
  /** Optional fetch impl for tests. */
  fetchImpl?: typeof fetch;
}

export type YSweetFetcher = (documentId: string) => Promise<Uint8Array | null>;

export function createYSweetFetcher(config: YSweetSourceConfig): YSweetFetcher {
  const baseUrl = config.baseUrl.endsWith('/')
    ? config.baseUrl.slice(0, -1)
    : config.baseUrl;
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = config.timeoutMs ?? 10_000;

  return async function fetch(documentId: string): Promise<Uint8Array | null> {
    const url = `${baseUrl}/api/docs/${encodeURIComponent(documentId)}/as-update`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${config.serverAuthToken}`,
          accept: 'application/octet-stream',
        },
        signal: ac.signal,
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        const body = await safeReadText(res);
        throw new Error(
          `y-sweet getDocumentAsUpdate failed (${res.status}): ${body}`,
        );
      }
      const buf = await res.arrayBuffer();
      // Empty body → treat as no-source so `last_snapshot_at` doesn't
      // bump on a doc that y-sweet has but holds no state.
      if (buf.byteLength === 0) return null;
      return new Uint8Array(buf);
    } finally {
      clearTimeout(timer);
    }
  };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unreadable response body>';
  }
}
