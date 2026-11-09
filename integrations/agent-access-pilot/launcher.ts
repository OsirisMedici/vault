import { createInterface } from 'node:readline';
import { randomSecret, type openVault } from './vault.ts';
import type { startFixture } from './fixture.ts';

const catalog = [
  { id: 'design', name: 'Design Library', identity: 'design@fixture.invalid' },
  { id: 'notes', name: 'Project Notes', identity: 'notes@fixture.invalid' },
] as const;

type App = typeof catalog[number] & { cipherId: string };
type SessionStatus = 'signed-in' | 'expired' | 'wrong-account' | 'unavailable';
type Vault = Pick<Awaited<ReturnType<typeof openVault>>, 'save' | 'get'>;
type Fixture = Pick<ReturnType<typeof startFixture>, 'origin' | 'setAccount' | 'expireSession'>;

export async function createLauncherSessions(fixture: Fixture, vault: Vault,
  protect: (value: string) => void, automaticSignIn: boolean, fetchProvider = fetch) {
  const apps: App[] = [];
  const sessions = new Map<string, string>();
  const wrongAccounts = new Set<string>();
  for (const app of catalog) {
    const password = randomSecret();
    protect(password);
    fixture.setAccount(app.identity, password);
    const saved = await vault.save(app.name, app.identity, password, fixture.origin);
    apps.push({ ...app, cipherId: saved.id });
  }
  const request = (path: string, init: RequestInit = {}) => fetchProvider(fixture.origin + path, {
    redirect: 'error', signal: AbortSignal.timeout(10_000), ...init,
  });

  async function verify(app: App, cookie: string): Promise<SessionStatus> {
    const response = await request('/launcher-session', { headers: { Cookie: 'fixture_session=' + cookie } });
    if (response.status === 401) return 'expired';
    if (!response.ok) return 'unavailable';
    const result = await response.json() as { identity?: unknown; workspace?: unknown } | null;
    return result?.identity === app.identity && result.workspace === app.id ? 'signed-in' : 'wrong-account';
  }

  async function signIn(app: App) {
    const cipher = await vault.get(app.cipherId);
    if (cipher.id !== app.cipherId || cipher.login.username !== app.identity ||
      cipher.login.uris.length !== 1 || cipher.login.uris[0]?.uri !== fixture.origin ||
      cipher.login.uris[0]?.match !== 0) throw new Error('Unexpected fixture login');
    const response = await request('/login', {
      method: 'POST', redirect: 'manual', headers: { Origin: fixture.origin },
      body: new URLSearchParams({ username: cipher.login.username, password: cipher.login.password }),
    });
    const cookie = response.headers.get('set-cookie')?.match(/^fixture_session=([\w-]+); HttpOnly; SameSite=Strict; Path=\/$/)?.[1];
    if (response.status !== 303 || response.headers.get('location') !== '/identity' || !cookie)
      throw new Error('Fixture sign-in failed');
    protect(cookie);
    return cookie;
  }

  async function open(id: string, confirmedDemoSignIn = false) {
    const app = apps.find(entry => entry.id === id);
    if (!app) return { status: 'unavailable' };
    const signedIn = (cookie: string, source: 'existing' | 'automatic' | 'manual') => ({
      status: 'signed-in', id, identity: app.identity, url: fixture.origin + '/app', cookie, source,
    });
    try {
      if (wrongAccounts.has(id) && !confirmedDemoSignIn) return { status: 'wrong-account', id };
      const existing = sessions.get(id);
      if (existing && !confirmedDemoSignIn) {
        const status = await verify(app, existing);
        if (status === 'signed-in') return signedIn(existing, 'existing');
        if (status === 'wrong-account') wrongAccounts.add(id);
        if (status !== 'expired') return { status, id };
        sessions.delete(id);
      }
      if (!automaticSignIn && !confirmedDemoSignIn)
        return { status: 'manual-required', id, reason: existing ? 'expired' : 'signed-out' };
      const cookie = await signIn(app);
      const status = await verify(app, cookie);
      if (status === 'wrong-account') wrongAccounts.add(id);
      if (status !== 'signed-in') return { status, id };
      wrongAccounts.delete(id);
      sessions.set(id, cookie);
      return signedIn(cookie, confirmedDemoSignIn ? 'manual' : 'automatic');
    } catch {
      return { status: 'unavailable', id };
    }
  }

  async function prepare() {
    if (automaticSignIn) {
      for (const app of apps) await open(app.id);
    }
  }
  return {
    open,
    prepare,
    get automaticSignIn() { return automaticSignIn; },
    setPolicy(enabled: boolean) { automaticSignIn = enabled; },
    expireForVerification(id: string) {
      const cookie = sessions.get(id);
      return !!cookie && fixture.expireSession(cookie);
    },
  };
}

export async function serveLauncher(fixture: Fixture, vault: Vault, protect: (value: string) => void) {
  if (process.stdout.isTTY || process.env.VAULT_LAUNCHER_PIPE !== '1')
    throw new Error('Start the launcher through the Vault Launcher app');
  const sessions = await createLauncherSessions(fixture, vault, protect, process.env.VAULT_LAUNCHER_AUTO === '1');
  // Trusted owner-only IPC. Cookies are sent only on a verified open request.
  const send = (message: object) => Bun.write(Bun.stdout, JSON.stringify(message) + '\n');
  await sessions.prepare();
  await send({ status: 'ready', origin: fixture.origin, automaticSignIn: sessions.automaticSignIn });

  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (line.length > 1024) break;
    let req: { requestId?: number; command?: string; id?: string; enabled?: boolean } | null;
    try { req = JSON.parse(line); } catch { break; }
    if (!req || !Number.isSafeInteger(req.requestId)) break;
    const { requestId, command, id } = req;
    if (command === 'set-policy' && typeof req.enabled === 'boolean') {
      sessions.setPolicy(req.enabled);
      await send({ status: 'policy', requestId, automaticSignIn: sessions.automaticSignIn });
    } else if ((command === 'open' || command === 'confirm-demo') && typeof id === 'string') {
      await send({ requestId, ...await sessions.open(id, command === 'confirm-demo') });
    } else if (command === 'expire-test' && typeof id === 'string' && process.env.VAULT_LAUNCHER_VERIFY === '1') {
      await send({ requestId, status: sessions.expireForVerification(id) ? 'expired-test' : 'unavailable' });
    } else {
      await send({ requestId, status: 'unavailable' });
    }
  }
}
