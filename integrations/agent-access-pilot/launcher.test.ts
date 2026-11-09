import { expect, test } from 'bun:test';
import { startFixture } from './fixture.ts';
import { createLauncherSessions } from './launcher.ts';
import type { LoginItem } from './vault.ts';

test('automatic sign-in respects the switch and rejects the wrong workspace before handing off a cookie', async () => {
  const fixture = startFixture();
  const ciphers = new Map<string, LoginItem>();
  let unlocks = 0;
  const vault = {
    async save(name: string, username: string, password: string, origin: string) {
      const id = String(ciphers.size + 1);
      const item = { id, name, login: { username, password, uris: [{ uri: origin, match: 0 }] } };
      ciphers.set(id, item);
      return item;
    },
    async get(id: string) { unlocks++; return ciphers.get(id)!; },
  };
  let wrongWorkspace = false;
  const readProvider = (async (input: string, init?: RequestInit) => {
    if (wrongWorkspace && input.endsWith('/launcher-session'))
      return Response.json({ identity: 'design@fixture.invalid', workspace: 'notes' });
    return fetch(input, init);
  }) as typeof fetch;

  try {
    const launcher = await createLauncherSessions(fixture, vault, () => {}, false, readProvider);
    await launcher.prepare();
    expect(await launcher.open('design')).toEqual({ status: 'manual-required', id: 'design', reason: 'signed-out' });
    expect(unlocks).toBe(0);
    launcher.setPolicy(true);
    expect(await launcher.open('design')).toMatchObject({ status: 'signed-in', source: 'automatic' });
    expect(unlocks).toBe(1);
    wrongWorkspace = true;
    expect(await launcher.open('design')).toEqual({ status: 'wrong-account', id: 'design' });
    wrongWorkspace = false;
    expect(await launcher.open('design')).toEqual({ status: 'wrong-account', id: 'design' });
    expect(unlocks).toBe(1);
    launcher.setPolicy(false);
    expect(await launcher.open('design', true)).toMatchObject({ status: 'signed-in', source: 'manual' });
    expect(unlocks).toBe(2);

    const relaunched = await createLauncherSessions(fixture, vault, () => {}, true, readProvider);
    await relaunched.prepare();
    expect(unlocks).toBe(4);
    expect(await relaunched.open('design')).toMatchObject({ status: 'signed-in', source: 'existing' });
    expect(await relaunched.open('notes')).toMatchObject({ status: 'signed-in', source: 'existing' });
    expect(unlocks).toBe(4);
  } finally {
    fixture.stop();
  }
});
