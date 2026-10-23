#!/usr/bin/env bun
// One metadata-only external CLI probe. Never load the engine or print raw output.
import { spawnSync } from 'node:child_process';
import { getT3TransportReadiness, unwrap } from './transport.mjs';

const readiness = getT3TransportReadiness();
const executable = process.env.T3_ACP_MCP_NODE || 't3';
const entrypoint = process.env.T3_ACP_MCP_ENTRYPOINT;
const child = spawnSync(executable,[...(entrypoint ? [entrypoint] : []),
  'acp-mcp-call','preview_status','{}'],{
  env:{...process.env,...(executable === process.env.T3_ACP_MCP_NODE ? {ELECTRON_RUN_AS_NODE:'1'} : {})},
  stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:20_000,maxBuffer:262144,
});
let outcome = 'host_operation_failed', browserAvailable = null;
const missingCapability = 'acp-mcp-call requires T3_ACP_MCP_ENDPOINT and T3_ACP_MCP_AUTHORIZATION.';
if (child.error) outcome = 'host_transport_unavailable';
else if (!readiness.configured && child.status === 2 &&
    `${child.stdout ?? ''}\n${child.stderr ?? ''}`.includes(missingCapability)) {
  outcome = 'blocked_external_dependency';
} else if (child.status === 0 && readiness.configured) {
  try {
    const status = unwrap(JSON.parse(child.stdout));
    if (typeof status?.available === 'boolean') {
      outcome = 'transport_reachable';
      browserAvailable = status.available;
    }
  } catch { /* Keep a fixed error code; never print host output. */ }
}
console.log(JSON.stringify({case:'T01',...readiness,outcome,
  cliExitCode:child.status,browserAvailable}));
process.exitCode = outcome === 'transport_reachable' ? 0 : 2;
