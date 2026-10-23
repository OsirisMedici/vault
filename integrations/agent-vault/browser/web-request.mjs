// Trusted chat host only. Browser-facing bridge code never imports this module.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readPrivateFile } from '../engine/private-file.mjs';
import { createTransport } from '../engine/http.mjs';
import { createLoginController } from './controller.mjs';
import { providerForOrigin } from './providers.mjs';
import { publicResult } from './public.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function workerTransport() {
  const config = JSON.parse(await readPrivateFile(join(homedir(), '.config/osiris-agent-vault/integration-v1/web-bridge.json')));
  if (config.version !== 1 || config.address !== 'http://127.0.0.1:19433' ||
      typeof config.tokenFile !== 'string' || Object.keys(config).some(k => !['version','address','tokenFile'].includes(k))) throw new Error('invalid_configuration');
  return createTransport(config);
}

export async function executeWebRequest({credentials,driver,requestId,threadId,tabId}) {
  if (!uuid(requestId)) return publicResult({state:'denied',reasonCode:'invalid_request'});
  let request, job, completed = false;
  try {
    request = await workerTransport();
    job = await request('/worker/claim',{method:'POST',body:{requestId}});
    const provider = providerForOrigin(job?.origin);
    if (!job || job.requestId !== requestId || job.state !== 'working' ||
        typeof job.accountId !== 'string' || job.accountId.length > 256 ||
        typeof job.username !== 'string' || !provider || provider.id !== job.provider ||
        !Number.isFinite(Date.parse(job.expiresAt)) || Date.parse(job.expiresAt) <= Date.now()) throw new Error('selection_invalid');
    const tab = await driver.inspect({tabId});
    if (tab.origin !== job.origin) throw new Error('origin_mismatch');
    // An imported item may share its username with another item. Bind the
    // exact UI-selected account ID before issuing the controller's opaque handle.
    const scoped = {
      status: () => credentials.status(),
      async findAccounts(args) {
        const result = await credentials.findAccounts(args);
        return {...result,accounts:result.accounts?.filter(a => a.accountId === job.accountId && a.username === job.username)};
      },
      withCredential(args,consume) {
        if (args.accountId !== job.accountId || args.origin !== job.origin) throw new Error('selection_invalid');
        return credentials.withCredential(args,consume);
      },
    };
    const controller = createLoginController({credentials:scoped,driver});
    const found = await controller.findAccounts({threadId,tabId,query:job.username});
    if (found.state !== 'accounts_ready' || found.accounts?.length !== 1) throw new Error('selection_invalid');
    const result = await controller.signIn({threadId,tabId,selectionId:found.accounts[0].selectionId});
    const verified = result.state === 'signed_in' && result.account?.origin === job.origin &&
      provider.normalize(result.account.username) === provider.normalize(job.username);
    const state = verified ? 'signed_in' : ['verification_required','credentials_rejected'].includes(result.state) ? result.state : 'failed';
    await request('/worker/complete',{method:'POST',body:{requestId,state,identityVerified:verified}});
    completed = true;
    return publicResult({state,requestId,reasonCode:result.reasonCode,
      ...(verified ? {account:result.account} : {})});
  } catch {
    if (request && job && !completed) {
      try { await request('/worker/complete',{method:'POST',body:{requestId,state:'failed',identityVerified:false}}); } catch { /* Expiry/cancellation remains authoritative. */ }
    }
    return publicResult({state:'failed',requestId,reasonCode:'host_operation_failed'});
  }
}
