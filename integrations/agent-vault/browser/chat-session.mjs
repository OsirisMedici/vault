#!/usr/bin/env bun
// The current chat supplies supported T3 tool calls. Secrets stay inside this host.
// This is an explicit chat relay, not an external ACP authorization substitute.
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { createRuntime } from './runtime.mjs';
import { createBrowserDriver } from './driver.mjs';
import { createLoginController } from './controller.mjs';
import { publicResult } from './public.mjs';

const allowed = new Set(['preview_status', 'preview_click', 'preview_evaluate', 'preview_press', 'preview_navigate', 't3_preview_list']);
const waiting = new Map();
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const runtime = await createRuntime();
const callTool = (name, args) => new Promise((resolve, reject) => {
  if (!allowed.has(name)) return reject(new Error('host_operation_failed'));
  const id = randomUUID();
  const timer = setTimeout(() => { waiting.delete(id); reject(new Error('host_transport_unavailable')); }, 90_000);
  waiting.set(id, { resolve, reject, timer });
  send({ type: 'tool_request', id, name, args });
});
const driver = createBrowserDriver({ callTool });
const controller = createLoginController({ credentials: runtime.credentials, driver });
let busy = false;
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
input.on('line', async line => {
  let message;
  try { if (line.length > 262144) throw 0; message = JSON.parse(line); } catch { return; }
  if (message.type === 'tool_response') {
    const pending = waiting.get(message.id);
    if (!pending) return;
    waiting.delete(message.id); clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error('host_operation_failed'));
    else pending.resolve(message.result);
    return;
  }
  if (message.type !== 'command') return;
  if (message.action === 'close' && !busy) { input.close(); process.exit(0); }
  if (busy) return send({ type: 'result', id: message.id, result: { state: 'denied', reasonCode: 'request_in_progress' } });
  busy = true;
  try {
    let result;
    if (message.action === 'status') result = await controller.status();
    else if (message.action === 'find') result = await controller.findAccounts(message.args);
    else if (message.action === 'sign-in') result = await controller.signIn(message.args);
    else if (message.action === 'cancel') result = await controller.cancel(message.args);
    else if (message.action === 'verify') {
      const p = message.args;
      const tab = await driver.inspect({ tabId: p.tabId });
      const matches = await runtime.credentials.findAccounts({ query: p.query, origin: tab.origin });
      const rows = matches.accounts?.filter(a => a.username === p.username) ?? [];
      if (rows.length !== 1) result = { state: 'denied', reasonCode: 'selection_invalid' };
      else {
        const verified = await driver.verifyIdentity({ tabId: p.tabId, provider: p.provider, expectedUsername: rows[0].username });
        result = verified.matched ? { state: 'signed_in', account: { name: rows[0].name, username: rows[0].username, origin: tab.origin } }
          : { state: 'verification_required', reasonCode: 'identity_unverified' };
      }
    } else result = { state: 'denied', reasonCode: 'invalid_request' };
    send({ type: 'result', id: message.id, result: publicResult(result) });
  } catch { send({ type: 'result', id: message.id, result: { state: 'failed', reasonCode: 'host_operation_failed' } }); }
  finally { busy = false; }
});
input.on('close', () => { for (const p of waiting.values()) { clearTimeout(p.timer); p.reject(new Error('host_transport_unavailable')); } });
send({ type: 'session_ready', transport: 'chat-tool-relay' });
