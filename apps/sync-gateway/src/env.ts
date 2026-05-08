// Env var validation. Fail fast on missing or short secrets.

import { syncTokenSecretFromString } from '@collaborationtool/permissions';

export interface GatewayEnv {
  port: number;
  host: string;
  databaseUrl: string;
  syncTokenSecret: Uint8Array;
  syncTokenIssuer: string;
  syncTokenAudience: string;
  /** Heartbeat interval — ADR-0002 §4 default 60s. */
  heartbeatMs: number;
  /** Maximum WebSocket frame size; reject larger to bound memory. 1 MiB default. */
  maxFrameBytes: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): GatewayEnv {
  const port = Number(env['PORT'] ?? '4321');
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT invalid: ${env['PORT']}`);
  }

  const host = env['HOST'] ?? '127.0.0.1';

  const databaseUrl =
    env['DATABASE_URL'] ??
    'postgres://collab:collab@localhost:5432/collaborationtool';

  const secretStr = env['SYNC_TOKEN_SECRET'];
  if (!secretStr) {
    throw new Error(
      'SYNC_TOKEN_SECRET is required. Generate one with `openssl rand -base64 32`.',
    );
  }
  const syncTokenSecret = syncTokenSecretFromString(secretStr);

  const syncTokenIssuer = env['SYNC_TOKEN_ISSUER'] ?? 'collaborationtool.web';
  const syncTokenAudience = env['SYNC_TOKEN_AUDIENCE'] ?? 'sync-gateway';

  const heartbeatMs = Number(env['HEARTBEAT_MS'] ?? '60000');
  // Floor at 50ms so tests can drive fast revocation paths without
  // dropping below a sensible production minimum. Production deployments
  // should always run at >= 30s; 50ms is a hard floor.
  if (!Number.isFinite(heartbeatMs) || heartbeatMs < 50) {
    throw new Error(`HEARTBEAT_MS invalid: ${env['HEARTBEAT_MS']}`);
  }

  const maxFrameBytes = Number(env['MAX_FRAME_BYTES'] ?? String(1024 * 1024));
  if (!Number.isFinite(maxFrameBytes) || maxFrameBytes < 1024) {
    throw new Error(`MAX_FRAME_BYTES invalid: ${env['MAX_FRAME_BYTES']}`);
  }

  const rawLogLevel = (env['LOG_LEVEL'] ?? 'info') as GatewayEnv['logLevel'];
  if (!['debug', 'info', 'warn', 'error'].includes(rawLogLevel)) {
    throw new Error(`LOG_LEVEL invalid: ${env['LOG_LEVEL']}`);
  }

  return {
    port,
    host,
    databaseUrl,
    syncTokenSecret,
    syncTokenIssuer,
    syncTokenAudience,
    heartbeatMs,
    maxFrameBytes,
    logLevel: rawLogLevel,
  };
}
