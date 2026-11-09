import { createInterface } from 'node:readline/promises';
import { constants, accessSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { agent, openBroker, type Account } from './broker.ts';
import { createExecutor } from './browser.ts';
import { serveLauncher } from './launcher.ts';
import { startFixture } from './fixture.ts';
import { openVault, randomSecret, vaultImage } from './vault.ts';
import { isolationProof, runWorker, workerImage } from './worker.ts';

const requireCheck = (valid: unknown, message: string) => {
  if (!valid) throw new Error(message);
};
const chrome = process.env.PILOT_CHROME_FOR_TESTING ?? join(homedir(), '.agent-browser', 'browsers',
  'chrome-152.0.7977.42', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
const mode = Bun.argv[2] ?? 'demo';
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Mac arm64 pilot only');
if (!['probe', 'demo', 'console', 'launcher'].includes(mode)) throw new Error('Use probe, demo, console or launcher');
process.umask(0o077);
const root = mkdtempSync(join(tmpdir(), 'vault-pilot-'));
const secretValues: string[] = [];
const protect = (value: string) => secretValues.push(value);
function inspect(value: unknown) {
  const serialized = JSON.stringify(value);
  if (secretValues.some(secret => serialized?.includes(secret))) throw new Error('fixture secret in recorded data');
}
const report = (value: unknown) => { inspect(value); console.log(JSON.stringify(value, null, 2)); };

let fixture: ReturnType<typeof startFixture> | undefined;
let vault: Awaited<ReturnType<typeof openVault>> | undefined;
let executor: ReturnType<typeof createExecutor> | undefined;
let broker: ReturnType<typeof openBroker> | undefined;
let terminal: ReturnType<typeof createInterface> | undefined;
let cleanupPromise: Promise<void> | undefined;
function cleanup() {
  return cleanupPromise ??= (async () => {
    terminal?.close();
    try {
      await executor?.close();
    } finally {
      try {
        fixture?.stop();
        broker?.close();
        await vault?.close();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  })();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
});

async function main() {
  if (mode === 'launcher') {
    fixture = startFixture({ sessionTtlMs: 30 * 60_000 });
    vault = await openVault(root, protect);
    await serveLauncher(fixture, vault, protect);
    return;
  }
  const isolation = await isolationProof(join(root, 'trusted-canary'));
  if (mode === 'probe') return report({ workerImage, isolation });
  console.error('Karen isolation verified. Starting disposable Vaultwarden.');
  if (basename(chrome) !== 'Google Chrome for Testing') throw new Error('Use the isolated Chrome for Testing executable');
  accessSync(chrome, constants.X_OK);
  fixture = startFixture();
  vault = await openVault(root, protect);
  const accounts: Account[] = [];
  for (const [label, identity] of [['Account A', 'karen@fixture.invalid'], ['Account B', 'unassigned@fixture.invalid']]) {
    const password = randomSecret();
    protect(password);
    fixture.setAccount(identity, password);
    const item = await vault.save(label!, identity!, password, fixture.origin);
    const reread = await vault.get(item.id);
    requireCheck(reread.id === item.id && reread.login.username === identity && reread.login.password === password, 'Vaultwarden cipher readback failed');
    accounts.push({ id: item.id, label: label!, identity: identity!, origin: fixture.origin });
  }
  console.error('Both encrypted fixture items saved and read back.');
  const [a, b] = accounts as [Account, Account];
  executor = createExecutor(root, chrome, fixture.origin, id => vault!.get(id), inspect);
  const db = join(root, 'policy.sqlite');
  let afterIdentity: (() => void) | undefined;
  const open = () => openBroker(db, accounts, (account, recheck) => executor!.run(account, recheck, afterIdentity));
  broker = open();
  const worker = async (...args: string[]) => {
    const responses = await runWorker(args, message => broker!.handle(message));
    inspect(responses);
    return responses as { status: string; accounts?: { id: string }[]; proof?: { records: number } }[];
  };
  if (mode === 'console') {
    const select = (alias: string | undefined) => ({ a, b })[alias as 'a' | 'b'];
    terminal = createInterface({ input: process.stdin, output: process.stdout });
    terminal.on('close', () => { terminal = undefined; });
    console.log('Vault pilot owner console. Karen starts with no access.');
    console.log('Commands: show, grant a|b, run a|b, revoke a|b, list, audit, exit');
    const prompt = () => { if (process.stdin.isTTY) process.stdout.write('vault> '); };
    prompt();
    for await (const line of terminal) {
      const [command, alias] = line.trim().split(/\s+/);
      const account = select(alias);
      if (command === 'exit') break;
      if (command === 'show') report({ agent, accounts: broker.ownerAccounts() });
      else if (command === 'audit') report(broker.audit());
      else if (command === 'list') report(await worker('list'));
      else if (command === 'grant' && account) report(broker.grant(account.id));
      else if (command === 'revoke' && account) report(broker.revoke(account.id));
      else if (command === 'run' && account) report(await worker('read', account.id));
      else console.log('Use show, grant a|b, run a|b, revoke a|b, list, audit or exit.');
      prompt();
    }
    return;
  }

  const empty = await worker('list');
  requireCheck(empty[0]?.accounts?.length === 0, 'new worker discovered an account before grant');
  broker.grant(a.id);
  const initial = await worker('exercise', a.id, b.id);
  requireCheck(initial.length === 9 &&
    initial[0]?.accounts?.length === 1 && initial[0]?.accounts[0]?.id === a.id &&
    initial.slice(1, 8).every(row => row.status === 'denied') &&
    initial[8]?.status === 'ok' && initial[8]?.proof?.records === 2,
    'initial browser or adversarial grant checks failed');
  console.error('Granted login and seven denied request paths verified. Testing restart and revocation.');
  broker.close();
  broker = open();
  const restarted = await worker('read', a.id);
  requireCheck(restarted[0]?.status === 'ok' && restarted[0]?.proof?.records === 2, 'restart check failed');
  const readsBefore = fixture.reads();
  afterIdentity = () => { broker!.revoke(a.id); };
  const inFlight = await worker('read', a.id);
  afterIdentity = undefined;
  requireCheck(inFlight[0]?.status === 'denied' && readsBefore === fixture.reads(), 'revocation allowed an in-flight read');
  const existingIdentity = await executor.existingIdentity();
  requireCheck(existingIdentity === a.identity, 'revocation session-survival check failed');
  broker.close();
  broker = open();
  const after = await worker('read', a.id);
  const afterList = await worker('list');
  requireCheck(after[0]?.status === 'denied' && afterList[0]?.accounts?.length === 0, 'reopened grant remained effective');
  const ownerItemsRemain = (await vault.get(a.id)).id === a.id && (await vault.get(b.id)).id === b.id;
  requireCheck(ownerItemsRemain, 'revocation removed a vault item');
  const audit = broker.audit();
  inspect(audit);
  const proof = {
    environment: { host: 'macOS arm64', worker: 'Linux arm64 in local Colima VM', workerImage, vaultImage,
      bun: Bun.version, executor: 'BetterWright 2.9.1' },
    isolation, accounts: { granted: a.id, unassigned: b.id, ownerItemsRemain },
    initial, restarted, inFlight, existingIdentity, after, afterList, audit,
    credentialScan: 'No generated passwords or CLI session key in the captured browser responses, worker results, audit, or this receipt.',
  };
  report(proof);
}
try { await main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : 'pilot failed');
  process.exitCode = 1;
} finally { await cleanup(); }
