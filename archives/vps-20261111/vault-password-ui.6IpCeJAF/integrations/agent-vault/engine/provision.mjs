import { open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, validateVault } from './http.mjs';
import { engineError, loadEngineConfig } from './private-file.mjs';

// Explicit manager-run operation on a NEW companion vault. No automatic startup hook.
export async function provisionVault(config, proxyTokenFile) {
  validateVault(config.vaultName);
  if (!path.isAbsolute(proxyTokenFile) || path.dirname(proxyTokenFile) !== path.dirname(config.tokenFile) ||
      proxyTokenFile === config.tokenFile) throw engineError('invalid_config');
  const request = createTransport(config);
  // Refuse existing vaults rather than changing imported data or existing policy.
  const listed = await request('/v1/vaults');
  if (!Array.isArray(listed?.vaults) || listed.vaults.some(v => v.name === config.vaultName)) {
    throw engineError('request_rejected');
  }
  // Reserve output first: do not mint an inaccessible token or overwrite an agent's capability.
  let output;
  try {
    output = await open(proxyTokenFile, 'wx', 0o600);
    await request('/v1/admin/settings', { method: 'PUT', body: { invite_only: true } });
    const gate = await request('/v1/admin/settings');
    if (gate.invite_only !== true) throw engineError('invalid_response');
    await request('/v1/vaults', { method: 'POST', body: { name: config.vaultName } });
    const route = `/v1/vaults/${encodeURIComponent(config.vaultName)}/settings`;
    await request(route, { method: 'PATCH', body: { unmatched_host_policy: 'deny' } });
    const settings = await request(route);
    if (settings.unmatched_host_policy !== 'deny') throw engineError('invalid_response');
    const services = await request(`/v1/vaults/${encodeURIComponent(config.vaultName)}/services`);
    if (!services.services || Object.keys(services.services).length !== 0) throw engineError('invalid_response');
    const session = await request('/v1/sessions', { method: 'POST', body: {
      vault: config.vaultName, vault_role: 'proxy', ttl_seconds: 3600, label: 'vault-companion-proxy',
    } });
    if (typeof session.token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(session.token)) {
      throw engineError('invalid_response');
    }
    await output.writeFile(`${session.token}\n`);
    await output.sync();
    return { state: 'ready', proxyExpiresAt: session.expires_at };
  } catch (error) {
    // Partial provisioning remains private and stopped for operator review. Never retry blindly.
    if (error?.name === 'EngineError') throw engineError(error.reasonCode);
    throw engineError('request_rejected');
  } finally { await output?.close().catch(() => {}); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const config = await loadEngineConfig(process.argv[2]);
    await provisionVault(config, process.argv[3]);
    console.log(JSON.stringify({ state: 'ready', reasonCode: 'new_vault_provisioned' }));
  } catch {
    console.log(JSON.stringify({ state: 'failed', reasonCode: 'provisioning_incomplete' }));
    process.exitCode = 1;
  }
}
