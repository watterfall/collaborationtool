// Phase 1.5 #2 — ORCID OAuth provider config + profile mapper.
//
// ORCID's `/oauth/token` response (with scope=/authenticate) returns
//   { access_token, token_type, refresh_token, expires_in, scope,
//     name, orcid }
// The orcid id is the canonical user identifier (`0000-0000-0000-0000`
// shape, 19 chars + 3 hyphens). Email is NOT in the token; the
// `/read-limited` scope can fetch it but Phase 1.5 keeps to the
// minimum scope. We synthesise a placeholder email so better-auth's
// schema (NOT NULL email) accepts the row; the user can change it
// later via account settings.

const ORCID_ID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export interface OrcidTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  name?: unknown;
  orcid?: unknown;
}

export interface OrcidUserProfile {
  /** ORCID iD in canonical 16-digit form. */
  orcid: string;
  /** Display name as ORCID returns it (may be empty). */
  name: string;
  /** Synthetic if ORCID didn't reveal one (private email). */
  email: string;
  /** True iff the email came from ORCID, not the placeholder. */
  emailVerified: boolean;
}

export interface OrcidProviderEnv {
  clientId: string;
  clientSecret: string;
  /** `https://orcid.org` (live) or `https://sandbox.orcid.org` (test). */
  baseUrl: string;
}

export function readOrcidEnv(): OrcidProviderEnv | null {
  const clientId = process.env['ORCID_CLIENT_ID'];
  const clientSecret = process.env['ORCID_CLIENT_SECRET'];
  if (!clientId || !clientSecret) return null;
  const baseUrl = (process.env['ORCID_BASE_URL'] ?? 'https://orcid.org').replace(/\/+$/, '');
  return { clientId, clientSecret, baseUrl };
}

/**
 * Convert ORCID's token-response payload into a user profile shape that
 * better-auth's `mapProfileToUser` callback expects.
 *
 * Throws when the orcid id is missing / malformed — better-auth treats
 * a thrown getUserInfo as a sign-in failure, which is what we want.
 */
export function mapOrcidTokenToProfile(
  token: OrcidTokenResponse,
  options: { emailFromExtra?: string } = {},
): OrcidUserProfile {
  const orcid = typeof token.orcid === 'string' ? token.orcid.trim() : '';
  if (!ORCID_ID_RE.test(orcid)) {
    throw new Error(`ORCID returned malformed orcid id: ${JSON.stringify(token.orcid)}`);
  }
  const name = typeof token.name === 'string' && token.name.trim().length > 0
    ? token.name.trim()
    : `ORCID ${orcid}`;
  const realEmail = options.emailFromExtra?.trim();
  if (realEmail) {
    return { orcid, name, email: realEmail, emailVerified: true };
  }
  // Placeholder email: stable per orcid id, never collides with real
  // email-and-password sign-ups (the .placeholder TLD is reserved per
  // RFC 6761, never resolvable).
  return {
    orcid,
    name,
    email: `${orcid}@orcid.placeholder`,
    emailVerified: false,
  };
}

/** Build the better-auth genericOAuth config for ORCID. */
export function buildOrcidProviderConfig(env: OrcidProviderEnv): {
  providerId: 'orcid';
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  getUserInfo: (tokens: { accessToken?: string }) => Promise<null>;
  mapProfileToUser: (profile: Record<string, unknown>) => {
    name: string;
    email: string;
    emailVerified: boolean;
  };
} {
  return {
    providerId: 'orcid',
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    authorizationUrl: `${env.baseUrl}/oauth/authorize`,
    tokenUrl: `${env.baseUrl}/oauth/token`,
    scopes: ['/authenticate'],
    // ORCID returns the user identity (orcid + name) inline with the
    // token response — the better-auth genericOAuth plugin parses that
    // payload before calling getUserInfo, so we just return null and
    // let mapProfileToUser run against the merged token+profile blob.
    getUserInfo: async () => null,
    mapProfileToUser: (profile) => {
      const mapped = mapOrcidTokenToProfile(profile as OrcidTokenResponse);
      return {
        name: mapped.name,
        email: mapped.email,
        emailVerified: mapped.emailVerified,
      };
    },
  };
}
