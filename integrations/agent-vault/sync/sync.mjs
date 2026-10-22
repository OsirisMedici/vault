// SPDX-License-Identifier: GPL-3.0-only
import { randomBytes, randomUUID } from 'node:crypto';
import { createPrivateStore } from './private-store.mjs';
import { equal, fail, identity, manifest, MAX_ITEMS, object, origin, pairTags, same, tag, text, uuid, VAULT } from './common.mjs';

const sourceTag = (key, snapshot) => tag(key, 'source', {
  ...snapshot, items: [...snapshot.items].sort((a, b) => a.sourceItemId.localeCompare(b.sourceItemId)),
});
const manifestTag = (key, value) => tag(key, 'manifest', value);
const fields = ['username', 'password'];
const countKeys = ['enrolled', 'changedAccounts', 'credentialFields', 'metadataAccounts', 'unchanged', 'missing', 'unowned', 'skipped'];

function validateCounts(counts) {
  if (!object(counts) || !same(Object.keys(counts).sort(), [...countKeys].sort()) ||
      countKeys.some(k => !Number.isSafeInteger(counts[k]) || counts[k] < 0 || counts[k] > MAX_ITEMS * 2)) fail('invalid_state');
}

function validateSnapshot(snapshot) {
  if (!object(snapshot) || !same(identity(snapshot.identity), snapshot.identity) ||
      !Number.isSafeInteger(snapshot.skipped) || snapshot.skipped < 0 || snapshot.skipped > MAX_ITEMS ||
      !Array.isArray(snapshot.items) || snapshot.items.length > MAX_ITEMS) fail('invalid_source');
  const ids = new Set();
  for (const item of snapshot.items) {
    if (!object(item) || !uuid(item.sourceItemId) || item.sourceItemId !== item.sourceItemId.toLowerCase() ||
        ids.has(item.sourceItemId) || !text(item.name, 1024, true) || !text(item.username, 1024, true) ||
        typeof item.password !== 'string' || !item.password || item.password.length > 16384 ||
        !Array.isArray(item.origins) || item.origins.length > 128 || item.origins.some(o => origin(o) !== o)) fail('invalid_source');
    ids.add(item.sourceItemId);
  }
  return snapshot;
}

function validateState(state, metadata) {
  if (!object(state) || state.version !== 1 || state.vaultName !== VAULT ||
      !Number.isSafeInteger(state.revision) || state.revision < 1 ||
      typeof state.key !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(state.key) ||
      !object(state.pairs) || !same(identity(state.identity), state.identity) ||
      !equal(state.manifestTag, manifestTag(state.key, metadata)) ||
      Object.keys(state.pairs).length !== metadata.accounts.length) fail('invalid_state');
  for (const row of metadata.accounts) {
    const pair = state.pairs[row.credentialRef];
    if (!object(pair) || Object.keys(pair).length !== 2 || fields.some(f => !/^[a-f0-9]{64}$/.test(pair[f]))) fail('invalid_state');
  }
}

function updateMetadata(row, item) {
  const updated = { ...row, name: item.name, username: item.username, origins: [...item.origins] };
  // Preserve a previously approved login URL while it still belongs to a retained origin.
  if (row.loginUrl && item.origins.includes(new URL(row.loginUrl).origin)) return updated;
  delete updated.loginUrl;
  if (item.origins.length) updated.loginUrl = `${item.origins[0]}/`;
  return updated;
}

async function inspect(engine, metadata, state, pending = null) {
  const actual = {};
  const changes = new Map((pending?.mutations ?? []).map(m => [m.ref, m]));
  for (const row of metadata.accounts) {
    const pair = await engine.readPair(row.credentialRef);
    if (!object(pair) || typeof pair.username !== 'string' || typeof pair.password !== 'string' || !pair.password) fail('destination_conflict');
    const digest = pairTags(state.key, row.credentialRef, pair);
    const change = changes.get(row.credentialRef);
    for (const field of fields) {
      if (!equal(digest[field], state.pairs[row.credentialRef][field]) &&
          !(change && equal(digest[field], change.after[field]))) fail('destination_conflict');
    }
    actual[row.credentialRef] = digest;
  }
  return actual;
}

