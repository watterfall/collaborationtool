// Sync token sign + verify round-trip + every error path.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SYNC_TOKEN_DEFAULT_TTL_SECONDS,
  SyncTokenError,
  signSyncToken,
  syncTokenSecretFromString,
  verifySyncToken,
} from '../src/jwt';

const SECRET = syncTokenSecretFromString(
  'unit-test-only-secret-32-chars-min-padding-here',
);
const ALT_SECRET = syncTokenSecretFromString(
  'different-secret-also-32-chars-padding-padding-h',
);

const ISSUER = 'test.web';
const AUDIENCE = 'sync-gateway';
const SUB = 'user:01HXX-test-user' as const;
const DOC = '01HXX-test-document' as const;

describe('syncTokenSecretFromString', () => {
  it('throws on too-short secret', () => {
    assert.throws(() => syncTokenSecretFromString('short'), /too short/);
  });

  it('returns Uint8Array on adequate length', () => {
    const s = syncTokenSecretFromString('a'.repeat(32));
    assert.ok(s instanceof Uint8Array);
    assert.equal(s.length, 32);
  });
});

describe('sign + verify round-trip', () => {
  it('valid token produces matching payload', async () => {
    const token = await signSyncToken(
      { sub: SUB, doc: DOC },
      SECRET,
      { issuer: ISSUER, audience: AUDIENCE },
    );
    const payload = await verifySyncToken(token, SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    assert.equal(payload.sub, SUB);
    assert.equal(payload.doc, DOC);
    assert.equal(payload.iss, ISSUER);
    assert.equal(payload.aud, AUDIENCE);
    assert.ok(payload.iat <= Math.floor(Date.now() / 1000));
    assert.equal(payload.exp - payload.iat, SYNC_TOKEN_DEFAULT_TTL_SECONDS);
  });

  it('respects custom TTL', async () => {
    const token = await signSyncToken(
      { sub: SUB, doc: DOC },
      SECRET,
      { issuer: ISSUER, audience: AUDIENCE, ttlSeconds: 30 },
    );
    const payload = await verifySyncToken(token, SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    assert.equal(payload.exp - payload.iat, 30);
  });
});

describe('verifySyncToken error paths', () => {
  it('rejects token signed with different secret', async () => {
    const token = await signSyncToken(
      { sub: SUB, doc: DOC },
      ALT_SECRET,
      { issuer: ISSUER, audience: AUDIENCE },
    );
    await assert.rejects(
      () => verifySyncToken(token, SECRET, { issuer: ISSUER, audience: AUDIENCE }),
      (err: unknown) => {
        assert.ok(err instanceof SyncTokenError);
        assert.equal(err.code, 'invalid-signature');
        return true;
      },
    );
  });

  it('rejects token from wrong issuer', async () => {
    const token = await signSyncToken(
      { sub: SUB, doc: DOC },
      SECRET,
      { issuer: 'evil.web', audience: AUDIENCE },
    );
    await assert.rejects(
      () => verifySyncToken(token, SECRET, { issuer: ISSUER, audience: AUDIENCE }),
      (err: unknown) => {
        assert.ok(err instanceof SyncTokenError);
        assert.equal(err.code, 'wrong-issuer');
        return true;
      },
    );
  });

  it('rejects token with wrong audience', async () => {
    const token = await signSyncToken(
      { sub: SUB, doc: DOC },
      SECRET,
      { issuer: ISSUER, audience: 'different-gateway' },
    );
    await assert.rejects(
      () => verifySyncToken(token, SECRET, { issuer: ISSUER, audience: AUDIENCE }),
      (err: unknown) => {
        assert.ok(err instanceof SyncTokenError);
        assert.equal(err.code, 'wrong-audience');
        return true;
      },
    );
  });

  it('rejects expired token', async () => {
    // Sign a token that expired one minute ago by setting nowSeconds to
    // the past + a 60s TTL = exp also in the past.
    const past = Math.floor(Date.now() / 1000) - 120;
    const token = await signSyncToken(
      { sub: SUB, doc: DOC },
      SECRET,
      {
        issuer: ISSUER,
        audience: AUDIENCE,
        ttlSeconds: 60,
        nowSeconds: past,
      },
    );
    await assert.rejects(
      () =>
        verifySyncToken(token, SECRET, {
          issuer: ISSUER,
          audience: AUDIENCE,
          clockToleranceSeconds: 0,
        }),
      (err: unknown) => {
        assert.ok(err instanceof SyncTokenError);
        assert.equal(err.code, 'expired');
        return true;
      },
    );
  });

  it('rejects garbage input', async () => {
    await assert.rejects(
      () =>
        verifySyncToken('not.a.real.jwt', SECRET, {
          issuer: ISSUER,
          audience: AUDIENCE,
        }),
      (err: unknown) => {
        assert.ok(err instanceof SyncTokenError);
        assert.ok(['malformed', 'invalid-signature'].includes(err.code));
        return true;
      },
    );
  });
});
