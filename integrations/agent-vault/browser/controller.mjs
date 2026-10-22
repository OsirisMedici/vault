import { randomUUID } from 'node:crypto';
import { publicResult, boundedText } from './public.mjs';
import { providerForOrigin } from './providers.mjs';

export function createLoginController({credentials, driver, now = Date.now, selectionTtlMs = 300_000}) {
  if (!credentials || !driver || !Number.isFinite(selectionTtlMs) || selectionTtlMs < 1 || selectionTtlMs > 300_000) throw new Error('invalid_configuration');
  const selections = new Map(), requests = new Map();
  let queue = Promise.resolve();
  const validBinding = p => p && ['threadId', 'tabId'].every(k => typeof p[k] === 'string' && p[k].length > 0 && p[k].length <= 256);
  const controlled = t => t && (t.owner === 'unclaimed' || (t.owner === 'agent' && t.ownedByCaller === true));
  const prune = () => { for (const [key, s] of selections) if (s.expires < now()) selections.delete(key); };
  const result = publicResult;
  async function status() {
    let c;
    try { c = await credentials.status(); } catch { return result({state:'engine_unavailable'}); }
    try {
      if (c?.state !== 'ready') return result({state: ['import_required','engine_unavailable','needs_private_unlock'].includes(c?.state) ? c.state : 'engine_unavailable'});
      await driver.inspect({});
      return result({state:'ready'});
    } catch { return result({state:'host_unavailable', reasonCode:'host_transport_unavailable'}); }
  }
  async function findAccounts(p) {
    if (!validBinding(p) || typeof p.query !== 'string' || p.query.length > 256) return result({state:'denied',reasonCode:'invalid_request'});
    try {
      const tab = await driver.inspect({tabId:p.tabId});
      if (!controlled(tab)) return result({state:'denied',reasonCode:'host_control_unavailable'});
      if (!providerForOrigin(tab.origin)) return result({state:'unsupported_provider',reasonCode:'unsupported_origin'});
      const found = await credentials.findAccounts({query:p.query,origin:tab.origin});
      if (found.state !== 'accounts_ready' || !Array.isArray(found.accounts)) return result({state:'engine_unavailable',reasonCode:'metadata_unavailable'});
      prune();
      // Bound the in-memory handle inventory as well as the public result.
      if (selections.size > 950) selections.clear();
      const accounts = found.accounts.filter(a => typeof a.accountId === 'string' && typeof a.name === 'string' && typeof a.username === 'string' && Array.isArray(a.origins) && a.origins.includes(tab.origin)).slice(0,50).map(a => {
        const selectionId = randomUUID();
        selections.set(selectionId, {threadId:p.threadId,tabId:p.tabId,origin:tab.origin,accountId:a.accountId,name:boundedText(a.name),username:a.username,expires:now()+selectionTtlMs});
        return {selectionId,name:a.name,username:a.username,origins:[tab.origin],supported:true};
      });
      return result({state:'accounts_ready',accounts,selectionRequired:accounts.length > 1});
    } catch { return result({state:'host_unavailable',reasonCode:'host_operation_failed'}); }
  }
  async function signIn(p) {
    if (!validBinding(p) || typeof p.selectionId !== 'string') return result({state:'denied',reasonCode:'invalid_request'});
    const s = selections.get(p.selectionId);
    // Consume even invalid bindings, so a handle cannot be probed then reused.
    selections.delete(p.selectionId);
    if (!s) return result({state:'denied',reasonCode:'selection_invalid'});
    if (s.expires <= now()) return result({state:'expired',reasonCode:'selection_expired'});
    if (s.threadId !== p.threadId || s.tabId !== p.tabId) return result({state:'denied',reasonCode:'selection_invalid'});
    const requestId = randomUUID(), request = {active:false,cancelled:false};
    requests.set(requestId,request);
    const run = async () => {
      if (request.cancelled) { requests.delete(requestId); return result({state:'cancelled',requestId,reasonCode:'cancelled'}); }
      request.active = true;
      try {
        const tab = await driver.inspect({tabId:p.tabId});
        if (s.expires <= now()) return result({state:'expired',requestId,reasonCode:'selection_expired'});
        if (tab.origin !== s.origin) return result({state:'denied',requestId,reasonCode:'origin_mismatch'});
        if (!controlled(tab)) return result({state:'denied',requestId,reasonCode:'host_control_unavailable'});
        const provider = providerForOrigin(s.origin);
        if (!provider) return result({state:'unsupported_provider',requestId,reasonCode:'unsupported_origin'});
        const fill = await credentials.withCredential({accountId:s.accountId,origin:s.origin}, async login => {
          if (login?.username !== s.username || typeof login?.password !== 'string' || !login.password) return {state:'denied',reasonCode:'credential_mismatch'};
          return driver.fillLogin({threadId:p.threadId,tabId:p.tabId,provider,username:login.username,password:login.password});
        });
        // A fill result can never assert signed_in. Only the verifier may do so.
        if (fill?.state !== 'ready') return result({state:['denied','host_unavailable','engine_unavailable','import_required','verification_required','credentials_rejected','needs_private_unlock'].includes(fill?.state) ? fill.state : 'failed',requestId,reasonCode:fill?.reasonCode});
        const verified = await driver.verifyIdentity({tabId:p.tabId,provider,expectedUsername:s.username});
        const after = await driver.inspect({tabId:p.tabId});
        if (after.origin !== s.origin || !controlled(after)) return result({state:'denied',requestId,reasonCode:'origin_mismatch'});
        if (verified?.matched === true && provider.normalize(verified.observedUsername) === provider.normalize(s.username)) return result({state:'signed_in',requestId,account:{name:s.name,username:s.username,origin:s.origin}});
        return result({state:'verification_required',requestId,reasonCode:verified?.verificationRequired ? 'owner_verification_required' : 'identity_unverified'});
      } catch { return result({state:'failed',requestId,reasonCode:'credential_unavailable'}); }
      finally { requests.delete(requestId); }
    };
    const pending = queue.then(run,run);
    queue = pending.catch(()=>{});
    return pending;
  }
  async function cancel({requestId} = {}) {
    if (requestId !== undefined && (typeof requestId !== 'string' || requestId.length > 80)) return result({state:'denied',reasonCode:'invalid_request'});
    const targets = requestId ? [requests.get(requestId)].filter(Boolean) : [...requests.values()];
    selections.clear();
    for (const r of targets) if (!r.active) r.cancelled = true;
    // The frozen driver interface cannot interrupt a native paste already underway.
    if (targets.some(r=>r.active)) return result({state:'denied',reasonCode:'request_in_progress'});
    return result({state:'cancelled',reasonCode:'cancelled'});
  }
  return {status,findAccounts,signIn,cancel};
}