/** Trusted-host only. All injected callbacks and adapters are private host code. */
export function createCredentialSync({ source, engine, manifestPath, statePath, journalPath,
  withExclusiveAccess, now = Date.now } = {}) {
  const store = createPrivateStore({ manifestPath, statePath, journalPath });
  let planned;
  let busy = false;

  async function bounded(operation) {
    if (busy) return { state: 'blocked', reasonCode: 'sync_busy' };
    busy = true;
    try { return await store.locked(operation); }
    catch (error) {
      try { fail(error?.name === 'SyncError' ? error.reasonCode : 'sync_failed'); }
      catch (safe) { return { state: 'blocked', reasonCode: safe.reasonCode }; }
    } finally { busy = false; }
  }
  async function acquire(consume) {
    if (!source || typeof source.withSnapshot !== 'function') fail('source_authorization_required');
    if (!engine || typeof engine.readPair !== 'function' || typeof engine.writeFields !== 'function') fail('invalid_config');
    let called = false;
    let work;
    await source.withSnapshot(snapshot => {
      if (called) fail('invalid_source');
      called = true;
      work = Promise.resolve().then(() => consume(validateSnapshot(snapshot)));
      return work.then(() => ({ state: 'consumed' }));
    });
    if (!called) fail('source_authorization_required');
    return await work;
  }
  async function exclusive(consume) {
    if (typeof withExclusiveAccess !== 'function') fail('exclusive_access_required');
    let called = false;
    let work;
    await withExclusiveAccess(() => {
      if (called) fail('exclusive_access_required');
      called = true;
      work = Promise.resolve().then(consume);
      return work.then(() => ({ state: 'completed' }));
    });
    if (!called) fail('exclusive_access_required');
    return await work;
  }

  function validateJournal(journal) {
    if (!object(journal) || journal.version !== 1 || !uuid(journal.planId) ||
        !['enroll', 'sync'].includes(journal.mode) || !Array.isArray(journal.mutations)) fail('invalid_state');
    manifest(journal.beforeManifest); manifest(journal.nextManifest);
    validateState(journal.nextState, journal.nextManifest);
    validateCounts(journal.counts);
    if (journal.beforeState) validateState(journal.beforeState, journal.beforeManifest);
    if ((journal.mode === 'enroll') !== (journal.beforeState === null) ||
        !same(journal.beforeManifest.accounts.map(a => [a.accountId, a.credentialRef, a.sourceItemId, a.importedAt]),
          journal.nextManifest.accounts.map(a => [a.accountId, a.credentialRef, a.sourceItemId, a.importedAt])) ||
        (journal.beforeState && (journal.beforeState.key !== journal.nextState.key ||
          !same(journal.beforeState.identity, journal.nextState.identity) ||
          journal.nextState.revision !== journal.beforeState.revision + 1))) fail('invalid_state');
    const seen = new Set();
    for (const mutation of journal.mutations) {
      const before = journal.beforeState?.pairs[mutation.ref];
      const after = journal.nextState.pairs[mutation.ref];
      if (!before || !after || seen.has(mutation.ref) || !same(mutation.before, before) ||
          !same(mutation.after, after) || !Array.isArray(mutation.fields) ||
          !same(mutation.fields, fields.filter(f => !equal(before[f], after[f])))) fail('invalid_state');
      seen.add(mutation.ref);
    }
    if (journal.mode === 'enroll' && journal.mutations.length) fail('invalid_state');
    return journal;
  }

  async function execute(journal, snapshot, resume) {
    validateJournal(journal);
    const { nextState, beforeState, beforeManifest, nextManifest } = journal;
    if (!same(snapshot.identity, nextState.identity) || !equal(sourceTag(nextState.key, snapshot), journal.sourceTag)) fail('plan_stale');
    const current = await store.read();
    if (resume) {
      if (!same(current.journal, journal) ||
          !(same(current.manifest, beforeManifest) || same(current.manifest, nextManifest)) ||
          !(same(current.state, beforeState) || same(current.state, nextState))) fail('plan_stale');
    } else if (current.journal || !same(current.manifest, beforeManifest) || !same(current.state, beforeState)) fail('plan_stale');

    // Inspect all owned pairs before any write, including omitted source items.
    const baseline = beforeState ?? nextState;
    await inspect(engine, beforeManifest, baseline, resume ? journal : null);
    if (!resume) await store.stage(journal);
    const byId = new Map(snapshot.items.map(item => [item.sourceItemId, item]));
    for (const mutation of journal.mutations) {
      const row = beforeManifest.accounts.find(a => a.credentialRef === mutation.ref);
      const item = byId.get(row.sourceItemId.toLowerCase());
      if (!item) fail('plan_stale');
      const desired = { username: item.username, password: item.password };
      if (!same(pairTags(nextState.key, mutation.ref, desired), mutation.after)) fail('plan_stale');
      // Recheck directly before writing. The engine itself offers no compare-and-swap.
      const actual = pairTags(nextState.key, mutation.ref, await engine.readPair(mutation.ref));
      for (const field of fields) {
        if (!equal(actual[field], mutation.before[field]) &&
            !(resume && equal(actual[field], mutation.after[field]))) fail('destination_conflict');
      }
      const changed = mutation.fields.filter(f => !equal(actual[f], mutation.after[f]));
      if (changed.length) await engine.writeFields(mutation.ref, Object.fromEntries(changed.map(f => [f, desired[f]])));
      if (!same(pairTags(nextState.key, mutation.ref, await engine.readPair(mutation.ref)), mutation.after)) fail('destination_conflict');
    }
    await inspect(engine, nextManifest, nextState);
    await store.commit(journal);
    return { state: 'applied', planId: journal.planId, mode: journal.mode, counts: { ...journal.counts } };
  }

  return Object.freeze({
    plan({ mode = 'sync' } = {}) {
      return bounded(async () => {
        planned = undefined;
        if (!['sync', 'enroll'].includes(mode)) fail('invalid_config');
        const current = await store.read();
        if (current.journal) fail('pending_reconciliation');
        const beforeManifest = manifest(current.manifest);
        const beforeState = current.state;
        if (beforeState) validateState(beforeState, beforeManifest);
        if (mode === 'sync' && !beforeState) fail('baseline_required');
        if (mode === 'enroll' && beforeState) fail('invalid_state');
        return await acquire(async snapshot => {
          if (beforeState && !same(beforeState.identity, snapshot.identity)) fail('source_identity_mismatch');
          const key = beforeState?.key ?? randomBytes(32).toString('base64');
          const base = beforeState ?? { key, pairs: {} };
          const byId = new Map(snapshot.items.map(item => [item.sourceItemId, item]));
          const nextManifest = structuredClone(beforeManifest);
          const pairs = {};
          const mutations = [];
          const counts = { enrolled: mode === 'enroll' ? beforeManifest.accounts.length : 0,
            changedAccounts: 0, credentialFields: 0, metadataAccounts: 0, unchanged: 0,
            missing: 0, unowned: 0, skipped: snapshot.skipped };
          const ownedIds = new Set();
          for (let index = 0; index < beforeManifest.accounts.length; index++) {
            const row = beforeManifest.accounts[index];
            // Legacy fallback IDs are preserved, but cannot be matched reliably for updates.
            if (row.sourceItemId) ownedIds.add(row.sourceItemId.toLowerCase());
            const item = row.sourceItemId && byId.get(row.sourceItemId.toLowerCase());
            const pair = await engine.readPair(row.credentialRef);
            const actual = pairTags(key, row.credentialRef, pair);
            if (mode === 'enroll') {
              if (!item || pair.username !== row.username || pair.username !== item.username || pair.password !== item.password) fail('baseline_source_mismatch');
              pairs[row.credentialRef] = actual;
              counts.unchanged++;
              continue;
            }
            if (!same(actual, base.pairs[row.credentialRef])) fail('destination_conflict');
            pairs[row.credentialRef] = actual;
            if (!item) { counts.missing++; continue; }
            const after = pairTags(key, row.credentialRef, item);
            const changedFields = fields.filter(f => !equal(actual[f], after[f]));
            const updated = updateMetadata(row, item);
            const metadataChanged = !same(row, updated);
            if (metadataChanged) { nextManifest.accounts[index] = updated; counts.metadataAccounts++; }
            if (changedFields.length) {
              mutations.push({ ref: row.credentialRef, before: actual, after, fields: changedFields });
              pairs[row.credentialRef] = after;
              counts.credentialFields += changedFields.length;
            }
            if (metadataChanged || changedFields.length) counts.changedAccounts++; else counts.unchanged++;
          }
          counts.unowned = snapshot.items.filter(item => !ownedIds.has(item.sourceItemId)).length;
          manifest(nextManifest);
          const planId = randomUUID();
          const nextState = { version: 1, vaultName: VAULT, revision: (beforeState?.revision ?? 0) + 1,
            identity: identity(snapshot.identity), key, pairs, manifestTag: manifestTag(key, nextManifest),
            receipt: { planId, mode, plannedAt: new Date(now()).toISOString(), counts } };
          planned = { version: 1, planId, mode, beforeManifest, beforeState, nextManifest, nextState,
            sourceTag: sourceTag(key, snapshot), mutations, counts, expiresAt: now() + 300_000 };
          return { state: 'planned', planId, mode, counts: { ...counts } };
        });
      });
    },
    apply({ planId, approved = false } = {}) {
      return bounded(async () => {
        if (approved !== true) fail('apply_required');
        const journal = planned;
        planned = undefined;
        if (!journal || journal.planId !== planId || now() > journal.expiresAt) fail('plan_expired');
        return await exclusive(() => acquire(snapshot => execute(journal, snapshot, false)));
      });
    },
    resume({ planId, approved = false } = {}) {
      return bounded(async () => {
        if (approved !== true) fail('apply_required');
        const current = await store.read();
        if (!current.journal) fail('no_pending_apply');
        if (current.journal.planId !== planId) fail('plan_expired');
        const journal = validateJournal(current.journal);
        // Resume requires the same authorized source and an explicit new approval.
        return await exclusive(() => acquire(snapshot => execute(journal, snapshot, true)));
      });
    },
  });
}
