import { createHash, timingSafeEqual } from 'node:crypto';
import { randomSecret } from './vault.ts';

const digest = (s: string) => createHash('sha256').update(s).digest();
const page = '<!doctype html><meta charset="utf-8"><title>Fixture login</title>' +
  '<form method="post" action="/login" autocomplete="off"><label>Email <input name="username" type="email" autocomplete="username"></label>' +
  '<label>Password <input name="password" type="password" autocomplete="current-password"></label><button type="submit">Sign in</button></form>';

export function startFixture() {
  const hashes = new Map<string, Buffer>();
  const sessions = new Map<string, string>();
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
      const identity = sessions.get(session);
      if (req.method === 'GET' && url.pathname === '/identity') return new Response(identity ?? 'Signed out', { headers });
      if (req.method === 'GET' && url.pathname === '/read-only') {
        if (identity) reads++;
        return new Response(identity ? '2 sample records' : 'Signed out', { headers, status: identity ? 200 : 401 });
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
        sessions.set(next, username);
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
    stop: () => server.stop(true),
  };
}
