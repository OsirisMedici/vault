// SPDX-License-Identifier: GPL-3.0-only
import { readJSON } from './private-store.mjs';
import { fail, identity, MAX_ITEMS, object, origin, same, text, uuid } from './common.mjs';

function project(data) {
  if (!object(data) || data.encrypted !== false || !Array.isArray(data.items) || data.items.length > MAX_ITEMS) fail('invalid_source');
  const items = [];
  const ids = new Set();
  let skipped = 0;
  for (const row of data.items) {
    if (!object(row)) fail('invalid_source');
    if (row.organizationId || row.deletedDate || row.archivedDate || row.isArchived || row.type !== 1 ||
        !object(row.login) || typeof row.login.password !== 'string' || !row.login.password) { skipped++; continue; }
    if (!uuid(row.id) || ids.has(row.id.toLowerCase()) || !text(row.name ?? '', 1024, true) ||
        !text(row.login.username ?? '', 1024, true) || row.login.password.length > 16384 ||
        (row.login.uris != null && (!Array.isArray(row.login.uris) || row.login.uris.length > 128))) fail('invalid_source');
    const origins = [];
    for (const entry of row.login.uris ?? []) {
      const value = origin(entry?.uri);
      if (value && !origins.includes(value)) origins.push(value);
    }
    ids.add(row.id.toLowerCase());
    items.push({ sourceItemId: row.id.toLowerCase(), name: row.name ?? '', origins,
      username: row.login.username ?? '', password: row.login.password });
  }
  return { items, skipped };
}

/** Owner-created normal JSON export only. Authorization is trusted host code, never an MCP argument. */
export function createPrivateExportSource({ exportPath, expectedIdentity, authorizeSource, now = Date.now, maxAgeMs = 600_000 }) {
  const expected = identity(expectedIdentity);
  if (typeof authorizeSource !== 'function' || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 600_000) fail('invalid_config');
  return Object.freeze({
    async withSnapshot(consume) {
      let data;
      let snapshot;
      try {
        const auth = await authorizeSource();
        if (!object(auth) || auth.method !== 'bitwarden-json-export' || !Number.isFinite(Date.parse(auth.acquiredAt))) fail('source_authorization_required');
        if (!same(identity(auth.identity), expected)) fail('source_identity_mismatch');
        const age = now() - Date.parse(auth.acquiredAt);
        if (age < 0 || age > maxAgeMs) fail('source_expired');
        data = await readJSON(exportPath);
        snapshot = { identity: expected, ...project(data) };
        return await consume(snapshot);
      } catch (error) {
        if (error?.name === 'SyncError') fail(error.reasonCode);
        fail('source_authorization_required');
      } finally { data = undefined; snapshot = undefined; }
    },
  });
}
