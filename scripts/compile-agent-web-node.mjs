// Compiler-only compatibility exception. Invoke through the Bun build runner.
import { buildWeb } from './build-agent-web-bun.mjs';
try {
  if (process.argv.length !== 3 || !process.env.CACHE_TAG?.startsWith('vault-agent-') ||
      process.env.ENV !== 'selfhosted' || process.env.NODE_ENV !== 'production') throw new Error('Use the Bun build runner');
  await buildWeb(process.argv[2]);
} catch (error) {
  console.error(`Vault Angular compiler stopped: ${error.message}`);
  process.exitCode = 1;
}
