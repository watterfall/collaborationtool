// Env validation. The worker reads PG + (D11) the gateway state HTTP.

export interface SnapshotEnv {
  databaseUrl: string;
  /** Tick interval in ms. Default 5 min. */
  intervalMs: number;
  /** Mark a doc stale after this many ms (default 60 min). */
  staleAfterMs: number;
  /** Cap candidates per tick (default 100). */
  maxPerTick: number;
  /** D11 only — gateway state HTTP url. Phase 1 D10: unused. */
  gatewayStateUrl?: string;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): SnapshotEnv {
  const databaseUrl =
    env['DATABASE_URL'] ??
    'postgres://collab:collab@localhost:5432/collaborationtool';

  const intervalMs = Number(env['SNAPSHOT_INTERVAL_MS'] ?? String(5 * 60 * 1000));
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
    throw new Error(`SNAPSHOT_INTERVAL_MS invalid: ${env['SNAPSHOT_INTERVAL_MS']}`);
  }

  const staleAfterMs = Number(
    env['SNAPSHOT_STALE_AFTER_MS'] ?? String(60 * 60 * 1000),
  );
  if (!Number.isFinite(staleAfterMs) || staleAfterMs < 1000) {
    throw new Error(
      `SNAPSHOT_STALE_AFTER_MS invalid: ${env['SNAPSHOT_STALE_AFTER_MS']}`,
    );
  }

  const maxPerTick = Number(env['SNAPSHOT_MAX_PER_TICK'] ?? '100');
  if (!Number.isFinite(maxPerTick) || maxPerTick < 1) {
    throw new Error(`SNAPSHOT_MAX_PER_TICK invalid: ${env['SNAPSHOT_MAX_PER_TICK']}`);
  }

  const out: SnapshotEnv = {
    databaseUrl,
    intervalMs,
    staleAfterMs,
    maxPerTick,
  };
  const gatewayStateUrl = env['GATEWAY_STATE_URL'];
  if (gatewayStateUrl) out.gatewayStateUrl = gatewayStateUrl;
  return out;
}
