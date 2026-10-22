import net from 'node:net';
import { lstat } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const defaultSocket = join(homedir(), '.config/osiris-agent-vault/run/t3-vault.sock');
const states = new Set(['idle','needs_approval','needs_unlock','unlocking','private_signin','transferring','ready_to_verify','signed_in','accounts_ready','cancelled','expired','denied','busy','failed','unsupported_provider','native_adapter_required']);
const text = (value, limit = 200) => typeof value === 'string' && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
const opaque = value => text(value, 80) && /^[a-zA-Z0-9_-]{16,80}$/.test(value);

// Reconstruct every response. Native exceptions, CLI records and extra keys are
// never serialized into the MCP response, even from an incompatible adapter.
export function publicResult(value) {
  if (!value || !states.has(value.state)) return { state: 'failed' };
  const result = { state: value.state };
  if (opaque(value.requestId)) result.requestId = value.requestId;
  if (value.state === 'accounts_ready' && Array.isArray(value.accounts)) {
    result.accounts = value.accounts.slice(0, 50).flatMap(account => {
      if (!opaque(account.selectionId) || !text(account.name) || !text(account.username) || !Array.isArray(account.origins)) return [];
      const origins = account.origins.slice(0, 10).filter(origin => {
        try { const u = new URL(origin); return u.protocol === 'https:' && u.origin === origin && !u.username && !u.password && !u.port; } catch { return false; }
      });
      return [{ selectionId: account.selectionId, name: account.name, username: account.username, origins, supported: account.supported === true }];
    });
    result.selectionRequired = result.accounts.length > 1;
  }
  return result;
}

export function createBridge(socketPath = defaultSocket) {
  let socket;
  let connecting;
  let buffer = '';
  const pending = new Map();
  const fail = () => {
    socket = undefined;
    buffer = '';
    for (const { resolve, timer } of pending.values()) { clearTimeout(timer); resolve({ state: 'native_adapter_required' }); }
    pending.clear();
  };
  const connect = async () => {
    if (socket && !socket.destroyed) return socket;
    if (connecting) return connecting;
    connecting = (async () => {
      for (const path of [dirname(socketPath), socketPath]) {
        const stat = await lstat(path);
        if (stat.isSymbolicLink() || stat.uid !== userInfo().uid || (stat.mode & 0o077) !== 0 || (path === socketPath ? !stat.isSocket() : !stat.isDirectory())) throw new Error('untrusted_adapter');
      }
      const candidate = net.createConnection(socketPath);
      await new Promise((resolve, reject) => { candidate.once('connect', resolve); candidate.once('error', reject); });
      socket = candidate;
      candidate.setEncoding('utf8');
      candidate.on('error', fail);
      candidate.on('close', fail);
      candidate.on('data', chunk => {
        buffer += chunk;
        if (buffer.length > 128 * 1024) { candidate.destroy(); return; }
        let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try {
            const response = JSON.parse(line);
            const entry = pending.get(response.id);
            if (entry) { pending.delete(response.id); clearTimeout(entry.timer); entry.resolve(publicResult(response.result)); }
          } catch { candidate.destroy(); }
        }
      });
      return candidate;
    })().finally(() => { connecting = undefined; });
    return connecting;
  };
  return {
    async call(request) {
      try {
        const client = await connect();
        const id = randomUUID();
        return await new Promise(resolve => {
          const timer = setTimeout(() => { pending.delete(id); client.destroy(); resolve({ state: 'native_adapter_required' }); }, 5000);
          pending.set(id, { resolve, timer });
          client.write(JSON.stringify({ id, ...request }) + '\n');
        });
      } catch { return { state: 'native_adapter_required' }; }
    },
    close() { socket?.destroy(); fail(); },
  };
}
