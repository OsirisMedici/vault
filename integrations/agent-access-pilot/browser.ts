import { BetterWright, NetworkPolicy } from 'betterwright';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import type { Account } from './broker.ts';
import type { LoginItem } from './vault.ts';

export function createExecutor(root: string, executablePath: string, origin: string,
  getItem: (id: string) => Promise<LoginItem>, inspect: (data: unknown) => void) {
  let browser: BetterWright | undefined;
  async function close() {
    const previous = browser;
    browser = undefined;
    await previous?.close();
  }
  async function body(path: string) {
    const result = await browser!.run(`await page.goto(${JSON.stringify(origin + path)});
      return await page.locator('body').innerText();`, { automaticUI: false });
    inspect(result);
    if (!result.ok || typeof result.result !== 'string') throw new Error('fixture page read failed');
    return result.result;
  }
  return {
    close,
    existingIdentity: () => body('/identity'),
    async run(account: Account, recheck: () => void, afterIdentity?: () => void) {
      await close();
      recheck();
      let credential: LoginItem | undefined;
      let secretFetched = false;
      let scopeRejected: unknown;
      const home = mkdtempSync(join(root, 'browser-'));
      browser = new BetterWright({
        home, headless: true, adBlock: false, credentialCapture: false,
        provider: { executablePath },
        policy: new NetworkPolicy({ allowPrivateNetwork: false, allowLoopback: true,
          // CONNECT carries host:port without the page's scheme. Restrict
          // sockets to that endpoint and actual page requests to exact origin.
          custom: (url, details) => ({
            allowed: ['transport', 'transport-address'].includes(details.resourceType ?? '')
              ? new URL(url).host === new URL(origin).host : new URL(url).origin === origin,
            reason: 'fixed fixture origin',
          }),
        }),
        vault: {
          handleRequest(action, payload, actualOrigin) {
            if (action !== 'fill' || payload.id !== account.id || actualOrigin !== origin ||
              account.origin !== origin || secretFetched) throw new Error('fixture credential request denied');
            try { recheck(); } catch (error) { scopeRejected = error; throw error; }
            if (!credential) throw new Error('fixture cipher unavailable');
            const { username, password } = credential.login;
            credential = undefined;
            secretFetched = true;
            return { id: account.id, origin, username, secret: password };
          },
        },
      });
      if (await body('/identity') !== 'Signed out') throw new Error('fresh browser was already signed in');
      const nav = await browser.run(`await page.goto(${JSON.stringify(origin + '/login')});`, { automaticUI: false });
      inspect(nav);
      if (!nav.ok) throw new Error('fixture login page unavailable');
      recheck();
      // Fetch in trusted code before starting the browser's short fill call.
      // The host adapter checks again immediately before passing it to the browser.
      try { credential = await getItem(account.id); }
      catch { throw new Error('could not read the granted fixture cipher'); }
      recheck();
      if (credential.id !== account.id || credential.login.username !== account.identity ||
        credential.login.uris.length !== 1 || credential.login.uris[0]?.uri !== origin ||
        credential.login.uris[0]?.match !== 0 || typeof credential.login.password !== 'string')
        throw new Error('fixture cipher did not match the grant');
      try {
        const fill = await browser.fillCredential({
          id: account.id, submit: true,
          usernameSelector: '[name="username"]', passwordSelector: '[name="password"]',
          submitSelector: 'button[type="submit"]',
        });
        if (scopeRejected) throw scopeRejected;
        inspect(fill);
        const submitted = fill.ok && fill.result && typeof fill.result === 'object' && 'submitted' in fill.result
          && fill.result.submitted === true;
        if (!submitted || !secretFetched) throw new Error('private fill did not submit');
      } finally {
        credential = undefined;
      }
      // The form redirects. Read the current page without initiating a
      // competing navigation, which could cancel the login POST.
      const deadline = Date.now() + 6000;
      let verified = false;
      do {
        recheck();
        const observed = await browser.run(`return { url: await page.url(), text: await page.locator('body').innerText() };`,
          { automaticUI: false });
        inspect(observed);
        if (observed.ok && observed.result && typeof observed.result === 'object' &&
          'url' in observed.result && observed.result.url === origin + '/identity') {
          if (!('text' in observed.result) || observed.result.text !== account.identity)
            throw new Error('wrong signed-in identity');
          verified = true;
          break;
        }
        await Bun.sleep(125);
      } while (Date.now() < deadline);
      if (!verified) throw new Error('sign-in identity did not arrive');
      afterIdentity?.();
      recheck();
      if (await body('/read-only') !== '2 sample records') throw new Error('fixture read did not complete');
      recheck();
      return { signedOut: true, privateFill: true, identityVerified: true, records: 2 } as const;
    },
  };
}
