// SPDX-License-Identifier: GPL-3.0-only
import { Database } from 'bun:sqlite';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { fail, exactKeys, object, privateRead, prepareDatabase, uuid, validateConfig } from './config.mjs';
import { loadMetadata, providers } from './metadata.mjs';

export const limits = Object.freeze({ bodyBytes: 2048, responseBytes: 1024 * 1024, upstreamBytes: 65536,
  timeoutMs: 5000, ttlMs: 300000, retentionMs: 3600000, activeJobs: 64, storedJobs: 1024, inFlight: 32 });
const terminal = new Set(['signed_in', 'verification_required', 'credentials_rejected', 'failed']);
const publicCodes = new Set(['unauthorized','forbidden','invalid_request','not_found','active_request','queue_full','invalid_state']);
const digest = value => createHash('sha256').update(value).digest();
const error = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const projection = row => ({ requestId: row.requestId, state: row.state, provider: row.provider,
  name: row.name, username: row.username, origin: row.origin,
  expiresAt: new Date(row.expiresAt).toISOString(), identityVerified: row.identityVerified === 1 });

async function boundedJson(response, maxBytes, signal) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    response.body?.cancel().catch(() => {});
    throw 0;
  }
  if (!response.body) throw 0;
  const reader = response.body.getReader();
  const abort = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { value.fill(0); throw 0; }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks, size);
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    finally { bytes.fill(0); }
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    signal.removeEventListener('abort', abort);
    // Do not await cancellation: an adversarial streaming source can stall it.
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function deadline(operation) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([operation(controller.signal), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(0); }, limits.timeoutMs);
    })]);
  } finally { clearTimeout(timer); controller.abort(); }
}

/** Dependency injection is host-only. Production never substitutes user authentication.
 * fetchImpl handles only the two fixed GET URLs; now returns epoch milliseconds.
 */
