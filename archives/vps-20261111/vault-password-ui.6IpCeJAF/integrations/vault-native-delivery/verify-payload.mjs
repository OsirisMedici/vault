// Inspect only source and generated application code. No runtime or user data.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const [source, app, reference] = process.argv.slice(2);
const require = createRequire(join(source, 'scripts/package.json'));
const { extractFile, listPackage } = require('@electron/asar');
const archive = join(app, 'Contents/Resources/app.asar');
const pkg = JSON.parse(extractFile(archive, 'package.json').toString());
if (pkg.version !== '0.1.2-nightly.20261022.3512' ||
    pkg.t3codeCommitHash !== '3b95e7831b11') {
  throw new Error('Embedded base or version mismatch');
}
const checked = {};
const mainPath = 'apps/desktop/dist-electron/main.cjs';
const main = await readFile(join(source, mainPath));
if (!extractFile(archive, mainPath).equals(main)) throw new Error('Packaged main differs from verified build');
// Release packaging strips maps. Bind the local map to the byte-identical main
// bundle before comparing its embedded sources with the reviewed source files.
const map = JSON.parse(await readFile(join(source, mainPath + '.map'), 'utf8'));
for (const name of ['PrivateVaultLogin', 'VaultCli', 'VaultDeviceUnlock', 'VaultConnection',
  'VaultMcpBridge', 'VaultLoginPolicy', 'VaultProviderIdentity', 'DesktopBrowserHost', 'CdpRelay']) {
  const path = `apps/desktop/src/preview/${name}.ts`;
  const matches = map.sources.flatMap((entry, index) => entry.endsWith(`/src/preview/${name}.ts`) ? [index] : []);
  const content = await readFile(join(source, path), 'utf8');
  if (matches.length !== 1 || map.sourcesContent[matches[0]] !== content) {
    throw new Error(`Packaged source map does not match ${path}`);
  }
  checked[path] = createHash('sha256').update(content).digest('hex');
}
const preload = 'apps/desktop/dist-electron/vault-login-preload.cjs';
if (!listPackage(archive).includes('/' + preload)) throw new Error('Private preload missing');
if (!extractFile(archive, preload).equals(await readFile(join(source, preload)))) {
  throw new Error('Packaged private preload differs from build');
}
const { getCurrentFuseWire } = require(join(source, 'node_modules/.pnpm/@electron+fuses@1.8.0/node_modules/@electron/fuses'));
const fuses = await getCurrentFuseWire(app);
const referenceFuses = await getCurrentFuseWire(reference);
if (JSON.stringify(fuses) !== JSON.stringify(referenceFuses)) {
  throw new Error('Electron fuse settings differ from installed app');
}
console.log(JSON.stringify({ base: pkg.t3codeCommitHash, version: pkg.version,
  mainSha256: createHash('sha256').update(main).digest('hex'),
  sourceMatches: checked, privatePreloadPresent: true, fusesMatchInstalled: true, fuses }, null, 2));
