// SPDX-License-Identifier: GPL-3.0-only
import { fail, object, privateRead, text } from './config.mjs';

export const providers = Object.freeze({ clickup: 'https://app.clickup.com', godial: 'https://app.godial.cc' });
const topKeys = ['version', 'vaultName', 'accounts'];
const rowKeys = ['accountId', 'name', 'username', 'origins', 'credentialRef', 'sourceItemId', 'importedAt', 'loginUrl'];
const allowedKeys = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
function httpsUrl(value) {
  if (!text(value, 2048) || value !== value.trim() || value.includes('\\') || value.includes('*')) fail();
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) fail();
  return url;
}

export async function loadMetadata(filename) {
  const manifest = JSON.parse(await privateRead(filename, 16 * 1024 * 1024));
  if (!allowedKeys(manifest, topKeys) || manifest.version !== 1 ||
      manifest.vaultName !== 'bitwarden-import-20261022' || !Array.isArray(manifest.accounts) ||
      manifest.accounts.length > 20000) fail();
  const ids = new Set();
  const refs = new Set();
  const accounts = [];
  for (const row of manifest.accounts) {
    if (!allowedKeys(row, rowKeys) || !text(row.accountId, 256) || !text(row.name, 1024, true) ||
        !text(row.username, 1024, true) || !Array.isArray(row.origins) || row.origins.length > 128 ||
        typeof row.credentialRef !== 'string' || !/^VW_[A-Z0-9]{1,128}$/.test(row.credentialRef) ||
        !text(row.importedAt, 64) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.importedAt) ||
        !Number.isFinite(Date.parse(row.importedAt)) ||
        ('sourceItemId' in row && !text(row.sourceItemId, 256)) || ids.has(row.accountId) || refs.has(row.credentialRef)) fail();
    const origins = row.origins.map(value => {
      const url = httpsUrl(value);
      if (url.pathname !== '/' || value.includes('?') || value.includes('#')) fail();
      return url.origin;
    });
    if ('loginUrl' in row && !origins.includes(httpsUrl(row.loginUrl).origin)) fail();
    ids.add(row.accountId);
    refs.add(row.credentialRef);
    for (const [provider, origin] of Object.entries(providers)) {
      if (origins.includes(origin)) accounts.push(Object.freeze({ accountId: row.accountId, name: row.name,
        username: row.username, origin, provider }));
    }
    if (accounts.length > 256) fail();
  }
  if (Buffer.byteLength(JSON.stringify({ accounts })) > 1024 * 1024) fail();
  return Object.freeze({ importedAccounts: manifest.accounts.length, accountIds: Object.freeze([...ids]),
    accounts: Object.freeze(accounts) });
}
