// Env validation unit tests. Pure — no network, no DB.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadEnv } from '../src/env';

const VALID_SECRET = 'env-test-secret-32-chars-padding-padding-h';

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  return fn.call({ env: { ...env } } as unknown);
}

describe('loadEnv', () => {
  it('uses defaults except for required SYNC_TOKEN_SECRET', () => {
    const env = loadEnv({ SYNC_TOKEN_SECRET: VALID_SECRET });
    assert.equal(env.port, 4321);
    assert.equal(env.host, '127.0.0.1');
    assert.equal(env.heartbeatMs, 60000);
    assert.equal(env.syncTokenIssuer, 'collaborationtool.web');
    assert.equal(env.syncTokenAudience, 'sync-gateway');
    assert.equal(env.logLevel, 'info');
    assert.ok(env.databaseUrl.includes('postgres'));
  });

  it('requires SYNC_TOKEN_SECRET', () => {
    assert.throws(() => loadEnv({}), /SYNC_TOKEN_SECRET is required/);
  });

  it('rejects too-short SYNC_TOKEN_SECRET', () => {
    assert.throws(
      () => loadEnv({ SYNC_TOKEN_SECRET: 'too-short' }),
      /too short/,
    );
  });

  it('rejects bad PORT', () => {
    assert.throws(
      () => loadEnv({ SYNC_TOKEN_SECRET: VALID_SECRET, PORT: 'abc' }),
      /PORT invalid/,
    );
    assert.throws(
      () => loadEnv({ SYNC_TOKEN_SECRET: VALID_SECRET, PORT: '99999' }),
      /PORT invalid/,
    );
  });

  it('rejects bad HEARTBEAT_MS', () => {
    assert.throws(
      () => loadEnv({ SYNC_TOKEN_SECRET: VALID_SECRET, HEARTBEAT_MS: '0' }),
      /HEARTBEAT_MS invalid/,
    );
    assert.throws(
      () => loadEnv({ SYNC_TOKEN_SECRET: VALID_SECRET, HEARTBEAT_MS: 'NaN' }),
      /HEARTBEAT_MS invalid/,
    );
  });

  it('accepts test-grade HEARTBEAT_MS down to 50ms floor', () => {
    const env = loadEnv({
      SYNC_TOKEN_SECRET: VALID_SECRET,
      HEARTBEAT_MS: '100',
    });
    assert.equal(env.heartbeatMs, 100);
  });

  it('rejects bad LOG_LEVEL', () => {
    assert.throws(
      () => loadEnv({ SYNC_TOKEN_SECRET: VALID_SECRET, LOG_LEVEL: 'verbose' }),
      /LOG_LEVEL invalid/,
    );
  });

  it('overrides take effect', () => {
    const env = loadEnv({
      SYNC_TOKEN_SECRET: VALID_SECRET,
      PORT: '5000',
      HOST: '0.0.0.0',
      SYNC_TOKEN_ISSUER: 'custom.issuer',
      SYNC_TOKEN_AUDIENCE: 'custom.audience',
      HEARTBEAT_MS: '15000',
      LOG_LEVEL: 'debug',
    });
    assert.equal(env.port, 5000);
    assert.equal(env.host, '0.0.0.0');
    assert.equal(env.syncTokenIssuer, 'custom.issuer');
    assert.equal(env.syncTokenAudience, 'custom.audience');
    assert.equal(env.heartbeatMs, 15000);
    assert.equal(env.logLevel, 'debug');
  });

  it('y-sweet config: both YSWEET_URL + YSWEET_AUTH required together', () => {
    // YSWEET_URL alone — bail out
    assert.throws(
      () =>
        loadEnv({
          SYNC_TOKEN_SECRET: VALID_SECRET,
          YSWEET_URL: 'http://ysweet:8080',
        }),
      /YSWEET_URL is set but YSWEET_AUTH/,
    );
    // both set — accepted
    const env = loadEnv({
      SYNC_TOKEN_SECRET: VALID_SECRET,
      YSWEET_URL: 'http://ysweet:8080',
      YSWEET_AUTH: 'srv-token',
    });
    assert.equal(env.ysweetUrl, 'http://ysweet:8080');
    assert.equal(env.ysweetServerToken, 'srv-token');
    assert.equal(env.ysweetConnectTimeoutMs, 5000);
  });

  it('y-sweet timeout is configurable + validated', () => {
    const env = loadEnv({
      SYNC_TOKEN_SECRET: VALID_SECRET,
      YSWEET_URL: 'http://ysweet:8080',
      YSWEET_AUTH: 'srv',
      YSWEET_CONNECT_TIMEOUT_MS: '7500',
    });
    assert.equal(env.ysweetConnectTimeoutMs, 7500);

    assert.throws(
      () =>
        loadEnv({
          SYNC_TOKEN_SECRET: VALID_SECRET,
          YSWEET_CONNECT_TIMEOUT_MS: 'abc',
        }),
      /YSWEET_CONNECT_TIMEOUT_MS invalid/,
    );
  });
});

// the unused-helper hint: keep for future when we add isolated env spec.
void withEnv;
