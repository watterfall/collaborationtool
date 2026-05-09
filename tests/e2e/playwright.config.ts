// Phase 1 D15 Playwright config.
//
// The e2e suite spins up apps/web's Next.js dev server (which speaks to
// the workspace Postgres at DATABASE_URL). The sync-gateway is NOT
// started because the API-driven flow doesn't need WebSocket; D11/D15
// follow-ups will exercise gateway + y-sweet in a separate suite once
// docker-compose is wired into CI.

import { defineConfig } from '@playwright/test';

const PORT = 3100; // distinct from `pnpm web:dev`'s default 3000

export default defineConfig({
  testDir: './specs',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    actionTimeout: 15_000,
  },
  webServer: {
    // Spawn `next dev --port <PORT>` directly inside apps/web so we can
    // override the port without pnpm `--` argument forwarding semantics
    // turning the flag into a directory path.
    command: `pnpm exec next dev --port ${PORT}`,
    cwd: '../../apps/web',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    env: {
      BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'] ?? defaultSecret(),
      SYNC_TOKEN_SECRET: process.env['SYNC_TOKEN_SECRET'] ?? defaultSecret(),
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgres://collab:collab@localhost:5432/collaborationtool',
    },
  },
});

function defaultSecret(): string {
  // Deterministic dev secret — DO NOT use in prod.
  return 'phase-1-d15-e2e-dev-secret-32-chars-padding-padding-aaaa';
}
