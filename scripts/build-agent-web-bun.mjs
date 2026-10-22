#!/usr/bin/env bun
// Owned Bun-only runner for the pinned reduced OSS web export. No webpack-cli.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const tools = join(root, 'tooling/agent-web');
const pin = JSON.parse(readFileSync(join(tools, 'pin.json'), 'utf8'));
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const fileSha = path => sha(readFileSync(path));
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function within(parent, child) {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel);
}
function runtime() {
  assert(process.versions.bun === pin.bunVersion, `Run with Bun ${pin.bunVersion}; no Node/npm fallback is supported`);
}
function regular(path) {
  const stat = lstatSync(path);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, `Expected an unlinked regular file: ${path}`);
}
function safeTree(directory, candidate) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    assert(entry.name !== '.git', 'Candidate must not contain a Git checkout');
    if (entry.isSymbolicLink()) assert(within(candidate, realpathSync(path)), `Symlink escapes candidate: ${path}`);
    else if (entry.isDirectory()) safeTree(path, candidate);
    else if (entry.isFile()) assert(lstatSync(path).nlink === 1, `Hardlinked candidate file: ${path}`);
    else throw new Error(`Unsupported candidate file: ${path}`);
  }
}
export function verifyCandidate(input, installed = false) {
  runtime();
  const candidate = resolve(input);
  assert(within(join(root, '.cache'), candidate), 'Candidate must be below this worktree .cache');
  let parent = candidate;
  while (parent !== root) {
    assert(!lstatSync(parent).isSymbolicLink(), `Candidate path contains a symlink: ${parent}`);
    parent = dirname(parent);
  }
  assert(candidate === realpathSync(candidate), 'Candidate path must resolve inside this worktree');
  safeTree(candidate, candidate);
  regular(join(candidate, 'vault-agent-web-tooling.json'));
  const receipt = json(join(candidate, 'vault-agent-web-tooling.json'));
  assert(receipt.toolingVersion === 1 && receipt.sourceCommit === pin.sourceCommit &&
    receipt.bunVersion === pin.bunVersion && receipt.toolingPinSha256 === fileSha(join(tools, 'pin.json')),
  'Missing or stale tooling receipt; prepare a fresh candidate');
  assert(json(join(root, 'upstream.lock.json')).web.commit === pin.sourceCommit, 'Upstream pin changed; review toolchain');
  for (const name of ['package.json', 'package-lock.json', 'vault-agent-web-upstream-package.json',
    'vault-agent-web-upstream-package-lock.json', 'bun.lock', 'bunfig.toml']) {
    regular(join(candidate, name));
    assert(fileSha(join(candidate, name)) === receipt.toolingSha256[name], `Candidate tooling drift: ${name}`);
  }
  assert(fileSha(join(candidate, 'bun.lock')) === pin.bunLockSha256 && fileSha(join(tools, 'bun.lock')) === pin.bunLockSha256,
    'Bun lock drift; do not regenerate or fall back');
  assert(fileSha(join(candidate, 'vault-agent-web-upstream-package.json')) === pin.sourceSha256['package.json'] &&
    fileSha(join(candidate, 'vault-agent-web-upstream-package-lock.json')) === pin.sourceSha256['package-lock.json'],
  'Original upstream manifests changed');
  assert(fileSha(join(candidate, 'apps/web/webpack.base.js')) === pin.sourceSha256['apps/web/webpack.base.js'],
    'Webpack config changed; use a fresh prepared candidate');
  const pkg = json(join(candidate, 'package.json'));
  const lock = json(join(candidate, 'package-lock.json'));
  const originalPkg = json(join(candidate, 'vault-agent-web-upstream-package.json'));
  const originalLock = json(join(candidate, 'vault-agent-web-upstream-package-lock.json'));
  const expectedPkg = structuredClone(originalPkg);
  const expectedLock = structuredClone(originalLock);
  const absent = 'apps/desktop/desktop_native/napi';
  for (const item of [expectedPkg, expectedLock.packages['']]) {
    item.workspaces = item.workspaces.filter(x => x !== absent);
    delete item.dependencies['@bitwarden/desktop-napi'];
  }
  expectedPkg.packageManager = `bun@${pin.bunVersion}`;
  delete expectedLock.packages[absent];
  delete expectedLock.packages['node_modules/@bitwarden/desktop-napi'];
  assert(equal(pkg, expectedPkg) && equal(lock, expectedLock), 'Unexpected dependency edits beyond absent desktop references');
  const bunLock = Bun.JSON5.parse(readFileSync(join(candidate, 'bun.lock'), 'utf8'));
  const rootDependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const normalizeOverride = value => {
    if (typeof value === 'string' && value.startsWith('$')) return rootDependencies[value.slice(1)];
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeOverride(item)]));
    return value;
  };
  assert(equal(bunLock.workspaces[''].dependencies, pkg.dependencies) &&
    equal(bunLock.workspaces[''].devDependencies, pkg.devDependencies) && equal(bunLock.overrides, normalizeOverride(pkg.overrides)),
  'Bun root dependencies/overrides differ from upstream');
  const upstream = new Set(Object.entries(originalLock.packages).filter(([, v]) => v.integrity).map(([k, v]) =>
    `${v.name || k.split('node_modules/').at(-1)}@${v.version}|${v.integrity}`));
  const retained = new Set();
  for (const record of Object.values(bunLock.packages)) {
    if (record[0].includes('@workspace:')) continue;
    assert(record[3] && upstream.has(`${record[0]}|${record[3]}`), `Bun package version/integrity differs from upstream: ${record[0]}`);
    retained.add(`${record[0]}|${record[3]}`);
  }
  const omitted = [...upstream].filter(item => !retained.has(item)).sort();
  assert(retained.size === pin.retainedRegistryRecords && omitted.length === pin.omittedRegistryRecords &&
    sha(JSON.stringify(omitted)) === pin.omittedRegistrySha256, 'Converted dependency inventory changed');
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    assert(bunLock.packages[name]?.[0] === `${name}@${version}`, `Root resolution drift: ${name}`);
    if (installed) {
      const packagePath = join(candidate, 'node_modules', name, 'package.json');
      assert(within(candidate, realpathSync(packagePath)), `Installed package escapes candidate: ${name}`);
      assert(json(packagePath).version === version, `Installed version drift: ${name}; prepare a fresh candidate`);
    }
  }
  for (const [name, version] of Object.entries(pin.criticalVersions)) {
    assert(bunLock.packages[name]?.[0] === `${name}@${version}`, `Critical version drift: ${name}`);
  }
  assert(json(join(candidate, 'apps/web/package.json')).version === pin.webVersion, 'Web app version drift');
  return { candidate, receipt, retained: retained.size, omitted: omitted.length };
}

