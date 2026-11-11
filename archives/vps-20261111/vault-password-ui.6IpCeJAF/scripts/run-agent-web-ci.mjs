#!/usr/bin/env bun
// Source-only checks by default; production is an explicit, heavyweight operation.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileSha256, verifyPackaged } from '../tooling/agent-web/ci.mjs';

const root = resolve(import.meta.dir, '..');
const pin = JSON.parse(readFileSync(join(root, 'tooling/agent-web/pin.json'), 'utf8'));
function assert(ok, message) { if (!ok) throw new Error(message); }
function command(args, capture = false) {
  const result = Bun.spawnSync(args, { cwd: root, stdout: capture ? 'pipe' : 'inherit', stderr: 'inherit' });
  assert(result.exitCode === 0, `CI stage failed: ${args[0]} ${args[1] || ''}; no fallback attempted`);
  return capture ? new TextDecoder().decode(result.stdout).trim() : '';
}

function hygiene() {
  assert(fileSha256(join(root, 'tooling/agent-web/bun.lock')) === pin.bunLockSha256, 'Frozen Bun lock drift');
  assert(JSON.parse(readFileSync(join(root, 'upstream.lock.json'), 'utf8')).web.commit === pin.sourceCommit, 'Upstream pin drift');
  const files = command(['git', 'ls-files', '-z', 'scripts/*agent-web*', 'tooling/agent-web/'], true).split('\0').filter(Boolean);
  // Include new files during local development as well as tracked files in CI.
  const untracked = command(['git', 'ls-files', '--others', '--exclude-standard', '-z', 'scripts/*agent-web*', 'tooling/agent-web/'], true).split('\0').filter(Boolean);
  const sources = [...new Set([...files, ...untracked])];
  const transpiler = new Bun.Transpiler({ loader: 'js', target: 'bun' });
  for (const file of sources.filter(file => file.endsWith('.mjs'))) transpiler.transformSync(readFileSync(join(root, file), 'utf8'));
  const python = sources.filter(file => file.endsWith('.py'));
  command(['python3', '-c', 'import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(),filename=p) for p in sys.argv[1:]]', ...python]);
  command(['git', 'diff', '--check']);
  command(['git', 'diff', '--cached', '--check']);
  command(['git', 'show', '--format=', '--check', 'HEAD']);
  for (const file of [...sources, '.github/workflows/vault-web.yml', 'docs/agent-vault-ci-v2.md']) {
    if (!existsSync(join(root, file))) continue;
    const content = readFileSync(join(root, file), 'utf8');
    assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) &&
      !/gh[pousr]_[A-Za-z0-9]{36,}/.test(content), `Credential marker in owned source: ${file}`);
  }
  console.log('Source hygiene passed: frozen pin/lock, JS syntax, Python AST, diff whitespace (no install/compiler)');
}

async function main() {
  assert(process.versions.bun === pin.bunVersion, `Use Bun ${pin.bunVersion}`);
  const mode = process.argv[2] || 'hygiene';
  assert(process.argv.length <= 3 && ['hygiene', 'production'].includes(mode), 'Usage: bun scripts/run-agent-web-ci.mjs [hygiene|production]');
  hygiene();
  if (mode === 'hygiene') return;
  assert(command(['git', 'status', '--porcelain', '--untracked-files=all'], true) === '', 'Production requires a clean source worktree');
  assert(command(['node', '--version'], true) === 'v26.12.0', 'Compiler-only Node 26.12.0 prerequisite missing');
  const revision = command(['git', 'rev-parse', 'HEAD'], true);
  assert(/^[a-f0-9]{40}$/.test(revision), 'Invalid source revision');
  const base = join(root, '.cache/agent-web-ci');
  assert(!existsSync(base), 'Use a fresh .cache/agent-web-ci output; retain failed output for diagnosis');
  const candidate = join(base, 'source');
  const release = join(base, 'web');
  command(['python3', 'scripts/prepare-agent-web-tooling.py', '--source', join(root, 'upstream/web'), '--output', candidate]);
  command([process.execPath, 'scripts/build-agent-web-bun.mjs', candidate]);
  const compiled = join(candidate, 'apps/web/build');
  command(['python3', 'scripts/prepare-agent-web-release.py', compiled, '--output', release]);
  const artifact = verifyPackaged(compiled, release);
  // Revalidate the immutable checkout and prepared source after all build stages.
  command(['python3', '-c', 'import importlib.util,pathlib,json; p=pathlib.Path("scripts/prepare-agent-web.py"); s=importlib.util.spec_from_file_location("prep",p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.verify_source(pathlib.Path("upstream/web").resolve(),json.loads(pathlib.Path("upstream.lock.json").read_text())["web"])']);
  command([process.execPath, 'scripts/build-agent-web-bun.mjs', '--check-lock', candidate]);
  assert(command(['git', 'status', '--porcelain', '--untracked-files=all'], true) === '', 'Build changed tracked source');
  const upstreamLicenses = Object.fromEntries(readdirSync(join(root, 'upstream/web')).filter(name =>
    /^(license|notice|copying)/i.test(name)).sort().map(name => [name, fileSha256(join(root, 'upstream/web', name))]));
  assert(Object.keys(upstreamLicenses).length > 0, 'Upstream root attribution missing');
  const receipt = {
    version: 1, sourceRevision: revision, upstreamCommit: pin.sourceCommit, webVersion: pin.webVersion,
    toolchain: { bun: pin.bunVersion, compilerNode: '26.12.0', python: command(['python3', '--version'], true), platform: process.platform, arch: process.arch },
    toolingPinSha256: fileSha256(join(root, 'tooling/agent-web/pin.json')),
    bunLockSha256: pin.bunLockSha256,
    preparationSha256: fileSha256(join(candidate, 'vault-agent-web-tooling.json')),
    sourcePreparation: JSON.parse(readFileSync(join(candidate, 'vault-agent-web-receipt.json'), 'utf8')),
    frozenInstall: true, lifecycleScripts: false, registryConcurrency: 8,
    compiled: true, packaged: true, compiledJavaScriptByteIdentical: true,
    deployed: false, renderedAcceptance: false, authenticatedAcceptance: false, upstreamLicenses, artifact,
  };
  const serialized = JSON.stringify(receipt, null, 2) + '\n';
  assert(Buffer.byteLength(serialized) <= 16384, 'Receipt exceeds 16 KiB limit');
  const receipts = join(base, 'receipts');
  mkdirSync(receipts);
  writeFileSync(join(receipts, 'build.json'), serialized, { flag: 'wx' });
  // Include the existing repository attribution alongside the packaged bundle.
  for (const name of ['LICENSE', 'NOTICE.md']) writeFileSync(join(receipts, name), readFileSync(join(root, name)), { flag: 'wx' });
  for (const name of Object.keys(upstreamLicenses)) writeFileSync(join(receipts, `upstream-${name}`), readFileSync(join(root, 'upstream/web', name)), { flag: 'wx' });
  console.log(serialized);
}

try { await main(); }
catch (error) { console.error(`Vault web CI stopped: ${error.message}`); process.exitCode = 1; }
