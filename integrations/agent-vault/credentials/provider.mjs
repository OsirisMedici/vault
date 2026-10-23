// SPDX-License-Identifier: GPL-3.0-only
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';

const VAULT_NAME = 'bitwarden-import-20261022';
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ACCOUNTS = 20_000;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const TOP_KEYS = new Set(['version', 'vaultName', 'accounts']);
const ROW_KEYS = new Set([
  'accountId', 'name', 'username', 'origins', 'credentialRef',
  'sourceItemId', 'importedAt', 'loginUrl',
]);
const REASONS = Object.freeze({
  manifest_missing: 'import_required',
  manifest_unavailable: 'import_required',
  manifest_unsafe: 'import_required',
  manifest_too_large: 'import_required',
  manifest_invalid: 'import_required',
  invalid_query: 'denied',
  invalid_origin: 'denied',
  account_not_found: 'denied',
  origin_not_allowed: 'denied',
  username_mismatch: 'denied',
  credential_invalid: 'engine_unavailable',
  engine_unavailable: 'engine_unavailable',
  invalid_consumer: 'failed',
  consumer_failed: 'failed',
});

// Only locally constructed bounded failures leave this module. Never attach causes.
class CredentialProviderError extends Error {
  constructor(reasonCode) {
    super(`Credential provider: ${reasonCode}`);
    delete this.stack;
    this.name = 'CredentialProviderError';
    this.state = REASONS[reasonCode];
    this.reasonCode = reasonCode;
  }
}
const fail = (reasonCode) => { throw new CredentialProviderError(reasonCode); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const textField = (value, max, empty = false) =>
  typeof value === 'string' && value.length <= max && (empty || value.length > 0) && !CONTROL.test(value);
const keysAllowed = (value, allowed) => Object.keys(value).every((key) => allowed.has(key));

function httpsUrl(value) {
  if (!textField(value, 2048) || !/^https:\/\//iu.test(value) ||
      value !== value.trim() || value.includes('*')) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || value.includes('\\')) return null;
    return url;
  } catch { return null; }
}

function normalizeOrigin(value) {
  const url = httpsUrl(value);
  if (!url || url.pathname !== '/' || value.includes('?') || value.includes('#')) return null;
  return url.origin;
}

function parseManifest(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { fail('manifest_invalid'); }
  if (!object(value) || !keysAllowed(value, TOP_KEYS) || value.version !== 1 ||
      value.vaultName !== VAULT_NAME || !Array.isArray(value.accounts) ||
      value.accounts.length > MAX_ACCOUNTS) fail('manifest_invalid');
  const ids = new Set();
  const refs = new Set();
  const accounts = value.accounts.map((row) => {
    if (!object(row) || !keysAllowed(row, ROW_KEYS) ||
        !textField(row.accountId, 256) || !textField(row.name, 1024, true) ||
        !textField(row.username, 1024, true) ||
        typeof row.credentialRef !== 'string' || !/^VW_[A-Z0-9]{1,128}$/u.test(row.credentialRef) ||
        !Array.isArray(row.origins) || row.origins.length > 128 ||
        !textField(row.importedAt, 64) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(row.importedAt) ||
        !Number.isFinite(Date.parse(row.importedAt)) ||
        ('sourceItemId' in row && !textField(row.sourceItemId, 256)) ||
        ids.has(row.accountId) || refs.has(row.credentialRef)) fail('manifest_invalid');
    const origins = row.origins.map(normalizeOrigin);
    if (origins.some((origin) => origin === null)) fail('manifest_invalid');
    if ('loginUrl' in row) {
      const url = httpsUrl(row.loginUrl);
      if (!url || !origins.includes(url.origin)) fail('manifest_invalid');
    }
    ids.add(row.accountId);
    refs.add(row.credentialRef);
    // Project only the contract's approved metadata, never arbitrary JSON keys.
    return Object.freeze({
      accountId: row.accountId, name: row.name, username: row.username,
      origins: Object.freeze([...new Set(origins)]), credentialRef: row.credentialRef,
    });
  });
  return Object.freeze(accounts);
}

