// Compiler-only compatibility exception. Invoke through the Bun build runner.
import { buildWeb } from './build-agent-web-bun.mjs';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
const candidate = resolve(process.argv[2] || '.');
const cache = resolve(import.meta.dirname, '../.cache');
const within = relative(cache, candidate);
if (!within || within.startsWith('..') || within.startsWith('/')) throw new Error('Candidate must be inside this checkout cache');
try {
  if (process.argv.length !== 3 || !process.env.CACHE_TAG?.startsWith('vault-agent-') ||
      process.env.ENV !== 'selfhosted' || process.env.NODE_ENV !== 'production') throw new Error('Use the Bun build runner');
  rmSync(join(candidate, 'vault-password-build-result.json'), { force: true });
  await buildWeb(process.argv[2]);
  writeFileSync(join(candidate, 'vault-password-build-result.json'), JSON.stringify({ success: true, compiler: process.versions.node, cacheTag: process.env.CACHE_TAG }) + '\n');
} catch (error) {
  console.error(`Vault Angular compiler stopped: ${error.message}`);
  process.exitCode = 1;
}
