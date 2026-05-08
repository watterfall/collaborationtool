// Env validation. The worker reads PG + (when YSWEET_URL set) y-sweet
// HTTP for the document Yjs binary.

export interface SnapshotEnv {
  databaseUrl: string;
  /** Tick interval in ms. Default 5 min. */
  intervalMs: number;
  /** Mark a doc stale after this many ms (default 60 min). */
  staleAfterMs: number;
  /** Cap candidates per tick (default 100). */
  maxPerTick: number;
  /** y-sweet base URL. When set, the worker uses y-sweet HTTP for source. */
  ysweetUrl?: string;
  /** y-sweet bearer token (matches Y_SWEET_AUTH on y-sweet). */
  ysweetServerToken?: string;
  /** Per-request timeout for y-sweet HTTP. Default 10s. */
  ysweetTimeoutMs: number;
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

  const ysweetUrl = env['YSWEET_URL'];
  const ysweetServerToken = env['YSWEET_AUTH'];
  if (ysweetUrl && !ysweetServerToken) {
    throw new Error(
      'YSWEET_URL is set but YSWEET_AUTH is not — both required to fetch y-sweet state.',
    );
  }

  const ysweetTimeoutMs = Number(env['YSWEET_TIMEOUT_MS'] ?? '10000');
  if (!Number.isFinite(ysweetTimeoutMs) || ysweetTimeoutMs < 100) {
    throw new Error(`YSWEET_TIMEOUT_MS invalid: ${env['YSWEET_TIMEOUT_MS']}`);
  }

  const out: SnapshotEnv = {
    databaseUrl,
    intervalMs,
    staleAfterMs,
    maxPerTick,
    ysweetTimeoutMs,
  };
  if (ysweetUrl) out.ysweetUrl = ysweetUrl;
  if (ysweetServerToken) out.ysweetServerToken = ysweetServerToken;
  return out;
}
