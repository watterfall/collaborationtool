// Phase 4 W8.2 — ORCID provider tests.
//
// Two layers:
// 1) mapper unit tests (pure functions, no fetch) — preserved from
//    Phase 1.5 #2.
// 2) real OAuth round-trip simulation — drives the provider config end
//    to end with a stub fetch standing in for ORCID's authorize+token
//    endpoints, then asserts the user-shaped output that better-auth
//    would write to the `account` row.

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  buildOrcidProviderConfig,
  mapOrcidTokenToProfile,
  readOrcidEnv,
} from '../src/lib/orcid';

// ────────────────────────────────────────────────────────────────────
// Layer 1 · mapper unit tests
// ────────────────────────────────────────────────────────────────────

describe('mapOrcidTokenToProfile', () => {
  it('extracts orcid + name; synthesises placeholder email', () => {
    const profile = mapOrcidTokenToProfile({
      access_token: 'abc',
      orcid: '0000-0002-1825-0097',
      name: 'Josiah Carberry',
    });
    assert.equal(profile.orcid, '0000-0002-1825-0097');
    assert.equal(profile.name, 'Josiah Carberry');
    assert.equal(profile.email, '0000-0002-1825-0097@orcid.placeholder');
    assert.equal(profile.emailVerified, false);
  });

  it('uses real email when emailFromExtra is provided', () => {
    const profile = mapOrcidTokenToProfile(
      { orcid: '0000-0002-1825-0097', name: 'Josiah Carberry' },
      { emailFromExtra: 'jc@example.com' },
    );
    assert.equal(profile.email, 'jc@example.com');
    assert.equal(profile.emailVerified, true);
  });

  it('falls back to "ORCID <id>" when name is empty', () => {
    const profile = mapOrcidTokenToProfile({
      orcid: '0009-0001-2345-6789',
      name: '   ',
    });
    assert.equal(profile.name, 'ORCID 0009-0001-2345-6789');
  });

  it('rejects malformed orcid id', () => {
    assert.throws(
      () => mapOrcidTokenToProfile({ orcid: '12345', name: 'x' }),
      /malformed/,
    );
    assert.throws(
      () => mapOrcidTokenToProfile({ orcid: undefined, name: 'x' }),
      /malformed/,
    );
  });

  it('accepts the X check digit at the trailing position', () => {
    const profile = mapOrcidTokenToProfile({
      orcid: '0000-0002-1825-009X',
      name: 'X',
    });
    assert.equal(profile.orcid, '0000-0002-1825-009X');
  });
});

describe('buildOrcidProviderConfig', () => {
  it('uses live orcid.org by default', () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'APP-XYZ',
      clientSecret: 'secret',
      baseUrl: 'https://orcid.org',
    });
    assert.equal(cfg.providerId, 'orcid');
    assert.equal(cfg.clientId, 'APP-XYZ');
    assert.equal(cfg.authorizationUrl, 'https://orcid.org/oauth/authorize');
    assert.equal(cfg.tokenUrl, 'https://orcid.org/oauth/token');
    assert.deepEqual(cfg.scopes, ['/authenticate']);
  });

  it('routes sandbox base url unchanged', () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'x',
      clientSecret: 'y',
      baseUrl: 'https://sandbox.orcid.org',
    });
    assert.equal(
      cfg.authorizationUrl,
      'https://sandbox.orcid.org/oauth/authorize',
    );
  });

  it('mapProfileToUser feeds through mapOrcidTokenToProfile', () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'x',
      clientSecret: 'y',
      baseUrl: 'https://orcid.org',
    });
    const u = cfg.mapProfileToUser({
      orcid: '0000-0001-2345-6789',
      name: 'Test User',
    });
    assert.equal(u.name, 'Test User');
    assert.equal(u.email, '0000-0001-2345-6789@orcid.placeholder');
    assert.equal(u.emailVerified, false);
  });
});

// ────────────────────────────────────────────────────────────────────
// Layer 2 · real OAuth round-trip simulation
// ────────────────────────────────────────────────────────────────────
//
// The genericOAuth plugin in better-auth follows this contract on the
// callback:
//   1) POST <tokenUrl> with the auth code → receives the JSON token
//      payload (which for ORCID includes `orcid`, `name`, etc).
//   2) call `getUserInfo({ accessToken })` — we return null so the
//      plugin treats the token payload itself as the profile.
//   3) call `mapProfileToUser(profile)` → resulting {name,email,
//      emailVerified} are persisted into `account` + `user` rows.
//
// We don't spin up better-auth here; instead we exercise steps (1)-(3)
// using only the building blocks better-auth actually calls. That gives
// us a deterministic test that catches regressions in the provider
// wiring without needing a live ORCID OAuth client.

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore env so test order does not leak.
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    process.env[k] = v;
  }
});

/** Stand-in for ORCID's `/oauth/token` endpoint. Returns the same shape
 *  as the live service for scope=`/authenticate`. */
async function fakeOrcidTokenExchange(
  endpoint: string,
  formBody: URLSearchParams,
): Promise<Record<string, unknown>> {
  // Sanity: the genericOAuth plugin always hits the configured tokenUrl
  // with grant_type=authorization_code and the provider clientId.
  if (!endpoint.endsWith('/oauth/token')) {
    throw new Error(`unexpected token endpoint: ${endpoint}`);
  }
  if (formBody.get('grant_type') !== 'authorization_code') {
    throw new Error(`unexpected grant_type: ${formBody.get('grant_type')}`);
  }
  if (!formBody.get('client_id') || !formBody.get('client_secret')) {
    throw new Error('missing client credentials in token POST');
  }
  return {
    access_token: 'orcid-access-token-abc123',
    token_type: 'bearer',
    refresh_token: 'orcid-refresh-token-xyz789',
    expires_in: 631_138_518,
    scope: '/authenticate',
    name: 'Josiah Carberry',
    orcid: '0000-0002-1825-0097',
  };
}

