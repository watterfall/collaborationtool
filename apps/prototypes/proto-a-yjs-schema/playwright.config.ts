import { defineConfig, devices } from '@playwright/test';

// Headless dual-tab automation that substitutes for the manual D3 browser
// test. Spins up the y-websocket relay and the Vite dev server, then
// drives two isolated browser contexts (=two "browsers" from y-websocket's
// view) through the 3 cases listed in findings.md.
//
// Each test asserts:
//   1. the y-prosemirror warning counter remains 0
//   2. both tabs converge to byte-identical Y.Doc body fragment JSON

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // tabs share a relay; isolate per file run
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'node server/sync-server.mjs',
      url: 'http://localhost:1234',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
