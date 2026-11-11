#!/usr/bin/env bun
// Compatibility entrypoint. All build paths now use the audited Bun wrapper.
import { fileURLToPath } from 'node:url';
const child = Bun.spawn([process.execPath, fileURLToPath(new URL('./build-agent-web-bun.mjs', import.meta.url)),
  ...process.argv.slice(2)], { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' });
process.exitCode = await child.exited;
