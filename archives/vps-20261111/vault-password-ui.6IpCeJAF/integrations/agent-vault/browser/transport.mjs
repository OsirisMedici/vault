import { spawn } from 'node:child_process';
const allowed = new Set(['t3_preview_list','preview_status','preview_click','preview_evaluate','preview_press','preview_navigate']);
export function unwrap(result) {
  if (result?.isError) throw new Error('host_operation_failed');
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find(c => c.type === 'text')?.text;
  if (text) { try { return JSON.parse(text); } catch { throw new Error('host_operation_failed'); } }
  return result;
}
// All arguments are fixed tool names/nonsecret DOM controls produced by the driver.
// Endpoint/authorization are inherited privately; never copy them into config or argv.
// Presence is configuration metadata, not proof of a callable host or tab access.
export function getT3TransportReadiness({env = process.env} = {}) {
  const environmentPresence = Object.fromEntries([
    'T3_ACP_MCP_ENDPOINT','T3_ACP_MCP_AUTHORIZATION',
    'T3_ACP_MCP_NODE','T3_ACP_MCP_ENTRYPOINT',
  ].map(key => [key,Boolean(env[key])]));
  return {
    transport:'acp-mcp-call',
    configured:environmentPresence.T3_ACP_MCP_ENDPOINT && environmentPresence.T3_ACP_MCP_AUTHORIZATION,
    environmentPresence,
  };
}
export function createT3CallTool({env = process.env,executable = env.T3_ACP_MCP_NODE || 't3',entrypoint = env.T3_ACP_MCP_ENTRYPOINT} = {}) {
  return async (name,args) => {
    if (!allowed.has(name) || !env.T3_ACP_MCP_ENDPOINT || !env.T3_ACP_MCP_AUTHORIZATION) throw new Error('host_transport_unavailable');
    const argv = [...(entrypoint ? [entrypoint] : []),'acp-mcp-call',name,JSON.stringify(args)];
    return new Promise((resolve,reject) => {
      const child = spawn(executable,argv,{env:{...env,...(executable === env.T3_ACP_MCP_NODE ? {ELECTRON_RUN_AS_NODE:'1'} : {})},stdio:['ignore','pipe','ignore']});
      child.stdout.setEncoding('utf8');
      let output = '', failed = false;
      const timer = setTimeout(()=>{failed=true;child.kill();reject(new Error('host_transport_unavailable'));},20_000);
      child.stdout.on('data',chunk=>{output += chunk; if (output.length > 262144) {failed=true;child.kill();reject(new Error('host_operation_failed'));}});
      child.on('error',()=>{clearTimeout(timer);reject(new Error('host_transport_unavailable'));});
      child.on('close',code=>{clearTimeout(timer); if (failed) return; if (code !== 0) return reject(new Error('host_operation_failed')); try {resolve(unwrap(JSON.parse(output)));} catch {reject(new Error('host_operation_failed'));}});
    });
  };
}
