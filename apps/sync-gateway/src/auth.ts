// Handshake: parse the WebSocket upgrade request, verify JWT, load ACL,
// classify connection mode. Returns the auth context the room can use.

import type { IncomingMessage } from 'node:http';
import { URL } from 'node:url';

import {
  type Database,
} from '@collaborationtool/drizzle';
import {
  type ConnectionMode,
  type PrincipalContext,
  type SyncTokenPayload,
  SyncTokenError,
  classifyConnectionMode,
  loadPrincipalContext,
  verifySyncToken,
} from '@collaborationtool/permissions';
import type { DocumentId, PrincipalId } from '@collaborationtool/schema';

import type { GatewayEnv } from './env';

export interface AuthContext {
  principalId: PrincipalId;
  documentId: DocumentId;
  mode: ConnectionMode;
  /** Loaded capability bundle for the (principal, document) pair. */
  principalContext: PrincipalContext;
  /** When the JWT itself expires — gateway closes connection at that time. */
  jwtExpiresAt: Date;
  /** When the ACL row expires — re-verified on heartbeats. */
  aclExpiresAt: Date | null;
}

export type AuthFailure =
  | { kind: 'missing-token' }
  | { kind: 'malformed-url' }
  | { kind: 'invalid-token'; code: SyncTokenError['code']; message: string }
  | { kind: 'no-acl' }
  | { kind: 'no-document-read' }
  | { kind: 'doc-mismatch' };

export type AuthResult =
  | { ok: true; context: AuthContext }
  | { ok: false; failure: AuthFailure };

export interface ParsedHandshake {
  documentId: DocumentId;
  token: string;
}

export function parseHandshakeQuery(
  reqUrl: string | undefined,
  hostHeader: string,
): ParsedHandshake | null {
  if (!reqUrl) return null;
  let parsed: URL;
  try {
    // Node's IncomingMessage.url is path + query; pair it with the Host
    // header to make a valid absolute URL.
    parsed = new URL(reqUrl, `http://${hostHeader || 'localhost'}`);
  } catch {
    return null;
  }
  const docId = parsed.searchParams.get('docId');
  const token = parsed.searchParams.get('token');
  if (!docId || !token) return null;
  return { documentId: docId, token };
}

export interface AuthenticateOptions {
  env: GatewayEnv;
  db: Database;
}

export async function authenticate(
  req: Pick<IncomingMessage, 'url' | 'headers'>,
  options: AuthenticateOptions,
): Promise<AuthResult> {
  const parsed = parseHandshakeQuery(
    req.url,
    typeof req.headers.host === 'string' ? req.headers.host : '',
  );
  if (!parsed) {
    return { ok: false, failure: { kind: 'malformed-url' } };
  }
  const { documentId, token } = parsed;

  let payload: SyncTokenPayload;
  try {
    payload = await verifySyncToken(token, options.env.syncTokenSecret, {
      issuer: options.env.syncTokenIssuer,
      audience: options.env.syncTokenAudience,
    });
  } catch (err) {
    if (err instanceof SyncTokenError) {
      return {
        ok: false,
        failure: { kind: 'invalid-token', code: err.code, message: err.message },
      };
    }
    return {
      ok: false,
      failure: {
        kind: 'invalid-token',
        code: 'malformed',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // The JWT is bound to a specific docId. If the URL's docId doesn't
  // match the token's `doc` claim, reject — we don't want a token for
  // doc-A to grant access to doc-B.
  if (payload.doc !== documentId) {
    return { ok: false, failure: { kind: 'doc-mismatch' } };
  }

  const principalContext = await loadPrincipalContext(
    options.db,
    payload.sub,
    documentId,
  );
  if (!principalContext) {
    return { ok: false, failure: { kind: 'no-acl' } };
  }
  if (!principalContext.documentCapabilities.has('document.read')) {
    return { ok: false, failure: { kind: 'no-document-read' } };
  }

  const { mode } = classifyConnectionMode(principalContext.documentCapabilities);
  if (mode === null) {
    // Defensive — classify covers this with missing-document.read which we
    // already checked, but guards against future vocab additions.
    return { ok: false, failure: { kind: 'no-document-read' } };
  }

  return {
    ok: true,
    context: {
      principalId: payload.sub,
      documentId,
      mode,
      principalContext,
      jwtExpiresAt: new Date(payload.exp * 1000),
      aclExpiresAt: principalContext.expiresAt ?? null,
    },
  };
}

/**
 * The WebSocket close codes the gateway uses for auth failures.
 * RFC 6455 reserves 4000-4999 for application-defined codes.
 */
export const CLOSE_CODES = {
  MALFORMED_URL: 4400,
  INVALID_TOKEN: 4401,
  EXPIRED: 4402,
  NO_ACCESS: 4403,
  DOC_MISMATCH: 4404,
  REVOKED: 4405,
} as const;

export function failureToCloseCode(failure: AuthFailure): number {
  switch (failure.kind) {
    case 'missing-token':
    case 'malformed-url':
      return CLOSE_CODES.MALFORMED_URL;
    case 'invalid-token':
      if (failure.code === 'expired') return CLOSE_CODES.EXPIRED;
      return CLOSE_CODES.INVALID_TOKEN;
    case 'doc-mismatch':
      return CLOSE_CODES.DOC_MISMATCH;
    case 'no-acl':
    case 'no-document-read':
      return CLOSE_CODES.NO_ACCESS;
  }
}