// Shared by the one focused regression case. Always close the compiler, including failures.
export async function runCompiler(webpack, config) {
  const compiler = webpack(config);
  return await new Promise((resolveBuild, rejectBuild) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error || closeError) return rejectBuild(error || closeError);
        if (!stats || stats.hasErrors()) return rejectBuild(new Error(stats?.toString({ all: false, errors: true, errorDetails: true }) || 'No compiler stats'));
        resolveBuild(stats);
      });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0]?.startsWith('--') ? args.shift() : '--build';
  assert(['--build', '--check-lock', '--lock-check', '--install-only'].includes(mode) && args.length === 1,
    'Usage: bun scripts/build-agent-web-bun.mjs [--check-lock|--lock-check|--install-only] .cache/<candidate>');
  let verified = verifyCandidate(args[0]);
  if (mode === '--check-lock') {
    console.log(`Static lock verified: ${verified.retained} retained registry records match upstream; ${verified.omitted} audited omissions`);
    return;
  }
  const installArgs = ['install', '--frozen-lockfile', '--ignore-scripts', '--prefer-offline', '--network-concurrency=8'];
  if (mode === '--lock-check') installArgs.push('--lockfile-only');
  const result = Bun.spawnSync([process.execPath, ...installArgs], {
    cwd: verified.candidate, env: { ...process.env, NODE_ENV: 'development' }, stdout: 'inherit', stderr: 'inherit',
  });
  assert(result.exitCode === 0, 'Frozen Bun install failed. Correct the reported cause; no lock update or fallback was attempted');
  verified = verifyCandidate(args[0], mode !== '--lock-check');
  if (mode !== '--build') {
    console.log(mode === '--lock-check' ? 'Frozen Bun lock check passed without drift' : 'Frozen Bun install and installed root versions verified');
    return;
  }
  process.env.ENV = 'selfhosted';
  process.env.NODE_ENV = 'production';
  process.env.LOGGING = 'false';
  process.env.CACHE_TAG = `vault-agent-${sha(JSON.stringify(verified.receipt)).slice(0, 16)}`;
  process.chdir(join(verified.candidate, 'apps/web'));
  const require = createRequire(join(verified.candidate, 'package.json'));
  const webpackPath = require.resolve('webpack');
  assert(within(join(verified.candidate, 'node_modules'), realpathSync(webpackPath)), 'Webpack must resolve from candidate node_modules');
  const webpack = require(webpackPath);
  const config = require(join(verified.candidate, 'apps/web/webpack.config.js'))();
  const minimizers = config.optimization?.minimizer;
  assert(minimizers?.length === 1 && minimizers[0]?.constructor.name === 'TerserPlugin', 'Unexpected minifier; review resource settings');
  minimizers[0].options.parallel = 1;
  // The full production source-map/minification graph exceeds this 8 GiB Mac.
  // Release maps are optional debug artifacts; keep production optimization.
  config.devtool = false;
  let previousStage = '';
  let previousLog = 0;
  config.plugins.push(new webpack.ProgressPlugin((fraction, stage, detail) => {
    if (stage !== previousStage || Date.now() - previousLog >= 15000) {
      previousStage = stage;
      previousLog = Date.now();
      console.log(`Web build ${Math.floor(fraction * 100)}%: ${stage}${detail ? ' / ' + detail : ''}`);
    }
  }));
  assert(within(verified.candidate, config.output.path), 'Webpack output must remain inside the candidate');
  console.log(`Building OSS web ${pin.webVersion} with Bun ${pin.bunVersion} and Webpack ${pin.criticalVersions.webpack} compiler API`);
  const stats = await runCompiler(webpack, config);
  console.log(stats.toString({ all: false, timings: true, assets: true, warnings: true }));
}

if (import.meta.main) {
  try { await main(); }
  catch (error) { console.error(`Vault web build stopped: ${error.message}`); process.exitCode = 1; }
}
