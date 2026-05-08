// Server-side y-sweet HTTP client.
//
// y-sweet exposes:
//   POST /api/auth/<docId>           → server token to client token exchange
//   GET  /api/docs/<docId>/as-update → current Yjs binary (server-only)
//   GET  /check_store                → liveness
//
// Phase 1 D11 covers what apps/sync-gateway and apps/snapshot-worker
// need:
//   - issueClientToken(docId)  — for clients connecting through the
//                                gateway (gateway acts as token broker)
//   - getDocumentAsUpdate(id)  — Yjs binary to write to PG snapshot
//   - ping()                   — readiness probe
//
// We deliberately avoid wrapping every y-sweet endpoint — Phase 1.5 will
// surface usage / metrics endpoints as needs emerge.

export interface YSweetClientConfig {
  /** e.g. http://ysweet:8080 (in docker) or http://127.0.0.1:8080 (dev) */
  baseUrl: string;
  /** Bearer token configured on y-sweet via Y_SWEET_AUTH. */
  serverAuthToken: string;
  /** Optional fetch impl for tests. */
  fetchImpl?: typeof fetch;
}

export interface ClientToken {
  /** Public WebSocket URL the client should connect to. */
  url: string;
  /** y-sweet client token (different from our SyncToken JWT). */
  token: string;
  /** y-sweet's `docId`. Echoed for client convenience. */
  docId: string;
  /** When the y-sweet token expires. */
  expiresAt?: Date;
}

export class YSweetError extends Error {
  override name = 'YSweetError';
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: string,
  ) {
    super(message);
  }
}

export class YSweetClient {
  private readonly baseUrl: string;
  private readonly serverAuthToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: YSweetClientConfig) {
    this.baseUrl = stripTrailingSlash(config.baseUrl);
    this.serverAuthToken = config.serverAuthToken;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Exchange the server token for a short-lived client token.
   *
   * y-sweet POST /api/auth/<docId> creates the doc on first call (and
   * thereafter is idempotent), then returns `{ url, doc, token }`.
   */
  async issueClientToken(docId: string): Promise<ClientToken> {
    const url = `${this.baseUrl}/api/auth/${encodeURIComponent(docId)}`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      const body = await safeReadText(res);
      throw new YSweetError(res.status, `issueClientToken failed`, body);
    }
    const json = (await res.json()) as {
      url?: unknown;
      token?: unknown;
      doc?: unknown;
      docId?: unknown;
      expiresAt?: unknown;
    };

    if (typeof json.url !== 'string' || typeof json.token !== 'string') {
      throw new YSweetError(
        res.status,
        'issueClientToken: malformed response',
        JSON.stringify(json),
      );
    }
    const docIdEcho =
      typeof json.docId === 'string'
        ? json.docId
        : typeof json.doc === 'string'
          ? json.doc
          : docId;

    const out: ClientToken = {
      url: json.url,
      token: json.token,
      docId: docIdEcho,
    };
    if (typeof json.expiresAt === 'number') {
      out.expiresAt = new Date(json.expiresAt);
    } else if (typeof json.expiresAt === 'string') {
      const d = new Date(json.expiresAt);
      if (!Number.isNaN(d.getTime())) out.expiresAt = d;
    }
    return out;
  }

  /**
   * Fetch the document's current Yjs binary state. This is the
   * canonical source for the snapshot worker's PG bytea write path.
   *
   * Returns null when the doc doesn't exist yet (404). All other
   * non-2xx responses throw.
   */
  async getDocumentAsUpdate(docId: string): Promise<Uint8Array | null> {
    const url = `${this.baseUrl}/api/docs/${encodeURIComponent(docId)}/as-update`;
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: this.authHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await safeReadText(res);
      throw new YSweetError(res.status, `getDocumentAsUpdate failed`, body);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }

  /** Liveness probe. Returns true when y-sweet's /check_store returns 2xx. */
  async ping(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/check_store`, {
        method: 'GET',
        headers: this.authHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private authHeaders(): HeadersInit {
    return {
      authorization: `Bearer ${this.serverAuthToken}`,
      accept: 'application/json',
    };
  }
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unreadable response body>';
  }
}
