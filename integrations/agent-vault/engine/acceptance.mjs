// Exactly C01 and C02. Uses a preview binary with the verified path-isolation override.
// Never supply a live runtime directory, capability or listener to this runner.
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, chmod, writeFile, rm, realpath, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createEngineClient, credentialRefForSourceId } from './client.mjs';
import { createTransport } from './http.mjs';
import { provisionVault } from './provision.mjs';

let child;
let temporary;
let currentCase = 'C01';
const check = value => { if (!value) throw 0; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child?.kill('SIGKILL'), 8000);
  try { await exited; } finally { clearTimeout(timer); child = undefined; }
}

try {
  check(process.argv.length === 3);
  const binary = await realpath(process.argv[2]);
  const binarySha256 = createHash('sha256').update(await readFile(binary)).digest('hex');
  temporary = await mkdtemp(path.join(await realpath(os.tmpdir()), 'vault-engine-c01-c02-'));
  await chmod(temporary, 0o700);
  const allocator = createServer();
  allocator.listen(0, '127.0.0.1');
  await once(allocator, 'listening');
  const port = allocator.address().port;
  check(![18431, 18432].includes(port));
  await new Promise(resolve => allocator.close(resolve));
  const address = `http://127.0.0.1:${port}`;
  const ownerFile = path.join(temporary, 'member-token');
  const proxyFile = path.join(temporary, 'proxy-token');
  const config = { address, vaultName: 'dummy-engine-c01-c02', tokenFile: ownerFile };
  const masterPassword = randomBytes(32).toString('base64url');
  async function start() {
    // Deliberately do not inherit database, provider, trial or SMTP environment.
    child = spawn(binary, ['server', '--host', '127.0.0.1', '--port', String(port),
      '--mitm-port', '0', '--password-stdin'], {
      cwd: temporary, stdio: ['pipe', 'ignore', 'ignore'],
      env: { PATH: process.env.PATH, AGENT_VAULT_EVAL_HOME: temporary, AGENT_VAULT_TELEMETRY: 'false' },
    });
    child.on('error', () => {});
    child.stdin.on('error', () => {});
    child.stdin.end(`${masterPassword}\n`);
    const request = createTransport(config);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null) throw 0;
      try {
        if ((await request('/health', { authenticated: false })).status === 'ok') return;
      } catch { /* startup only; no raw error leaves this runner */ }
      await pause(100);
    }
    throw 0;
  }
  await start();
  const request = createTransport(config);
  const registration = await request('/v1/auth/register', { method: 'POST', authenticated: false,
    body: { email: 'owner@example.invalid', password: randomBytes(32).toString('base64url') } });
  check(registration.authenticated === true && typeof registration.token === 'string');
  await writeFile(ownerFile, `${registration.token}\n`, { mode: 0o600, flag: 'wx' });
  await provisionVault(config, proxyFile);
  const engine = createEngineClient(config);
  check((await engine.health()).state === 'ready');
  const credentialRef = credentialRefForSourceId('00112233-4455-6677-8899-aabbccddeeff');
  const login = { username: 'dummy@example.invalid', password: randomBytes(32).toString('base64url') };
  check((await engine.putLogin({ credentialRef, ...login })).state === 'ready');
  await stop();
  await start();
  check((await engine.health()).state === 'ready');
  check(await engine.withLogin(credentialRef, value => value.username === login.username && value.password === login.password));
  console.log(JSON.stringify({ case: 'C01', state: 'passed', restartPersistence: true, binarySha256 }));
  currentCase = 'C02';
  const proxy = createEngineClient({ ...config, tokenFile: proxyFile });
  let invoked = false;
  let denied = false;
  try { await proxy.withLogin(credentialRef, () => { invoked = true; }); }
  catch (error) { denied = error?.reasonCode === 'capability_denied'; }
  check(denied && !invoked && (await proxy.health()).state === 'engine_unavailable');
  console.log(JSON.stringify({ case: 'C02', state: 'passed', revealDenied: true, callbackInvoked: false }));
} catch {
  console.log(JSON.stringify({ case: currentCase, state: 'failed', reasonCode: 'dummy_acceptance_incomplete' }));
  process.exitCode = 1;
} finally {
  await stop();
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
