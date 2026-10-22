// SPDX-License-Identifier: GPL-3.0-only
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, writeFile, rm, realpath, lstat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPrivateExportSource } from './source.mjs';
import { createSyncEngine } from './engine.mjs';
import { createCredentialSync } from './sync.mjs';
import { reference, VAULT } from './common.mjs';

// One aggregate synthetic case. No live engine, source, account, port or browser is used.
test('C-SYNC: incremental ownership, private apply and interrupted-apply recovery', async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), 'vault-sync-fixture-'));
  await chmod(root, 0o700);
  const manifestPath = path.join(root, 'import-manifest.json');
  const statePath = path.join(root, 'sync-state.json');
  const journalPath = path.join(root, 'sync-journal.json');
  const exportPath = path.join(root, 'export.json');
  const tokenFile = path.join(root, 'fixture-token');
  const identity = { ownerId: '11111111-1111-4111-8111-111111111111', vaultOrigin: 'https://vault.example.invalid' };
  const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
  let clock = Date.parse('2026-10-23T08:00:00Z');
  const now = () => clock;
  const put = async (file, value) => { await writeFile(file, JSON.stringify(value), { mode: 0o600 }); await chmod(file, 0o600); };
  const get = async file => JSON.parse(await readFile(file, 'utf8'));
  let approvedIdentity = identity;
  let authorization = true;
  let engineWrites = 0;
  let reveals = 0;
  let held = false;
  let partial = false;
  const writes = [];
  const values = new Map();
  const row = (id, username, password, name = 'Synthetic') => ({ id, type: 1, name,
    organizationId: null, login: { username, password, uris: [{ uri: 'https://app.example.invalid/private?discard=synthetic' }] } });
  let sourceRows = [row(ids[0], 'first@example.invalid', 'synthetic-initial-a'),
    row(ids[1], '', 'synthetic-initial-b'), row(ids[2], 'third@example.invalid', 'synthetic-initial-c')];
  const saveSource = () => put(exportPath, { encrypted: false, items: sourceRows });
  const original = { version: 1, vaultName: VAULT, accounts: sourceRows.map(item => ({
    accountId: item.id, sourceItemId: item.id, credentialRef: reference(item.id),
    name: item.name, username: item.login.username, origins: ['https://app.example.invalid'],
    importedAt: '2026-10-22T00:00:00+00:00', loginUrl: 'https://app.example.invalid/',
  })) };
  for (const item of sourceRows) {
    values.set(`${reference(item.id)}_USERNAME`, item.login.username);
    values.set(`${reference(item.id)}_PASSWORD`, item.login.password);
  }
  values.set('FOREIGN_UNRELATED', 'synthetic-foreign-value');
  const foreignBefore = values.get('FOREIGN_UNRELATED');
  const fetchImpl = async (url, init) => {
    assert.equal(held || init.method === 'GET', true);
    assert.equal(init.redirect, 'error');
    const parsed = new URL(url);
    if (init.method === 'POST') {
      engineWrites++;
      const payload = JSON.parse(init.body);
      assert.equal(payload.vault, VAULT);
      const keys = Object.keys(payload.credentials);
      assert.ok(keys.length > 0 && keys.length <= 2);
      writes.push(keys);
      if (partial) {
        partial = false;
        values.set(keys[0], payload.credentials[keys[0]]);
        return Response.json({ deliberatelyDiscarded: 'synthetic-native-failure' }, { status: 500 });
      }
      for (const [key, value] of Object.entries(payload.credentials)) values.set(key, value);
      return Response.json({ set: keys });
    }
    assert.equal(parsed.pathname, '/v1/credentials');
    assert.equal(parsed.searchParams.get('reveal'), 'true');
    assert.equal(parsed.searchParams.get('vault'), VAULT);
    const key = parsed.searchParams.get('key');
    assert.ok(key && key !== 'FOREIGN_UNRELATED');
    reveals++;
    if (!values.has(key)) return Response.json({}, { status: 404 });
    return Response.json({ keys: [key], credentials: [{ key, type: 'static',
      ...(values.get(key) ? { value: values.get(key) } : {}) }] });
  };
  try {
    await put(manifestPath, original);
    await writeFile(tokenFile, 'synthetic-capability-only\n', { mode: 0o600 });
    await saveSource();
    const source = createPrivateExportSource({ exportPath, expectedIdentity: identity, now,
      authorizeSource: async () => authorization ? { method: 'bitwarden-json-export',
        identity: approvedIdentity, acquiredAt: new Date(clock).toISOString() } : null });
    const engine = createSyncEngine({ address: 'http://127.0.0.1:1', vaultName: VAULT, tokenFile, fetchImpl });
    const options = { source, engine, manifestPath, statePath, journalPath, now,
      withExclusiveAccess: async consume => { assert.equal(held, false); held = true; try { return await consume(); } finally { held = false; } } };
    let sync = createCredentialSync(options);
    assert.equal((await sync.plan()).reasonCode, 'baseline_required');
    authorization = false;
    assert.equal((await sync.plan({ mode: 'enroll' })).reasonCode, 'source_authorization_required');
    authorization = true;
    approvedIdentity = { ...identity, ownerId: ids[0] };
    assert.equal((await sync.plan({ mode: 'enroll' })).reasonCode, 'source_identity_mismatch');
    approvedIdentity = identity;
    let plan = await sync.plan({ mode: 'enroll' });
    assert.equal(plan.state, 'planned');
    assert.equal((await sync.apply({ planId: plan.planId })).reasonCode, 'apply_required');
    assert.equal((await sync.apply({ planId: plan.planId, approved: true })).state, 'applied');
    assert.equal(engineWrites, 0);
    assert.deepEqual(await get(manifestPath), original);
    // Password-only change, metadata-only change, omitted owned item, and new unowned ID.
    sourceRows[0].login.password = 'synthetic-rotated-a';
    sourceRows[1].name = 'Synthetic renamed';
    sourceRows = sourceRows.slice(0, 2);
    sourceRows.push(row(ids[3], 'unowned@example.invalid', 'synthetic-never-import'));
    await saveSource();
    plan = await sync.plan();
    assert.equal(plan.state, 'planned');
    assert.deepEqual(plan.counts, { enrolled: 0, changedAccounts: 2, credentialFields: 1,
      metadataAccounts: 1, unchanged: 0, missing: 1, unowned: 1, skipped: 0 });
    assert.equal(engineWrites, 0);
    const result = await sync.apply({ planId: plan.planId, approved: true });
    assert.equal(result.state, 'applied');
    assert.deepEqual(writes, [[`${reference(ids[0])}_PASSWORD`]]);
    const updated = await get(manifestPath);
    assert.equal(updated.accounts.length, 3);
    assert.deepEqual(updated.accounts[2], original.accounts[2]);
    for (let i = 0; i < 3; i++) for (const field of ['accountId', 'credentialRef', 'sourceItemId', 'importedAt']) {
      assert.equal(updated.accounts[i][field], original.accounts[i][field]);
    }
    assert.equal(values.has(`${reference(ids[3])}_PASSWORD`), false);
    const privateState = await get(statePath);
    for (const value of values.values()) if (value) assert.equal(JSON.stringify(privateState).includes(value), false);
    for (const publicResult of [plan, result]) {
      assert.equal(/password|credentialRef|sourceTag|manifestTag|pairs|key|\.json/.test(JSON.stringify(publicResult)), false);
    }
    assert.equal((await lstat(statePath)).mode & 0o7777, 0o600);
    // Source changed after planning and destination changed independently both fail closed.
    plan = await sync.plan();
    sourceRows[0].login.password = 'synthetic-next-a'; await saveSource();
    assert.equal((await sync.apply({ planId: plan.planId, approved: true })).reasonCode, 'plan_stale');
    const ownedKey = `${reference(ids[0])}_PASSWORD`;
    const saved = values.get(ownedKey);
    values.set(ownedKey, 'synthetic-foreign-change');
    assert.equal((await sync.plan()).reasonCode, 'destination_conflict');
    values.set(ownedKey, saved);
    // Simulate the pinned API writing one field and then failing. Restart the helper and resume explicitly.
    sourceRows[0].login.username = 'changed@example.invalid'; await saveSource();
    plan = await sync.plan();
    const beforeFailure = await get(manifestPath);
    partial = true;
    assert.equal((await sync.apply({ planId: plan.planId, approved: true })).reasonCode, 'engine_unavailable');
    assert.deepEqual(await get(manifestPath), beforeFailure);
    assert.equal((await lstat(journalPath)).mode & 0o7777, 0o600);
    sync = createCredentialSync(options);
    assert.equal((await sync.plan()).reasonCode, 'pending_reconciliation');
    assert.equal((await sync.resume({ planId: plan.planId })).reasonCode, 'apply_required');
    assert.equal((await sync.resume({ planId: plan.planId, approved: true })).state, 'applied');
    assert.deepEqual(writes.at(-1), [`${reference(ids[0])}_PASSWORD`]);
    assert.equal((await get(manifestPath)).accounts[0].username, 'changed@example.invalid');
    assert.equal(values.get('FOREIGN_UNRELATED'), foreignBefore);
    plan = await sync.plan();
    assert.equal(plan.counts.changedAccounts, 0);
    const beforeNoop = engineWrites;
    assert.equal((await sync.apply({ planId: plan.planId, approved: true })).state, 'applied');
    assert.equal(engineWrites, beforeNoop);
    // Private-source symlink rejection must occur before any reveal.
    await rm(exportPath); await symlink(tokenFile, exportPath);
    const beforeUnsafe = reveals;
    assert.equal((await sync.plan()).reasonCode, 'private_file_unsafe');
    assert.equal(reveals, beforeUnsafe);
    clock += 1;
  } finally { await rm(root, { recursive: true, force: true }); }
});
