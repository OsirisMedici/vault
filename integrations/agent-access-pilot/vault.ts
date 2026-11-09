import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PureCrypto } from '@bitwarden/sdk-internal/node/bitwarden_wasm_internal.js';

export const randomSecret = () => randomBytes(32).toString('base64url');
export const vaultImage = 'vaultwarden/server:1.37.4@sha256:efb3cde962015fcc036b2ea625242248611943b27212ebf4392841fb30fad055';
const ownerEmail = 'owner@fixture.invalid';
const docker = Bun.which('docker');
const bw = Bun.which('bw');
const runtimeEnv = { HOME: process.env.HOME, PATH: process.env.PATH };

async function command(argv: string[], env: Record<string, string | undefined>, stdin?: string) {
  const child = Bun.spawn(argv, {
    env, stdout: 'pipe', stderr: 'ignore', stdin: stdin === undefined ? 'ignore' : 'pipe',
    timeout: 25_000, killSignal: 'SIGKILL',
  });
  if (stdin !== undefined) {
    child.stdin.write(stdin);
    child.stdin.end();
  }
  const [out, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
  if (code !== 0) throw new Error(`${argv[0].split('/').at(-1)} ${argv[1]} ${argv[2] ?? ''}: exit ${code}`);
  return out.trim();
}
const dockerCmd = (args: string[]) => command([docker!, ...args], { ...runtimeEnv, DOCKER_CONTEXT: 'colima' });

async function register(origin: string, master: string) {
  const response = await fetch(origin + '/identity/accounts/register/send-verification-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: ownerEmail, name: 'Fixture owner' }),
  });
  if (!response.ok) throw new Error(`Vaultwarden registration token: HTTP ${response.status}`);
  const token: unknown = await response.json();
  if (typeof token !== 'string') throw new Error('invalid registration token response');
  // Vaultwarden 1.37.4 accepts the legacy userAsymmetricKeys shape. The newer
  // SDK register endpoint posts accountKeys instead, leaving this release
  // without the private key the CLI expects. Use the pinned SDK's existing
  // crypto helpers and translate the registration wire shape only.
  const iterations = 600_000;
  const kdf = { pBKDF2: { iterations } } as Parameters<typeof PureCrypto.derive_kdf_material>[2];
  const masterKey = PureCrypto.derive_kdf_material(Buffer.from(master), Buffer.from(ownerEmail), kdf);
  const userKey = PureCrypto.make_user_key_aes256_cbc_hmac();
  const privateKey = PureCrypto.rsa_generate_keypair();
  try {
    // Bitwarden's ServerAuthorization HashPurpose is one PBKDF2-SHA256 round.
    const hash = pbkdf2Sync(masterKey, master, 1, 32, 'sha256').toString('base64');
    const key = PureCrypto.encrypt_user_key_with_master_password(userKey, master, ownerEmail, kdf);
    const data = {
      email: ownerEmail, emailVerificationToken: token,
      kdf: 0, kdfIterations: iterations, masterPasswordHash: hash, key,
      keys: {
        publicKey: Buffer.from(PureCrypto.rsa_extract_public_key(privateKey)).toString('base64'),
        encryptedPrivateKey: PureCrypto.symmetric_encrypt_bytes(privateKey, userKey),
      },
    };
    const finish = await fetch(origin + '/identity/accounts/register/finish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    if (!finish.ok) throw new Error(`Vaultwarden registration finish: HTTP ${finish.status}`);
  } finally {
    masterKey.fill(0);
    userKey.fill(0);
    privateKey.fill(0);
  }
}

export interface LoginItem {
  id: string;
  name: string;
  login: { username: string; password: string; uris: { uri: string; match: number }[] };
}

export async function openVault(root: string, protect: (value: string) => void) {
  if (!docker || !bw) throw new Error('Docker and Bitwarden CLI required');
  const name = 'vault-pilot-store-' + randomUUID();
  const appdata = join(root, 'bw-appdata');
  mkdirSync(appdata, { mode: 0o700 });
  const cert = join(root, 'vault-loopback.pem');
  const key = join(root, 'vault-loopback.key');
  const config = join(root, 'openssl.cnf');
  writeFileSync(config, [
    '[req]', 'distinguished_name=dn', 'x509_extensions=ext', 'prompt=no',
    '[dn]', 'CN=Vault disposable fixture', '[ext]',
    'subjectAltName=IP:127.0.0.1', 'basicConstraints=critical,CA:TRUE',
    'keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign',
  ].join('\n'));
  const openssl = Bun.which('openssl');
  if (!openssl) throw new Error('OpenSSL required for the fixture TLS certificate');
  await command([openssl, 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-config', config, '-keyout', key, '-out', cert], runtimeEnv);
  const env = { ...runtimeEnv, BITWARDENCLI_APPDATA_DIR: appdata, NO_COLOR: '1', NODE_EXTRA_CA_CERTS: cert };
  let session = '';
  const cli = (args: string[], stdin?: string, extra = {}) => command([bw, ...args], {
    ...env, ...(session ? { BW_SESSION: session } : {}), ...extra,
  }, stdin);
  let proxy: ReturnType<typeof Bun.serve> | undefined;
  const close = async () => {
    session = '';
    proxy?.stop(true);
    await dockerCmd(['stop', '--time', '2', name]).catch(() => {});
  };
  try {
    await dockerCmd(['run', '--detach', '--rm', '--pull=never', '--name', name, '--memory=384m',
      '--pids-limit=128', '--security-opt=no-new-privileges', '--log-driver=none',
      '--publish=127.0.0.1::80', '--tmpfs=/data:rw,nosuid,nodev,size=96m',
      '--env=SIGNUPS_ALLOWED=true', '--env=SIGNUPS_DOMAINS_WHITELIST=fixture.invalid',
      '--env=INVITATIONS_ALLOWED=false', '--env=PUSH_ENABLED=false',
      '--env=WEB_VAULT_ENABLED=false', vaultImage]);
    const published = await dockerCmd(['port', name, '80/tcp']);
    if (!/^127\.0\.0\.1:\d+$/.test(published)) throw new Error('expected loopback-only Vaultwarden');
    const origin = 'http://' + published;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const probe = await fetch(origin + '/alive', { signal: AbortSignal.timeout(700) }).catch(() => null);
      if (probe?.ok) { ready = true; break; }
      await Bun.sleep(200);
    }
    if (!ready) throw new Error('Vaultwarden did not become ready');
    const master = randomSecret();
    protect(master);
    await register(origin, master);
    proxy = Bun.serve({
      hostname: '127.0.0.1', port: 0, tls: { cert: Bun.file(cert), key: Bun.file(key) },
      fetch(req) {
        const url = new URL(req.url);
        if (!url.pathname.startsWith('/identity/') && !url.pathname.startsWith('/api/'))
          return new Response(null, { status: 404 });
        return fetch(origin + url.pathname + url.search, {
          method: req.method, headers: req.headers, body: req.body, redirect: 'error',
        }).catch(() => new Response(null, { status: 502 }));
      },
    });
    const cliOrigin = proxy.url.origin;
    await cli(['config', 'server', cliOrigin]);
    session = await cli(['login', ownerEmail, '--passwordenv', 'VAULT_FIXTURE_MASTER', '--raw'],
      undefined, { VAULT_FIXTURE_MASTER: master });
    if (session.length < 32) throw new Error('missing fixture vault session');
    protect(session);
    const status = JSON.parse(await cli(['status']));
    if (status.status !== 'unlocked' || status.serverUrl?.replace(/\/$/, '') !== cliOrigin || status.userEmail !== ownerEmail)
      throw new Error('wrong Bitwarden session');
    return {
      origin,
      async save(name: string, username: string, password: string, origin: string): Promise<LoginItem> {
        const input = { type: 1, name, login: { username, password, uris: [{ uri: origin, match: 0 }] } };
        return JSON.parse(await cli(['create', 'item'], Buffer.from(JSON.stringify(input)).toString('base64')));
      },
      async get(id: string): Promise<LoginItem> {
        return JSON.parse(await cli(['get', 'item', id]));
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
