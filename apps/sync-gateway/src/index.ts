// CLI entry point. `pnpm --filter @collaborationtool/sync-gateway start`.

import { startGateway } from './server';

if (import.meta.url === `file://${process.argv[1]}`) {
  startGateway().catch((err) => {
    console.error('[sync-gateway] failed to start:', err);
    process.exit(1);
  });
}

export { startGateway } from './server';
export { loadEnv } from './env';
export type { GatewayEnv } from './env';
export type { AuthContext, AuthFailure, AuthResult } from './auth';
export { CLOSE_CODES } from './auth';
