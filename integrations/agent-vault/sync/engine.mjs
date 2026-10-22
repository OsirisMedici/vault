// SPDX-License-Identifier: GPL-3.0-only
import { createTransport } from '../engine/http.mjs';
import { fail, VAULT } from './common.mjs';

// Uses pinned v0.40.1 single-key reveal and set APIs. No provisioning, listing, deletes or settings changes.
export function createSyncEngine({ address, vaultName, tokenFile, fetchImpl }) {
  if (vaultName !== VAULT) fail('invalid_config');
  const request = createTransport({ address, tokenFile, fetchImpl });
  const keys = ref => {
    if (typeof ref !== 'string' || !/^VW_[A-Z0-9]{1,128}$/.test(ref)) fail('invalid_config');
    return { username: `${ref}_USERNAME`, password: `${ref}_PASSWORD` };
  };
  return Object.freeze({
    async readPair(ref) {
      try {
        const result = {};
        for (const [field, key] of Object.entries(keys(ref))) {
          const body = await request(`/v1/credentials?${new URLSearchParams({ vault: VAULT, reveal: 'true', key })}`);
          const row = body?.credentials?.[0];
          if (body?.keys?.length !== 1 || body.keys[0] !== key || body?.credentials?.length !== 1 ||
              row?.key !== key || row.type !== 'static' ||
              (row.value !== undefined && typeof row.value !== 'string')) fail('destination_conflict');
          // The pinned Go API omits an empty static value. Empty usernames are valid.
          result[field] = row.value ?? '';
          if (result[field].length > 16384 || (field === 'password' && !result[field])) fail('destination_conflict');
        }
        return result;
      } catch (error) {
        fail(error?.reasonCode === 'destination_conflict' || error?.reasonCode === 'credential_missing' ? 'destination_conflict' : 'engine_unavailable');
      }
    },
    async writeFields(ref, fields) {
      const names = keys(ref);
      if (!fields || !Object.keys(fields).length || Object.keys(fields).some(k => !Object.hasOwn(names, k) ||
          typeof fields[k] !== 'string' || fields[k].length > 16384 || (k === 'password' && !fields[k]))) fail('invalid_config');
      const credentials = Object.fromEntries(Object.entries(fields).map(([field, value]) => [names[field], value]));
      try {
        const result = await request('/v1/credentials', { method: 'POST', body: { vault: VAULT, credentials } });
        if (!Array.isArray(result?.set) || result.set.length !== Object.keys(credentials).length ||
            !result.set.every(k => Object.hasOwn(credentials, k)) || new Set(result.set).size !== result.set.length) fail('engine_unavailable');
      } catch { fail('engine_unavailable'); }
    },
  });
}
