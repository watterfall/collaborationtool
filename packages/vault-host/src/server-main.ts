// vault-host server entry — spawned by the Tauri shell (dev-tier transport).
//
// Dev invocation (what apps/desktop's vault_host_start resolves to):
//   node --import tsx packages/vault-host/src/server-main.ts
//
// stdout is the protocol channel — anything else must go to stderr.
// stdout 是协议通道——任何日志只能走 stderr。

import { createVaultHostServer } from './server';

const server = createVaultHostServer({
  input: process.stdin,
  output: process.stdout,
  onShutdown: () => {
    process.exit(0);
  },
});

const stop = (): void => {
  void server.close().finally(() => process.exit(0));
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

process.stderr.write(
  'vault-host server ready (stdio ndjson JSON-RPC) / vault-host 服务已就绪\n',
);
