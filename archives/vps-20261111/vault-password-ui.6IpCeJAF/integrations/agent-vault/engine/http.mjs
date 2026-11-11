import { engineError, readPrivateFile } from './private-file.mjs';

const MAX_RESPONSE = 65536;
const TIMEOUT_MS = 5000;

export function validateAddress(address) {
  try {
    const url = new URL(address);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        !['http:', 'https:'].includes(url.protocol) ||
        (url.protocol === 'http:' && !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))) throw 0;
    return url.origin;
  } catch { throw engineError('invalid_config'); }
}

export function validateVault(vaultName) {
  if (typeof vaultName !== 'string' || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(vaultName)) {
    throw engineError('invalid_config');
  }
  return vaultName;
}

// Internal only. This transport's parsed result may contain secrets.
export function createTransport({ address, tokenFile, fetchImpl = globalThis.fetch }) {
  const base = validateAddress(address);
  if (typeof fetchImpl !== 'function') throw engineError('invalid_config');
  return async function request(route, { method = 'GET', body, authenticated = true } = {}) {
    if (!route.startsWith('/') || route.startsWith('//')) throw engineError('invalid_config');
    let token;
    if (authenticated) {
      token = (await readPrivateFile(tokenFile, 8192)).replace(/\r?\n$/, '');
      if (!/^[\x21-\x7e]{1,8192}$/.test(token)) throw engineError('private_file_unavailable');
    }
    const controller = new AbortController();
    let timer;
    const operation = (async () => {
      const response = await fetchImpl(base + route, {
        method, redirect: 'error', signal: controller.signal, cache: 'no-store',
        headers: { Accept: 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw engineError(response.status === 401 || response.status === 403 ? 'capability_denied' :
          response.status === 404 ? 'credential_missing' : response.status >= 500 ? 'engine_unavailable' : 'request_rejected');
      }
      if (Number(response.headers.get('content-length')) > MAX_RESPONSE) {
        await response.body?.cancel().catch(() => {});
        throw engineError('invalid_response');
      }
      const reader = response.body?.getReader();
      if (!reader) throw engineError('invalid_response');
      const chunks = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          chunks.push(value);
          if (length > MAX_RESPONSE) throw engineError('invalid_response');
        }
        const bytes = Buffer.concat(chunks, length);
        try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch { throw engineError('invalid_response'); }
        finally { bytes.fill(0); }
      } finally {
        for (const chunk of chunks) chunk.fill(0);
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    })();
    try {
      // A race also bounds injected fetch implementations that ignore AbortSignal.
      return await Promise.race([operation, new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(engineError('engine_timeout'));
        }, TIMEOUT_MS);
      })]);
    } catch (error) {
      if (error?.name === 'EngineError') throw engineError(error.reasonCode);
      throw engineError(controller.signal.aborted ? 'engine_timeout' : 'engine_unavailable');
    } finally { clearTimeout(timer); token = undefined; }
  };
}
