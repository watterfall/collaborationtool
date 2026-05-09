// Server-only env validation. Imported by lib/auth.ts and route handlers.
// Throws at startup if anything's missing — better than 500-ing on first
// request. Don't import this from a client component.

import { syncTokenSecretFromString } from '@collaborationtool/permissions';

if (typeof window !== 'undefined') {
  throw new Error('apps/web/src/lib/env.ts is server-only');
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

export const env = {
  databaseUrl:
    process.env['DATABASE_URL'] ??
    'postgres://collab:collab@localhost:5432/collaborationtool',
  betterAuthSecret: required('BETTER_AUTH_SECRET'),
  betterAuthUrl: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
  syncTokenSecret: syncTokenSecretFromString(required('SYNC_TOKEN_SECRET')),
  syncTokenIssuer:
    process.env['SYNC_TOKEN_ISSUER'] ?? 'collaborationtool.web',
  syncTokenAudience: process.env['SYNC_TOKEN_AUDIENCE'] ?? 'sync-gateway',
  syncGatewayWsUrl:
    process.env['SYNC_GATEWAY_WS_URL'] ?? 'ws://127.0.0.1:4321/ws',
};
