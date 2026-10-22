import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { createBridge, publicResult } from './bridge.mjs';

export function createServer(bridge = createBridge()) {
  const server = new McpServer({ name: 'Vault', version: '0.1.0' }, { instructions: 'Find saved accounts through native approval, explicitly select the intended account, then request a supported protected sign-in. Connection does not imply unlock or permission for later website actions. Never ask for or return passwords, codes, cookies, sessions or vault exports. A signed_in result requires exact target identity verification. Unsupported providers stay unsupported.' });
  const key = z.string().min(1).max(300).regex(/^[^\x00-\x1f\x7f]+$/);
  const ref = z.string().regex(/^[A-Za-z0-9_-]{16,80}$/);
  const response = value => { const result = publicResult(value); return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result }; };
  const register = (name, description, inputSchema, action) => server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: action === 'connection', destructiveHint: false, openWorldHint: action === 'login' } }, async args => response(await bridge.call({ action, ...args })));
  register('vault_status', 'Check the protected native adapter. Always available MCP does not mean an unlocked vault. native_adapter_required means the target T3 build has no usable bridge.', {}, 'connection');
  register('vault_find_accounts', 'Ask for native approval to search saved login metadata. Use the intended T3 threadId and attached tabId. Inspect all matches; explicitly choose among ambiguous accounts. Returns requestId immediately; poll vault_request_status after human approval. No secrets.', { threadId: key, tabId: key, query: z.string().trim().min(1).max(200) }, 'search');
  register('vault_sign_in', 'Request a fresh native approval and Touch ID for a selected saved account in its bound T3 tab. Only supported provider routes can fill. Does not accept URLs, scripts, selectors or credentials. Website MFA may need the owner. signed_in means exact identity observed in the target tab.', { threadId: key, tabId: key, selectionId: ref }, 'login');
  register('vault_request_status', 'Read bounded request status or approved account metadata. Request handles belong to this MCP connection. ready_to_verify is not signed-in acceptance.', { requestId: ref }, 'status');
  register('vault_cancel', 'Cancel private work and clear active access. Keeps encrypted device enrollment for a future approved request.', { requestId: ref }, 'cancel');
  const originalClose = server.close.bind(server);
  server.close = async () => { bridge.close(); await originalClose(); };
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  process.stdin.once('end', () => void server.close());
}