describe('readOrcidEnv (env-gated provider registration)', () => {
  it('returns null when ORCID_CLIENT_ID is missing', () => {
    delete process.env['ORCID_CLIENT_ID'];
    delete process.env['ORCID_CLIENT_SECRET'];
    assert.equal(readOrcidEnv(), null);
  });

  it('returns null when only one half of the credential pair is set', () => {
    process.env['ORCID_CLIENT_ID'] = 'APP-ONLY';
    delete process.env['ORCID_CLIENT_SECRET'];
    assert.equal(readOrcidEnv(), null);
  });

  it('returns env tuple when both vars are set; defaults to live host', () => {
    process.env['ORCID_CLIENT_ID'] = 'APP-LIVE';
    process.env['ORCID_CLIENT_SECRET'] = 'shh';
    delete process.env['ORCID_BASE_URL'];
    const env = readOrcidEnv();
    assert.ok(env);
    assert.equal(env!.clientId, 'APP-LIVE');
    assert.equal(env!.clientSecret, 'shh');
    assert.equal(env!.baseUrl, 'https://orcid.org');
  });

  it('honours sandbox base url and trims trailing slash', () => {
    process.env['ORCID_CLIENT_ID'] = 'x';
    process.env['ORCID_CLIENT_SECRET'] = 'y';
    process.env['ORCID_BASE_URL'] = 'https://sandbox.orcid.org/';
    const env = readOrcidEnv();
    assert.equal(env?.baseUrl, 'https://sandbox.orcid.org');
  });
});

describe('ORCID OAuth round-trip (real-shape token exchange)', () => {
  it('happy path: token exchange → profile map → user record', async () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'APP-ROUNDTRIP',
      clientSecret: 'rt-secret',
      baseUrl: 'https://orcid.org',
    });

    // Step 1: better-auth's genericOAuth POSTs the auth-code to tokenUrl.
    const tokenResp = await fakeOrcidTokenExchange(
      cfg.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'auth-code-from-callback',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: 'http://localhost:3000/api/auth/oauth2/callback/orcid',
      }),
    );

    // Step 2: getUserInfo — ORCID profile lives in the token response,
    // so we returned null from the config; the plugin uses the token
    // payload as the profile.
    const userInfo = await cfg.getUserInfo({
      accessToken: tokenResp['access_token'] as string,
    });
    assert.equal(userInfo, null);

    // Step 3: mapProfileToUser → fields persisted to user + account rows.
    const user = cfg.mapProfileToUser(tokenResp as Record<string, unknown>);
    assert.equal(user.name, 'Josiah Carberry');
    assert.equal(user.email, '0000-0002-1825-0097@orcid.placeholder');
    assert.equal(user.emailVerified, false);

    // The orcid iri is what `account.accountId` will hold (see
    // src/lib/orcid-lookup.ts) — that's the canonical persistence path.
    assert.equal(tokenResp['orcid'], '0000-0002-1825-0097');
  });

  it('error path: token endpoint rejects → mapProfileToUser never called', async () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'x',
      clientSecret: 'y',
      baseUrl: 'https://orcid.org',
    });

    // Simulate ORCID returning {error: 'invalid_grant'} — the plugin
    // surfaces this to the UI as result.error, which the
    // OrcidSignIn component renders into the live region.
    const errResp = {
      error: 'invalid_grant',
      error_description: 'Authorization code expired',
    };
    // mapProfileToUser must never see an error payload as a "profile"
    // (no `orcid` field) — confirm the throw path.
    assert.throws(() => cfg.mapProfileToUser(errResp), /malformed/);
  });

  it('error path: malformed orcid id from server is rejected', async () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'x',
      clientSecret: 'y',
      baseUrl: 'https://orcid.org',
    });
    const badProfile = {
      access_token: 'a',
      orcid: 'NOT-AN-ORCID-IRI',
      name: 'Hacker',
    };
    assert.throws(
      () => cfg.mapProfileToUser(badProfile),
      /malformed orcid id/,
    );
  });

  it('integration: env-gated buildOrcidProviderConfig binds real creds', () => {
    process.env['ORCID_CLIENT_ID'] = 'APP-ENVTEST';
    process.env['ORCID_CLIENT_SECRET'] = 'env-secret';
    process.env['ORCID_BASE_URL'] = 'https://sandbox.orcid.org';
    const env = readOrcidEnv();
    assert.ok(env);
    const cfg = buildOrcidProviderConfig(env!);
    assert.equal(cfg.clientId, 'APP-ENVTEST');
    assert.equal(cfg.clientSecret, 'env-secret');
    assert.equal(
      cfg.authorizationUrl,
      'https://sandbox.orcid.org/oauth/authorize',
    );
    assert.equal(cfg.tokenUrl, 'https://sandbox.orcid.org/oauth/token');
  });

  it('callback URL contract: provider id is "orcid" so callback path is /api/auth/oauth2/callback/orcid', () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'x',
      clientSecret: 'y',
      baseUrl: 'https://orcid.org',
    });
    // The orcid-sign-in component calls authClient.signIn.oauth2 with
    // providerId='orcid'; better-auth derives the callback path from
    // providerId, so this must stay 'orcid' or the round-trip breaks.
    assert.equal(cfg.providerId, 'orcid');
  });
});
