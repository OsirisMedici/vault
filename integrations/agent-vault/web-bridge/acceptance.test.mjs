// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from 'bun:test';
import { chmod, lstat, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { createBridge, limits } from './bridge.mjs';
import { loadConfig, validateConfig } from './config.mjs';

test('aggregate synthetic v1 compatibility, v2 grants/isolation/revocation and bounded history/audit', async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'vault-web-fixture-'));
  await chmod(directory, 0o700);
  const ownerA = '11111111-1111-4111-8111-111111111111';
  const ownerB = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  const workerToken = 'synthetic_worker_capability_012345678901234567890123456789';
  const sentinel = 'synthetic-password-MUST-NOT-APPEAR';
  const credentialRef = 'VW_SYNTHETICONLY';
  const config = { version: 1, vaultOrigin: 'https://vault.example.invalid', allowedUserIds: [ownerA, ownerB],
    manifestPath: join(directory, 'manifest.json'), workerTokenFile: join(directory, 'worker-token'),
    databasePath: join(directory, 'jobs.sqlite'), engineAddress: 'http://engine:14321' };
  const configPath = join(directory, 'config.json');
  const row = { accountId: 'synthetic-account', name: 'Synthetic ClickUp', username: 'owner@example.invalid',
    origins: ['https://app.clickup.com'], credentialRef, importedAt: '2026-10-23T00:00:00Z' };
  const manifest = { version: 1, vaultName: 'bitwarden-import-20261022', accounts: [row,
    { ...row, accountId: 'unsupported', credentialRef: 'VW_UNSUPPORTED', origins: ['https://example.invalid'] }] };
  const save = (filename, value) => writeFile(filename, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
  let time = Date.parse('2026-10-23T00:00:00Z');
  let bridge;
  let engineUp = true;
  let badProfile = false;
  const upstreamCalls = [];
  const observed = [];
  const fetchImpl = async (url, options) => {
    upstreamCalls.push(url);
    expect(options.method).toBe('GET');
    expect(options.redirect).toBe('error');
    expect(options.credentials).toBe('omit');
    if (url === config.engineAddress + '/health') {
      expect(options.headers.Authorization).toBeUndefined();
      expect(options.headers.Cookie).toBeUndefined();
      expect(JSON.stringify(options)).not.toContain(workerToken);
      return Response.json(engineUp ? { status: 'ok' } : { status: 'unavailable', password: sentinel });
    }
    expect(url).toBe(config.vaultOrigin + '/api/accounts/profile');
    const id = { 'Bearer owner-a': ownerA, 'Bearer owner-b': ownerB, 'Bearer outsider': outsider }[options.headers.Authorization];
    if (!id) return Response.json({ password: sentinel }, { status: 401 });
    return Response.json(badProfile ? { id: sentinel } : { id, ignoredProfileField: sentinel });
  };
  const call = async (path, { token = 'owner-a', method = 'GET', value, origin = config.vaultOrigin, raw } = {}) => {
    const headers = { ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...(origin === null ? {} : { Origin: origin }), ...(value === undefined && raw === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }) };
    const response = await bridge.fetch(new Request('https://bridge.example.invalid' + path, { method, headers,
      ...(value === undefined && raw === undefined ? {} : { body: raw ?? JSON.stringify(value) }) }));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    const text = await response.text(); observed.push(text);
    return { status: response.status, value: JSON.parse(text) };
  };
  const post = (path, value, options = {}) => call(path, { method: 'POST', value, ...options });
  const claim = requestId => post('/worker/claim', { requestId }, { token: workerToken, origin: null });
  const complete = (requestId, state, identityVerified, extra = {}) => post('/worker/complete',
    { requestId, state, identityVerified, ...extra }, { token: workerToken, origin: null });
  const queue = (options = {}) => post('/requests', { accountId: row.accountId, provider: 'clickup' }, options);
  try {
    await save(configPath, config); await save(config.manifestPath, manifest); await save(config.workerTokenFile, workerToken + '\n');
    const loaded = await loadConfig(configPath);
    expect(loaded).toEqual(config);
    // Private-file permission and symlink refusal, with no real configuration.
    await chmod(configPath, 0o644);
    await expect(loadConfig(configPath)).rejects.toThrow('bridge_unavailable');
    await chmod(configPath, 0o600);
    const link = join(directory, 'link.json'); await symlink(configPath, link);
    await expect(loadConfig(link)).rejects.toThrow('bridge_unavailable');
    await chmod(directory, 0o755);
    await expect(loadConfig(configPath)).rejects.toThrow('bridge_unavailable');
    await chmod(directory, 0o700);
    // Secret-bearing or unknown manifest fields make startup fail closed.
    await save(config.manifestPath, { ...manifest, accounts: [{ ...row, password: sentinel }] });
    await expect(createBridge({ config: loaded, fetchImpl, now: () => time })).rejects.toThrow('bridge_unavailable');
    await save(config.manifestPath, { ...manifest, accounts: [{ ...row, extra: sentinel }] });
    await expect(createBridge({ config: loaded, fetchImpl, now: () => time })).rejects.toThrow('bridge_unavailable');
    await save(config.manifestPath, manifest);
    await expect(createBridge({ config: { ...loaded, engineAddress: 'http://engine:14322' }, fetchImpl })).rejects.toThrow('bridge_unavailable');
    bridge = await createBridge({ config: loaded, fetchImpl, now: () => time });
    expect((await call('/health', { token: null, origin: null })).value).toEqual({ status: 'ok' });
    expect(upstreamCalls.length).toBe(0);
    expect((await call('/accounts', { token: null })).status).toBe(401);
    expect((await call('/accounts', { token: 'bad' })).status).toBe(401);
    expect((await call('/accounts', { token: 'outsider' })).status).toBe(403);
    badProfile = true;
    expect((await call('/accounts')).status).toBe(403);
    badProfile = false;
    expect((await call('/accounts', { origin: 'https://attacker.invalid' })).status).toBe(403);
    expect((await queue({ origin: null })).status).toBe(403);
    expect((await call('/accounts?userId=' + ownerA)).status).toBe(400);
    expect((await call('/password')).status).toBe(404);
    const accounts = await call('/accounts');
    expect(accounts.value).toEqual({ accounts: [{ accountId: row.accountId, name: row.name, username: row.username,
      origin: row.origins[0], provider: 'clickup' }] });
    expect((await call('/status')).value).toEqual({ state: 'ready', browserMode: 'chat-assisted', importedAccounts: 2, supportedAccounts: 1 });
    engineUp = false;
    expect((await call('/status')).value.state).toBe('engine_unavailable');
    engineUp = true;
    for (const extra of [{ password: sentinel }, { userId: ownerB }, { extra: 'no' }]) {
      expect((await post('/requests', { accountId: row.accountId, provider: 'clickup', ...extra })).status).toBe(400);
    }
    expect((await post('/requests', { accountId: 'unsupported', provider: 'clickup' })).status).toBe(400);
    expect((await post('/requests', { accountId: row.accountId, provider: 'godial' })).status).toBe(400);
    expect((await post('/requests', undefined, { raw: '{"password":"' + 'x'.repeat(limits.bodyBytes) + '"}' })).status).toBe(400);
    const queued = await queue(); expect(queued.status).toBe(201);
    const id = queued.value.requestId;
    expect(queued.value.state).toBe('queued'); expect(queued.value.identityVerified).toBe(false);
    expect((await queue()).status).toBe(409);
    expect((await call('/requests/' + id, { token: 'owner-b' })).status).toBe(404);
    expect((await post('/requests/' + id + '/cancel', {}, { token: 'owner-b' })).status).toBe(404);
    const second = await queue({ token: 'owner-b' }); expect(second.status).toBe(201);
    expect((await post('/worker/claim', { requestId: id }, { token: 'owner-a', origin: null })).status).toBe(401);
    expect((await post('/worker/claim', { requestId: id }, { token: workerToken })).status).toBe(403);
    expect((await complete(id, 'signed_in', true)).status).toBe(409);
    // Concurrent claims have exactly one winner.
    const claims = await Promise.all([claim(id), claim(id)]);
    expect(claims.map(c => c.status).sort()).toEqual([200, 409]);
    expect(claims.find(c => c.status === 200).value.accountId).toBe(row.accountId);
    expect((await post('/requests/' + id + '/cancel', {})).status).toBe(409);
    expect((await complete(id, 'signed_in', false)).status).toBe(400);
    expect((await complete(id, 'failed', true)).status).toBe(400);
    expect((await complete(id, 'signed_in', true, { password: sentinel })).status).toBe(400);
    expect((await complete(id, 'signed_in', true, { extra: sentinel })).status).toBe(400);
    const signedIn = await complete(id, 'signed_in', true);
    expect(signedIn.status).toBe(200); expect(signedIn.value.state).toBe('signed_in');
    expect((await call('/requests/' + id)).value).toEqual(signedIn.value);
    expect((await complete(id, 'failed', false)).status).toBe(409);
    expect((await post('/requests/' + second.value.requestId + '/cancel', {}, { token: 'owner-b' })).value.state).toBe('cancelled');
    expect((await claim(second.value.requestId)).status).toBe(409);
    const expires = (await queue()).value.requestId;
    expect((await claim(expires)).status).toBe(200);
    time += limits.ttlMs;
    expect((await complete(expires, 'signed_in', true)).status).toBe(409);
    expect((await call('/requests/' + expires)).value.state).toBe('expired');
    const queuedExpiry = (await queue()).value.requestId;
    time += limits.ttlMs;
    expect((await claim(queuedExpiry)).status).toBe(409);
    expect((await call('/requests/' + queuedExpiry)).value.state).toBe('expired');
    bridge.close(); bridge = undefined;
    expect((await lstat(config.databasePath)).mode & 0o7777).toBe(0o600);
    // Restart proves ownership and terminal results are persisted as metadata only.
    bridge = await createBridge({ config: loaded, fetchImpl, now: () => time });
    expect((await call('/requests/' + id)).value.state).toBe('signed_in');
    expect((await call('/requests/' + id, { token: 'owner-b' })).status).toBe(404);
    time += limits.retentionMs + limits.ttlMs;
    expect((await call('/requests/' + id)).status).toBe(404);
    bridge.close(); bridge = undefined;
    const database = new Database(config.databasePath, { readonly: true });
    expect(database.query('SELECT count(*) AS n FROM jobs').get().n).toBe(0);
    expect(database.query('PRAGMA table_info(jobs)').all().map(c => c.name)).toEqual([
      'requestId','ownerId','accountId','provider','name','username','origin','state','expiresAt','createdAt','identityVerified']);
    database.close();
    const allPublicOutput = observed.join('\n');
    for (const forbidden of [sentinel, credentialRef, workerToken, directory, 'owner-a', 'owner-b', ownerA, ownerB, 'credentialRef', 'password']) {
      expect(allPublicOutput).not.toContain(forbidden);
      expect((await readFile(config.databasePath)).includes(Buffer.from(forbidden))).toBe(false);
    }
    expect(upstreamCalls.every(url => url === config.vaultOrigin + '/api/accounts/profile' || url === config.engineAddress + '/health')).toBe(true);

    // The same single aggregate case now exercises the opt-in v2 boundary.
    const teamConfig = { ...config, version: 2, allowedUserIds: [ownerA, ownerB, outsider],
      permissionsPath: join(directory, 'permissions.json') };
    const rowB = { ...row, accountId: 'synthetic-b', credentialRef: 'VW_SYNTHETICB',
      name: 'Synthetic B GoDial', username: 'b@example.invalid', origins: ['https://app.godial.cc'] };
    const teamManifest = { ...manifest, accounts: [{ ...row, origins: ['https://app.clickup.com', 'https://app.godial.cc'] },
      rowB, manifest.accounts[1]] };
    let policy = { version: 1, revision: 0, owners: [{ ownerId: ownerA, accountIds: [row.accountId, 'unsupported'] },
      { ownerId: ownerB, accountIds: [rowB.accountId] }], grants: [
      { ownerId: ownerA, userId: ownerA, accountId: row.accountId, provider: 'clickup' },
      { ownerId: ownerB, userId: ownerB, accountId: rowB.accountId, provider: 'godial' }] };
    const readPolicy = async () => JSON.parse(await readFile(teamConfig.permissionsPath, 'utf8'));
    const edit = (ownerId, grants, expectedRevision = policy.revision) => bridge.replaceOwnerGrants({ ownerId, grants, expectedRevision });
    expect(() => validateConfig({ ...config, permissionsPath: teamConfig.permissionsPath })).toThrow('bridge_unavailable');
    expect(() => validateConfig({ ...config, version: 2 })).toThrow('bridge_unavailable');
    await save(config.manifestPath, teamManifest);
    await save(configPath, teamConfig);
    await expect(createBridge({ config: teamConfig, fetchImpl, now: () => time })).rejects.toThrow('bridge_unavailable');
    for (const invalid of [
      { ...policy, owners: [...policy.owners, { ownerId: outsider, accountIds: [row.accountId] }] },
      { ...policy, grants: [{ ...policy.grants[0], ownerId: ownerB }] },
      { ...policy, grants: [{ ...policy.grants[0], userId: '44444444-4444-4444-8444-444444444444' }] },
      { ...policy, grants: [{ ...policy.grants[0], provider: 'unsupported' }] },
      { ...policy, grants: [...policy.grants, policy.grants[0]] },
    ]) {
      await save(teamConfig.permissionsPath, invalid);
      await expect(createBridge({ config: teamConfig, fetchImpl, now: () => time })).rejects.toThrow('bridge_unavailable');
    }
    await save(teamConfig.permissionsPath, policy);
    bridge = await createBridge({ config: await loadConfig(configPath), fetchImpl, now: () => time });
    expect((await call('/accounts', { token: 'outsider' })).value).toEqual({ accounts: [] });
    expect((await call('/status', { token: 'outsider' })).value).toEqual({ state: 'ready', browserMode: 'chat-assisted', importedAccounts: 0, supportedAccounts: 0 });
    expect((await queue({ token: 'outsider' })).status).toBe(403);
    expect((await call('/accounts')).value.accounts.map(a => [a.accountId, a.provider])).toEqual([[row.accountId, 'clickup']]);
    expect((await call('/accounts', { token: 'owner-b' })).value.accounts.map(a => [a.accountId, a.provider])).toEqual([[rowB.accountId, 'godial']]);
    expect((await call('/status')).value).toEqual({ state: 'ready', browserMode: 'chat-assisted', importedAccounts: 1, supportedAccounts: 1 });
    expect((await post('/requests', { accountId: row.accountId, provider: 'godial' })).status).toBe(403);
    expect((await post('/requests', { accountId: rowB.accountId, provider: 'godial' })).status).toBe(403);
    expect((await queue({ token: 'owner-b' })).status).toBe(403);
    expect((await call('/requests', { token: null })).status).toBe(401);
    expect((await call('/requests')).value).toEqual({ requests: [] });
    const ownA = (await queue()).value.requestId;
    const ownB = (await post('/requests', { accountId: rowB.accountId, provider: 'godial' }, { token: 'owner-b' })).value.requestId;
    expect((await call('/requests/' + ownA, { token: 'owner-b' })).status).toBe(404);
    expect((await post('/requests/' + ownA + '/cancel', {}, { token: 'owner-b' })).status).toBe(404);
    expect((await call('/requests/' + ownB)).status).toBe(404);
    expect((await post('/requests/' + ownB + '/cancel', {})).status).toBe(404);
    expect((await call('/requests')).value.requests.map(r => r.requestId)).toEqual([ownA]);
    expect((await call('/requests', { token: 'owner-b' })).value.requests.map(r => r.requestId)).toEqual([ownB]);
    // Owner A cannot grant owner B's imports; failed/stale edits preserve policy.
    await expect(edit(ownerA, [{ userId: ownerA, accountId: rowB.accountId, provider: 'godial' }])).rejects.toThrow('bridge_unavailable');
    expect(await readPolicy()).toEqual(policy);
    await expect(edit(outsider, [])).rejects.toThrow('bridge_unavailable');
    const lockfile = teamConfig.permissionsPath + '.lock';
    await save(lockfile, 'synthetic-other-writer');
    await expect(edit(ownerA, [])).rejects.toThrow('bridge_unavailable');
    expect(await readFile(lockfile, 'utf8')).toBe('synthetic-other-writer');
    expect(await readPolicy()).toEqual(policy);
    await rm(lockfile);
    expect(await edit(ownerA, [])).toEqual({ revision: 1 });
    policy = await readPolicy();
    expect(policy.grants).toEqual([{ ownerId: ownerB, userId: ownerB, accountId: rowB.accountId, provider: 'godial' }]);
    expect((await claim(ownA)).status).toBe(403); // Revoked queued work never reaches working.
    expect((await claim(ownA)).status).toBe(409);
    expect((await call('/accounts')).value).toEqual({ accounts: [] });
    expect((await call('/requests')).value).toEqual({ requests: [] });
    expect((await call('/requests/' + ownA)).status).toBe(404);
    expect((await post('/requests/' + ownA + '/cancel', {})).status).toBe(404);
    expect((await queue()).status).toBe(403);
    await expect(edit(ownerA, [], 0)).rejects.toThrow('bridge_unavailable');
    const ownGrant = { userId: ownerA, accountId: row.accountId, provider: 'clickup' };
    // Sharing is explicit and provider-scoped. Ownership remains request-user scoped.
    await edit(ownerA, [ownGrant, { ...ownGrant, userId: ownerB }]); policy = await readPolicy();
    expect((await call('/accounts', { token: 'owner-b' })).value.accounts.length).toBe(2);
    expect((await call('/requests/' + ownA, { token: 'owner-b' })).status).toBe(404);
    expect((await call('/requests/' + ownA)).value.state).toBe('cancelled');
    expect((await claim(ownB)).status).toBe(200);
    expect((await complete(ownB, 'signed_in', true)).status).toBe(200);
    const pending = (await queue()).value.requestId;
    // Missing/malformed/unsafe policy fails closed on every existing user route,
    // history, and worker transitions. Restoring policy does not auto-execute.
    await save(teamConfig.permissionsPath, { ...policy, unexpected: true });
    for (const pathname of ['/accounts', '/status', '/requests', '/requests/' + pending]) {
      const before = upstreamCalls.length;
      expect((await call(pathname)).status).toBe(503);
      expect(upstreamCalls.length).toBe(before + 1); // A fresh fixed profile GET each time.
    }
    expect((await queue()).status).toBe(503);
    expect((await post('/requests/' + pending + '/cancel', {})).status).toBe(503);
    expect((await claim(pending)).status).toBe(503);
    await rm(teamConfig.permissionsPath);
    expect((await call('/accounts')).status).toBe(503);
    expect((await claim(pending)).status).toBe(503);
    await save(teamConfig.permissionsPath, policy);
    await chmod(teamConfig.permissionsPath, 0o644);
    expect((await call('/requests')).status).toBe(503);
    await chmod(teamConfig.permissionsPath, 0o600);
    expect((await call('/requests/' + pending)).value.state).toBe('queued');
    expect((await claim(pending)).status).toBe(200);
    await edit(ownerA, []); policy = await readPolicy();
    expect((await complete(pending, 'signed_in', true)).status).toBe(403);
    await edit(ownerA, [ownGrant]); policy = await readPolicy();
    expect((await call('/requests/' + pending)).value.state).toBe('failed');
    expect((await complete(pending, 'signed_in', true)).status).toBe(409);
    const newest = [];
    for (let i = 0; i < 28; i++) {
      const request = (await queue()).value;
      expect(request.state).toBe('queued');
      newest.push(request.requestId);
      expect((await post('/requests/' + request.requestId + '/cancel', {})).value.state).toBe('cancelled');
    }
    const history = (await call('/requests')).value;
    expect(Object.keys(history)).toEqual(['requests']);
    expect(history.requests.map(r => r.requestId)).toEqual(newest.reverse().slice(0, 25));
    const publicKeys = ['requestId', 'state', 'provider', 'name', 'username', 'origin', 'expiresAt', 'identityVerified'];
    for (const request of history.requests) expect(Object.keys(request)).toEqual(publicKeys);
    expect((await call('/requests', { token: 'owner-b' })).value.requests.map(r => r.requestId)).toEqual([ownB]);
    expect((await post('/admin/grants', {})).status).toBe(404);
    // Exercise the actual audit cap using denied synthetic requests, not a second test.
    for (let i = 0; i < limits.auditRecords + 1; i++) expect((await queue({ token: 'outsider' })).status).toBe(403);
    bridge.close(); bridge = undefined;
    const auditDb = new Database(config.databasePath, { readonly: true });
    expect(auditDb.query('SELECT count(*) AS n FROM audit').get().n).toBe(limits.auditRecords);
    expect(auditDb.query('PRAGMA table_info(audit)').all().map(c => c.name)).toEqual([
      'sequence', 'createdAt', 'actorId', 'action', 'requestId', 'accountId', 'provider']);
    expect(auditDb.query('SELECT state FROM jobs WHERE requestId=?').get(ownA).state).toBe('cancelled');
    auditDb.close();
    const outputs = observed.join('\n');
    for (const forbidden of [sentinel, credentialRef, workerToken, directory, ownerA, ownerB, outsider, 'credentialRef', 'password']) {
      expect(outputs).not.toContain(forbidden);
    }
    for (const forbidden of [sentinel, credentialRef, workerToken, directory]) {
      expect((await readFile(config.databasePath)).includes(Buffer.from(forbidden))).toBe(false);
    }
    // Retention/restart remains bounded across policy versions, including audit.
    time += limits.retentionMs + limits.ttlMs;
    bridge = await createBridge({ config: teamConfig, fetchImpl, now: () => time });
    expect((await call('/requests')).value).toEqual({ requests: [] });
    bridge.close(); bridge = undefined;
    const emptyDb = new Database(config.databasePath, { readonly: true });
    expect(emptyDb.query('SELECT count(*) AS n FROM audit').get().n).toBe(0);
    expect(emptyDb.query('SELECT count(*) AS n FROM jobs').get().n).toBe(0);
    emptyDb.close();
  } finally {
    bridge?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
