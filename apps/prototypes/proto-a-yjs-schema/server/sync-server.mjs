// Local y-websocket server for proto-a manual dual-tab testing.
// Replaces the public y-webrtc signalling dependency: D3 was relying on
// wss://signaling.yjs.dev (a third-party host), which is fragile under
// network failures and out of scope for our Phase 1 sync gateway design.
//
// Run from repo root:
//   pnpm proto-a:sync         # ws://localhost:1234
// Or from this package:
//   pnpm sync-server
//
// The server has no persistence — it's a relay only. y-indexeddb on the
// client provides per-tab persistence; the server just connects peers.

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

const host = process.env.HOST ?? 'localhost';
const port = Number(process.env.PORT ?? 1234);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('proto-a y-websocket relay\n');
});

const wss = new WebSocketServer({ server });
wss.on('connection', (conn, req) => setupWSConnection(conn, req));

server.listen(port, host, () => {
  console.log(`proto-a y-websocket relay listening on ws://${host}:${port}`);
  console.log('Two-tab manual test: keep this server running, then `pnpm proto-a:dev` in another terminal.');
});
