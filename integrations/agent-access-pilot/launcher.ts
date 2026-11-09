import { randomSecret, type openVault } from './vault.ts';
import type { startFixture } from './fixture.ts';

const apps = [
  { name: 'Design Library', identity: 'design@fixture.invalid' },
  { name: 'Project Notes', identity: 'notes@fixture.invalid' },
];

export async function serveLauncher(
  fixture: ReturnType<typeof startFixture>,
  vault: Awaited<ReturnType<typeof openVault>>,
  protect: (value: string) => void,
) {
  if (process.stdout.isTTY) throw new Error('Start the launcher through the Vault Launcher app');
  // This owner-only channel is a private parent/child pipe. It carries one
  // synthetic site cookie per app and never a vault password or unlock key.
  for (const app of apps) {
    try {
      const password = randomSecret();
      protect(password);
      fixture.setAccount(app.identity, password);
      const saved = await vault.save(app.name, app.identity, password, fixture.origin);
      const cipher = await vault.get(saved.id);
      if (cipher.id !== saved.id || cipher.login.username !== app.identity ||
          cipher.login.uris.length !== 1 || cipher.login.uris[0]?.uri !== fixture.origin ||
          cipher.login.uris[0]?.match !== 0) throw new Error('Unexpected fixture login');
      const response = await fetch(fixture.origin + '/login', {
        method: 'POST', redirect: 'manual',
        headers: { Origin: fixture.origin },
        body: new URLSearchParams({ username: cipher.login.username, password: cipher.login.password }),
      });
      const cookie = response.headers.get('set-cookie')?.match(/^fixture_session=([\w-]+); HttpOnly; SameSite=Strict; Path=\/$/)?.[1];
      if (response.status !== 303 || !cookie) throw new Error('Fixture sign-in failed');
      protect(cookie);
      const identity = await fetch(fixture.origin + '/identity', {
        redirect: 'error', headers: { Cookie: 'fixture_session=' + cookie },
      });
      if (!identity.ok || await identity.text() !== app.identity) throw new Error('Wrong signed-in identity');
      await Bun.write(Bun.stdout, JSON.stringify({
        ...app, status: 'signed-in', url: fixture.origin + '/app', cookie,
      }) + '\n');
    } catch {
      await Bun.write(Bun.stdout, JSON.stringify({ ...app, status: 'unavailable' }) + '\n');
    }
  }
  await Bun.write(Bun.stdout, '{"status":"ready"}\n');
  // Closing the app's pipe also stops the disposable vault and fixture.
  for await (const _ of Bun.stdin.stream()) { /* The parent sends no commands. */ }
}
