import { createHash, timingSafeEqual } from 'node:crypto';
import { randomSecret } from './vault.ts';

const digest = (s: string) => createHash('sha256').update(s).digest();
const page = '<!doctype html><meta charset="utf-8"><title>Fixture login</title>' +
  '<form method="post" action="/login" autocomplete="off"><label>Email <input name="username" type="email" autocomplete="username"></label>' +
  '<label>Password <input name="password" type="password" autocomplete="current-password"></label><button type="submit">Sign in</button></form>';

const launcherWorkspaces = new Map([
  ['design@fixture.invalid', { id: 'design', name: 'Design Library', description: 'Brand assets and shared components.' }],
  ['notes@fixture.invalid', { id: 'notes', name: 'Project Notes', description: 'Meeting notes and project decisions.' }],
]);

export function startFixture(options: { sessionTtlMs?: number } = {}) {
  const hashes = new Map<string, Buffer>();
  const sessions = new Map<string, { identity: string; expiresAt: number }>();
  let reads = 0;
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0, maxRequestBodySize: 4096,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.origin !== server.url.origin || req.headers.get('host') !== server.url.host)
        return new Response(null, { status: 421 });
      const headers = {
        'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
      };
      const session = req.headers.get('cookie')?.match(/(?:^|; )fixture_session=([\w-]+)(?:;|$)/)?.[1] ?? '';
      const entry = sessions.get(session);
      const identity = entry && entry.expiresAt > Date.now() ? entry.identity : undefined;
      if (entry && !identity) sessions.delete(session);
      const workspace = identity ? launcherWorkspaces.get(identity) : undefined;
      if (req.method === 'GET' && url.pathname === '/launcher-session') {
        if (!identity) return new Response(null, { headers, status: 401 });
        return Response.json({ identity, workspace: workspace?.id }, { headers });
      }
      if (req.method === 'GET' && url.pathname === '/identity') return new Response(identity ?? 'Signed out', { headers });
      if (req.method === 'GET' && url.pathname === '/read-only') {
        if (identity) reads++;
        return new Response(identity ? '2 sample records' : 'Signed out', { headers, status: identity ? 200 : 401 });
      }
      if (req.method === 'GET' && url.pathname === '/app') {
        if (!workspace) return new Response('Sign-in required', { headers, status: 401 });
        const { name: app, description: content, id } = workspace;
        return new Response(`<!doctype html><meta charset="utf-8"><title>${app}</title>
          <style>
          :root { color-scheme: light dark; font: 16px -apple-system, system-ui; }
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
          main { width: min(75%, 490px); padding: 36px; border: 1px solid GrayText; border-radius: 18px; }
          small { font-weight: 650; color: GrayText; } h1 { margin: 12px 0; font-size: 36px; }
          p { line-height: 1.55; } #identity { font-weight: 600; }
          </style>
          <main data-workspace="${id}"><small>VAULT · DEMO WORKSPACE</small><h1>${app}</h1><p>${content}</p>
          <p>Signed in as <span id="identity">${identity}</span></p></main>`, {
          headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" },
        });
      }
      if (req.method === 'GET' && url.pathname === '/login')
        return new Response(page, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
      if (req.method === 'POST' && url.pathname === '/login' && req.headers.get('origin') === server.url.origin) {
        const data = await req.formData();
        const username = data.get('username');
        const password = data.get('password');
        const expected = typeof username === 'string' ? hashes.get(username) : undefined;
        if (typeof username !== 'string' || typeof password !== 'string' || !expected ||
          !timingSafeEqual(expected, digest(password))) return new Response('Invalid sign in', { status: 401, headers });
        const next = randomSecret();
        const now = Date.now();
        for (const [key, value] of sessions) {
          if (value.expiresAt <= now) sessions.delete(key);
        }
        sessions.set(next, { identity: username, expiresAt: now + (options.sessionTtlMs ?? Infinity) });
        return new Response(null, { status: 303, headers: { ...headers, Location: '/identity',
          'Set-Cookie': `fixture_session=${next}; HttpOnly; SameSite=Strict; Path=/` } });
      }
      return new Response(null, { status: 404, headers });
    },
  });
  return {
    origin: server.url.origin,
    setAccount: (identity: string, password: string) => hashes.set(identity, digest(password)),
    reads: () => reads,
    expireSession: (cookie: string) => sessions.delete(cookie),
    stop: () => server.stop(true),
  };
}
