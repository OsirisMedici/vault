#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { isAbsolute, dirname } from 'node:path';
import { lstat } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createLoginController } from './controller.mjs';
import { createBrowserDriver } from './driver.mjs';
import { createT3CallTool } from './transport.mjs';
import { publicResult } from './public.mjs';

// An owner-configured host factory wires the frozen engine/provider interfaces.
// Never accept its path or host code from MCP arguments.
export async function createServer({credentials,callTool = createT3CallTool(),clipboard} = {}) {
  credentials ??= {status:async()=>({state:'import_required'}),findAccounts:async()=>({state:'import_required'}),withCredential:async()=>{throw new Error('credential_unavailable');}};
  const controller = createLoginController({credentials,driver:createBrowserDriver({callTool,clipboard})});
  const server = new McpServer({name:'vault-agent-browser',version:'0.1.0'});
  const id = z.string().min(1).max(256);
  const register = (name,description,inputSchema,fn) => server.registerTool(name,{description,inputSchema},async args => {
    let value;
    try { value = publicResult(await fn(args)); } catch { value = {state:'failed',reasonCode:'host_operation_failed'}; }
    return {content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};
  });
  register('vault_agent_status','Report credential and browser host readiness.',{},()=>controller.status());
  register('vault_agent_find_accounts','Find account metadata for this supported browser origin. Select an opaque handle explicitly.',{threadId:id,tabId:id,query:z.string().max(256)},p=>controller.findAccounts(p));
  register('vault_agent_sign_in','Use a selected account privately, then verify its exact website identity.',{threadId:id,tabId:id,selectionId:z.string().uuid()},p=>controller.signIn(p));
  register('vault_agent_cancel','Invalidate selections and cancel queued work. Native fills already underway cannot be interrupted.',{requestId:z.string().uuid().optional()},p=>controller.cancel(p));
  return server;
}
async function main() {
  let runtime = {};
  const path = process.env.VAULT_AGENT_RUNTIME_MODULE;
  if (path) {
    if (!isAbsolute(path)) throw new Error('invalid_configuration');
    const file = await lstat(path), parent = await lstat(dirname(path));
    if (!file.isFile() || file.isSymbolicLink() || file.uid !== process.getuid() || (file.mode & 0o077) !== 0 || !parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) throw new Error('invalid_configuration');
    const factory = await import(pathToFileURL(path).href);
    runtime = await factory.createRuntime();
  }
  const server = await createServer(runtime);
  await server.connect(new StdioServerTransport());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(()=>{process.stderr.write('vault_agent_startup_failed\n');process.exitCode=1;});
