// SPDX-License-Identifier: GPL-3.0-only
import { createBridge } from './bridge.mjs';
import { loadConfig } from './config.mjs';

export async function start() {
  // Restrict SQLite rollback journal creation before opening any private state.
  process.umask(0o077);
  const bridge = await createBridge({ config: await loadConfig() });
  try {
    const server = Bun.serve({ hostname: '0.0.0.0', port: 19433, maxRequestBodySize: 2048,
      idleTimeout: 10, development: false, fetch: request => bridge.fetch(request),
      error: () => new Response('{"error":"unavailable"}', { status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }),
    });
    const stop = async () => { await server.stop(true); bridge.close(); };
    return { server, stop };
  } catch { bridge.close(); throw new Error('bridge_unavailable'); }
}

if (import.meta.main) {
  try {
    const service = await start();
    const shutdown = () => { service.stop().finally(() => process.exit(0)); };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    console.log('{"status":"listening","port":19433}');
  } catch {
    console.error('{"error":"bridge_unavailable"}');
    process.exitCode = 1;
  }
}
