import { createTransport, validateVault } from './http.mjs';
import { engineError } from './private-file.mjs';
export { loadEngineConfig } from './private-file.mjs';

export function credentialRefForSourceId(sourceId) {
  if (typeof sourceId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
    throw engineError('invalid_reference');
  }
  return `VW_${sourceId.replaceAll('-', '').toUpperCase()}`;
}

function keysFor(ref) {
  if (typeof ref !== 'string' || !/^VW_[A-Z0-9](?:[A-Z0-9_]{0,126}[A-Z0-9])?$/.test(ref)) {
    throw engineError('invalid_reference');
  }
  return [`${ref}_USERNAME`, `${ref}_PASSWORD`];
}

export function createEngineClient({ address, vaultName, tokenFile, fetchImpl }) {
  validateVault(vaultName);
  const request = createTransport({ address, tokenFile, fetchImpl });
  async function reveal(key) {
    const query = new URLSearchParams({ vault: vaultName, reveal: 'true', key });
    const result = await request(`/v1/credentials?${query}`);
    if (!result || !Array.isArray(result.keys) || result.keys.length !== 1 || result.keys[0] !== key ||
        !Array.isArray(result.credentials) || result.credentials.length !== 1) throw engineError('invalid_response');
    const entry = result.credentials[0];
    if (!entry || entry.key !== key || typeof entry.value !== 'string' || entry.value.length > 16384 ||
        (entry.type !== undefined && entry.type !== 'static')) throw engineError('credential_missing');
    return entry.value;
  }
  return Object.freeze({
    async health() {
      try {
        const health = await request('/health', { authenticated: false });
        if (health?.status !== 'ok') throw 0;
        // Member-gated, metadata-only probe. /health alone accepts even an uninitialized instance.
        const sessions = await request(`/v1/sessions?${new URLSearchParams({ vault: vaultName })}`);
        if (!Array.isArray(sessions?.sessions)) throw 0;
        return { state: 'ready' };
      } catch { return { state: 'engine_unavailable' }; }
    },
    async putLogin(input) {
      if (!input || typeof input !== 'object') throw engineError('invalid_login');
      const { credentialRef, username, password } = input;
      const [userKey, passwordKey] = keysFor(credentialRef);
      if (typeof username !== 'string' || typeof password !== 'string' || !password ||
          username.length > 16384 || password.length > 16384) throw engineError('invalid_login');
      const result = await request('/v1/credentials', { method: 'POST',
        body: { vault: vaultName, credentials: { [userKey]: username, [passwordKey]: password } } });
      if (!Array.isArray(result?.set) || result.set.length !== 2 ||
          !result.set.includes(userKey) || !result.set.includes(passwordKey)) throw engineError('invalid_response');
      return { state: 'ready' };
    },
    async withLogin(credentialRef, consume) {
      const [userKey, passwordKey] = keysFor(credentialRef);
      if (typeof consume !== 'function') throw engineError('invalid_login');
      let username;
      let password;
      try {
        username = await reveal(userKey);
        password = await reveal(passwordKey);
        if (!password) throw engineError('credential_missing');
        // Trusted host callback only. Its result must not contain credentials.
        try { return await consume({ username, password }); }
        catch { throw engineError('consume_failed'); }
      } finally { username = undefined; password = undefined; }
    },
  });
}
