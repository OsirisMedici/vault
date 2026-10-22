#!/usr/bin/env bun
import { createRuntime } from '../browser/runtime.mjs';
try {
  const { credentials } = await createRuntime();
  const result = await credentials.status();
  console.log(JSON.stringify({ state: result.state,
    browserMode: 'chat-tool-relay',
    externalHostAvailable: !!(process.env.T3_ACP_MCP_ENDPOINT && process.env.T3_ACP_MCP_AUTHORIZATION) }));
} catch { console.log('{"state":"engine_unavailable"}'); process.exitCode = 1; }
