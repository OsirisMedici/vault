import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.mjs';
import { publicResult } from '../src/bridge.mjs';

test('real spaced-path entrypoint initializes, discovers tools and reports absent native adapter', async () => {
  const path = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
  assert.ok(path.includes('code projects'));
  const transport = new StdioClientTransport({ command: process.execPath, args: [path], stderr: 'pipe' });
  const client = new Client({ name: 'fixture', version: '1' });
  try {
    await client.connect(transport);
    const list = await client.listTools();
    assert.deepEqual(list.tools.map(x => x.name).sort(), ['vault_cancel','vault_find_accounts','vault_request_status','vault_sign_in','vault_status']);
    const result = await client.callTool({ name: 'vault_status', arguments: {} });
    assert.deepEqual(result.structuredContent, { state: 'native_adapter_required' });
  } finally { await client.close(); }
});

test('MCP lookup and explicit selection use metadata-only fixed commands', async () => {
  const calls = [];
  let closed = false;
  const bridge = { call: async x => { calls.push(x); return { state: 'needs_approval', requestId: 'a'.repeat(32) }; }, close: () => { closed = true; } };
  const server = createServer(bridge);
  const client = new Client({ name: 'fixture', version: '1' });
  const [a,b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  const args = { threadId: 'fixture-thread', tabId: 'fixture-tab', query: 'Slack' };
  await client.callTool({ name: 'vault_find_accounts', arguments: args });
  assert.deepEqual(calls[0], { action: 'search', ...args });
  await client.callTool({ name: 'vault_sign_in', arguments: { threadId: args.threadId, tabId: args.tabId, selectionId: 'b'.repeat(32) } });
  assert.equal(calls[1].action, 'login');
  const invalid = await client.callTool({ name: 'vault_sign_in', arguments: { threadId: args.threadId, tabId: args.tabId, selectionId: 'bad' } });
  assert.equal(invalid.isError, true); assert.equal(calls.length, 2);
  await server.close(); await client.close(); assert.ok(closed);
});

test('response allowlist removes payloads, unsafe URLs and error text', () => {
  const marker = 'SENTINEL_NEVER_IN_TOOL_OUTPUT';
  const raw = { state: 'accounts_ready', password: marker, cookies: marker, accounts: [{ selectionId: 'a'.repeat(32), itemId: marker, name: 'Slack', username: 'fixture@example.com', origins: ['https://slack.com', `https://user:${marker}@evil.test/a`, `https://example.test/?token=${marker}`], supported: false, password: marker, notes: marker }] };
  const result = publicResult(raw);
  assert.equal(JSON.stringify(result).includes(marker), false);
  assert.deepEqual(result.accounts[0].origins, ['https://slack.com']);
  assert.deepEqual(publicResult({ state: marker, error: marker }), { state: 'failed' });
  assert.deepEqual(publicResult({ state: 'failed', error: marker }), { state: 'failed' });
});