function privateStat(stat, directory = false) {
  return stat.uid === process.getuid() &&
    (directory ? stat.isDirectory() : stat.isFile()) &&
    (stat.mode & 0o7777) === (directory ? 0o700 : 0o600);
}

async function readManifest(manifestPath) {
  if (typeof manifestPath !== 'string' || !isAbsolute(manifestPath)) fail('manifest_missing');
  let handle;
  try {
    const parent = await lstat(dirname(manifestPath));
    const entry = await lstat(manifestPath);
    if (!privateStat(parent, true) || !privateStat(entry)) fail('manifest_unsafe');
    if (entry.size > MAX_BYTES) fail('manifest_too_large');
    handle = await open(manifestPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = await handle.stat();
    if (!privateStat(before) || before.dev !== entry.dev || before.ino !== entry.ino) fail('manifest_unsafe');
    if (before.size > MAX_BYTES) fail('manifest_too_large');
    const bytes = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await handle.stat();
    if (!privateStat(after) || length !== before.size || after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) fail('manifest_unsafe');
    return parseManifest(bytes.subarray(0, length).toString('utf8'));
  } catch (error) {
    if (error instanceof CredentialProviderError) throw error;
    fail(error?.code === 'ENOENT' ? 'manifest_missing' : 'manifest_unavailable');
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

/** Trusted host API. consume and its return value must remain inside trusted code. */
export function createCredentialProvider({ engine, manifestPath, now: _now } = {}) {
  // Cache only a successful snapshot. A missing import can become available later.
  let snapshot;
  const accounts = async () => {
    if (!snapshot) {
      snapshot = readManifest(manifestPath);
      try { await snapshot; } catch (error) { snapshot = undefined; throw error; }
    }
    return snapshot;
  };
  const metadata = (account) => ({ ...account, origins: [...account.origins] });

  return Object.freeze({
    async status() {
      try { await accounts(); } catch { return { state: 'import_required' }; }
      try {
        const result = await engine.health();
        return { state: result?.state === 'ready' ? 'ready' : 'engine_unavailable' };
      } catch { return { state: 'engine_unavailable' }; }
    },

    async findAccounts({ query = '', origin } = {}) {
      if (!textField(query, 256, true)) fail('invalid_query');
      const normalized = normalizeOrigin(origin);
      if (!normalized) fail('invalid_origin');
      let rows;
      try { rows = await accounts(); } catch (error) {
        return { state: 'import_required', reasonCode: error.reasonCode };
      }
      const search = query.trim().toLowerCase();
      return {
        state: 'accounts_ready',
        accounts: rows.filter((row) => row.origins.includes(normalized) &&
          [row.name, row.username, ...row.origins].some((field) => field.toLowerCase().includes(search)))
          .map(metadata),
      };
    },

    async withCredential({ accountId, origin } = {}, consume) {
      if (typeof consume !== 'function') fail('invalid_consumer');
      const normalized = normalizeOrigin(origin);
      if (!normalized) fail('invalid_origin');
      const rows = await accounts();
      const account = rows.find((row) => row.accountId === accountId);
      if (!account) fail('account_not_found');
      if (!account.origins.includes(normalized)) fail('origin_not_allowed');
      let consumed = false;
      let result;
      let localFailure;
      try {
        await engine.withLogin(account.credentialRef, async (login) => {
          try {
            if (consumed || !object(login) || typeof login.username !== 'string' ||
                typeof login.password !== 'string' || !login.password) fail('credential_invalid');
            if (login.username !== account.username) fail('username_mismatch');
            consumed = true;
            try { result = await consume({ username: login.username, password: login.password }); }
            catch { fail('consumer_failed'); }
            return undefined; // The engine never receives the consumer's result.
          } catch (error) {
            localFailure = error instanceof CredentialProviderError ? error : new CredentialProviderError('credential_invalid');
            throw localFailure;
          }
        });
      } catch {
        throw localFailure ?? new CredentialProviderError('engine_unavailable');
      }
      if (localFailure) throw localFailure;
      if (!consumed) fail('credential_invalid');
      // CONTRACT.md requires callback result, never the engine's return object.
      return result;
    },
  });
}