export async function createBridge({ config: input, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let db;
  try {
    const config = validateConfig(input);
    if (typeof fetchImpl !== 'function' || typeof now !== 'function') fail();
    const metadata = await loadMetadata(config.manifestPath);
    let capability = await privateRead(config.workerTokenFile, 256);
    if (!/^[A-Za-z0-9_-]{43,128}\n?$/.test(capability)) fail();
    const capabilityHash = digest(capability.replace(/\n$/, ''));
    capability = undefined;
    await prepareDatabase(config.databasePath);
    db = new Database(config.databasePath, { create: false, strict: true });
    db.exec(`PRAGMA page_size=4096; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON;
      PRAGMA busy_timeout=1000; PRAGMA max_page_count=8192;
      CREATE TABLE IF NOT EXISTS jobs (
        requestId TEXT PRIMARY KEY, ownerId TEXT NOT NULL, accountId TEXT NOT NULL,
        provider TEXT NOT NULL CHECK(provider IN ('clickup','godial')),
        name TEXT NOT NULL, username TEXT NOT NULL, origin TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued','working','signed_in','verification_required','credentials_rejected','failed','cancelled','expired')),
        expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL,
        identityVerified INTEGER NOT NULL DEFAULT 0 CHECK(identityVerified IN (0,1))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_owner ON jobs(ownerId) WHERE state IN ('queued','working');`);
    if (db.query('PRAGMA page_size').get().page_size !== 4096) fail();
    const clock = () => {
      const value = now();
      if (!Number.isSafeInteger(value) || value < 0 || value > 8640000000000000 - limits.retentionMs) fail();
      return value;
    };
    const clean = time => {
      db.query("UPDATE jobs SET state='expired',identityVerified=0 WHERE state IN ('queued','working') AND expiresAt<=?").run(time);
      db.query("DELETE FROM jobs WHERE state NOT IN ('queued','working') AND expiresAt<=?").run(time - limits.retentionMs);
    };
    const atomic = operation => {
      const result = db.transaction(() => {
        try { return { value: operation() }; }
        catch (failure) {
          // Commit expiry/retention cleanup even when the requested transition is
          // refused. Unexpected database errors still roll back the transaction.
          if (!publicCodes.has(failure?.code)) throw failure;
          return { failure };
        }
      }).immediate();
      if (result.failure) throw result.failure;
      return result.value;
    };
    atomic(() => {
      clean(clock());
      if (db.query('SELECT count(*) AS n FROM jobs').get().n > limits.storedJobs ||
          db.query("SELECT count(*) AS n FROM jobs WHERE state IN ('queued','working')").get().n > limits.activeJobs) fail();
    });
    const get = id => db.query('SELECT * FROM jobs WHERE requestId=?').get(id);
    let inFlight = 0;
    let closed = false;

    async function upstream(url, headers) {
      return deadline(async signal => {
        const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal,
          cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json', ...headers } });
        if (!response.ok || response.redirected) { response.body?.cancel().catch(() => {}); throw 0; }
        return boundedJson(response, limits.upstreamBytes, signal);
      });
    }

    function bearer(request, max = 4096) {
      const header = request.headers.get('authorization');
      if (typeof header !== 'string' || header.length > max + 7 || !/^Bearer [\x21-\x7e]+$/.test(header)) error(401, 'unauthorized');
      return header.slice(7);
    }

    async function user(request) {
      const token = bearer(request);
      let profile;
      try {
        // Never use a URL, identity, issuer or audience supplied by the caller.
        profile = await upstream(config.vaultOrigin + '/api/accounts/profile', { Authorization: `Bearer ${token}` });
      } catch { error(401, 'unauthorized'); }
      if (!object(profile) || !uuid(profile.id) || !config.allowedUserIds.includes(profile.id)) error(403, 'forbidden');
      return profile.id;
    }

    function worker(request) {
      if (request.headers.has('origin')) error(403, 'forbidden');
      const supplied = digest(bearer(request, 256));
      if (!timingSafeEqual(capabilityHash, supplied)) error(401, 'unauthorized');
    }

    async function body(request, keys) {
      if (request.headers.get('content-type')?.toLowerCase() !== 'application/json' ||
          request.headers.has('content-encoding')) error(400, 'invalid_request');
      let value;
      try { value = await deadline(signal => boundedJson(request, limits.bodyBytes, signal)); }
      catch { request.body?.cancel().catch(() => {}); error(400, 'invalid_request'); }
      if (!exactKeys(value, keys)) error(400, 'invalid_request');
      return value;
    }

    function response(value, status = 200) {
      const json = JSON.stringify(value);
      if (Buffer.byteLength(json) > limits.responseBytes) return response({ error: 'unavailable' }, 503);
      return new Response(json, { status, headers: { 'Content-Type': 'application/json',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
    }

    async function route(request) {
      const url = new URL(request.url);
      if (url.search || url.hash || url.pathname.length > 256) error(400, 'invalid_request');
      const pathname = url.pathname;
      const method = request.method;
      if (method === 'GET' && request.body !== null) error(400, 'invalid_request');
      if (pathname === '/health' && method === 'GET') return response({ status: 'ok' });
      const isWorker = pathname === '/worker/claim' || pathname === '/worker/complete';
      const match = /^\/requests\/([0-9a-f-]{36})(\/cancel)?$/.exec(pathname);
      const known = isWorker ? method === 'POST' :
        ((pathname === '/status' || pathname === '/accounts') && method === 'GET') ||
        (pathname === '/requests' && method === 'POST') ||
        (match && uuid(match[1]) && ((!match[2] && method === 'GET') || (match[2] && method === 'POST')));
      if (!known) error(404, 'not_found');
      let ownerId;
      if (isWorker) worker(request);
      else {
        const suppliedOrigin = request.headers.get('origin');
        if ((suppliedOrigin !== null && suppliedOrigin !== config.vaultOrigin) ||
            (method === 'POST' && suppliedOrigin === null)) error(403, 'forbidden');
        ownerId = await user(request);
      }

      if (pathname === '/accounts') return response({ accounts: metadata.accounts });
      if (pathname === '/status') {
        let ready = false;
        try {
          // This is the ONLY engine call, including on the dedicated Docker network.
          // No Authorization, cookies, worker capability, or Vault token is attached.
          ready = (await upstream(config.engineAddress + '/health', {}))?.status === 'ok';
        } catch { /* Fixed public state only. */ }
        return response({ state: ready ? 'ready' : 'engine_unavailable', browserMode: 'chat-assisted',
          importedAccounts: metadata.importedAccounts, supportedAccounts: new Set(metadata.accounts.map(a => a.accountId)).size });
      }
      if (pathname === '/requests') {
        const value = await body(request, ['accountId', 'provider']);
        const account = metadata.accounts.find(a => a.accountId === value.accountId && a.provider === value.provider);
        if (!account || !Object.hasOwn(providers, value.provider)) error(400, 'invalid_request');
        const row = atomic(() => {
          const time = clock(); clean(time);
          if (db.query("SELECT 1 FROM jobs WHERE ownerId=? AND state IN ('queued','working')").get(ownerId)) error(409, 'active_request');
          if (db.query("SELECT count(*) AS n FROM jobs WHERE state IN ('queued','working')").get().n >= limits.activeJobs) error(429, 'queue_full');
          // Preserve recent terminal results until retention ends; never evict active jobs.
          if (db.query('SELECT count(*) AS n FROM jobs').get().n >= limits.storedJobs) error(429, 'queue_full');
          const id = randomUUID();
          db.query(`INSERT INTO jobs (requestId,ownerId,accountId,provider,name,username,origin,state,expiresAt,createdAt)
            VALUES (?,?,?,?,?,?,?,'queued',?,?)`).run(id, ownerId, account.accountId, account.provider,
            account.name, account.username, account.origin, time + limits.ttlMs, time);
          return get(id);
        });
        return response(projection(row), 201);
      }
      if (match) {
        if (match[2]) await body(request, []);
        const row = atomic(() => {
          clean(clock());
          let row = get(match[1]);
          if (!row || row.ownerId !== ownerId) error(404, 'not_found');
          if (match[2]) {
            if (row.state !== 'queued') error(409, 'invalid_state');
            db.query("UPDATE jobs SET state='cancelled',identityVerified=0 WHERE requestId=? AND state='queued'").run(row.requestId);
            row = get(row.requestId);
          }
          return row;
        });
        return response(projection(row));
      }
      const claim = pathname === '/worker/claim';
      const value = await body(request, claim ? ['requestId'] : ['requestId', 'state', 'identityVerified']);
      if (!uuid(value.requestId) || (!claim && (!terminal.has(value.state) || typeof value.identityVerified !== 'boolean' ||
          value.identityVerified !== (value.state === 'signed_in')))) error(400, 'invalid_request');
      const row = atomic(() => {
        clean(clock());
        const row = get(value.requestId);
        if (!row) error(404, 'not_found');
        if (row.state !== (claim ? 'queued' : 'working')) error(409, 'invalid_state');
        const state = claim ? 'working' : value.state;
        db.query('UPDATE jobs SET state=?,identityVerified=? WHERE requestId=? AND state=?')
          .run(state, claim ? 0 : Number(value.identityVerified), value.requestId, row.state);
        return get(value.requestId);
      });
      return response({ ...projection(row), ...(claim ? { accountId: row.accountId } : {}) });
    }

    return Object.freeze({
      async fetch(request) {
        if (closed || inFlight >= limits.inFlight) return response({ error: 'unavailable' }, 503);
        inFlight++;
        try { return await route(request); }
        catch (failure) {
          // Never serialize raw exceptions, upstream bodies, headers, paths or causes.
          return response({ error: publicCodes.has(failure?.code) ? failure.code : 'unavailable' },
            publicCodes.has(failure?.code) ? failure.status : 503);
        } finally { inFlight--; }
      },
      close() { if (!closed) { closed = true; db.close(); capabilityHash.fill(0); } },
    });
  } catch {
    db?.close();
    fail();
  }
}
