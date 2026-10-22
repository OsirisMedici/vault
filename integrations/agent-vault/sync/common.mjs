// SPDX-License-Identifier: GPL-3.0-only
import { createHmac, timingSafeEqual } from 'node:crypto';

export const VAULT = 'bitwarden-import-20261022';
export const MAX_BYTES = 16 * 1024 * 1024;
export const MAX_ITEMS = 20_000;
const REASONS = new Set([
  'invalid_config', 'private_file_unsafe', 'invalid_source', 'source_authorization_required',
  'source_identity_mismatch', 'source_expired', 'baseline_required', 'baseline_source_mismatch',
  'invalid_manifest', 'invalid_state', 'destination_conflict', 'engine_unavailable',
  'exclusive_access_required', 'sync_busy', 'plan_expired', 'plan_stale', 'apply_required',
  'pending_reconciliation', 'no_pending_apply', 'sync_failed',
]);
export function fail(reason) {
  const reasonCode = REASONS.has(reason) ? reason : 'sync_failed';
  const error = Object.assign(new Error(reasonCode), { name: 'SyncError', reasonCode });
  delete error.stack;
  throw error;
}
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const text = (value, max = 1024, empty = false) => typeof value === 'string' &&
  value.length <= max && (empty || value.length > 0) && !/[\u0000-\u001f\u007f]/u.test(value);
export const uuid = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const reference = id => `VW_${id.replaceAll('-', '').toUpperCase()}`;
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const tag = (key, scope, value) => createHmac('sha256', Buffer.from(key, 'base64'))
  .update(scope).update('\0').update(canonical(value)).digest('hex');
export function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length === b.length &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function origin(value) {
  try {
    if (!text(value, 2048) || !value.startsWith('https://') || /[\\*]/u.test(value)) return null;
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.origin;
  } catch { return null; }
}
export function identity(value) {
  if (!object(value) || !uuid(value.ownerId) || origin(value.vaultOrigin) !== value.vaultOrigin ||
      Object.keys(value).some(k => !['ownerId', 'vaultOrigin'].includes(k))) fail('invalid_config');
  return { ownerId: value.ownerId.toLowerCase(), vaultOrigin: value.vaultOrigin };
}
export const pairTags = (key, ref, pair) => ({
  username: tag(key, `${ref}:username`, pair.username),
  password: tag(key, `${ref}:password`, pair.password),
});
export const same = (a, b) => canonical(a) === canonical(b);

export function manifest(value) {
  if (!object(value) || value.version !== 1 || value.vaultName !== VAULT ||
      Object.keys(value).some(k => !['version', 'vaultName', 'accounts'].includes(k)) ||
      !Array.isArray(value.accounts) || !value.accounts.length || value.accounts.length > MAX_ITEMS) fail('invalid_manifest');
  const ids = new Set();
  const refs = new Set();
  for (const row of value.accounts) {
    if (!object(row) || Object.keys(row).some(k => ![
      'accountId', 'sourceItemId', 'credentialRef', 'name', 'username', 'origins', 'importedAt', 'loginUrl',
    ].includes(k)) || !text(row.accountId, 256) || !text(row.name, 1024, true) ||
        !text(row.username, 1024, true) || !text(row.credentialRef, 131) ||
        !/^VW_[A-Z0-9]{1,128}$/.test(row.credentialRef) ||
        !text(row.importedAt, 64) || !Number.isFinite(Date.parse(row.importedAt)) ||
        !Array.isArray(row.origins) || row.origins.length > 128 ||
        row.origins.some(o => origin(o) !== o) || new Set(row.origins).size !== row.origins.length ||
        ('sourceItemId' in row && !uuid(row.sourceItemId)) || ids.has(row.accountId) || refs.has(row.credentialRef)) fail('invalid_manifest');
    if ('sourceItemId' in row && (row.accountId.toLowerCase() !== row.sourceItemId.toLowerCase() ||
        reference(row.sourceItemId) !== row.credentialRef)) fail('invalid_manifest');
    if ('loginUrl' in row && (!text(row.loginUrl, 2048) || !row.origins.includes(origin(row.loginUrl)))) fail('invalid_manifest');
    ids.add(row.accountId);
    refs.add(row.credentialRef);
  }
  return value;
}
