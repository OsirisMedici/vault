import { spawn } from 'node:child_process';
import { mkdir, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixedProvider } from './providers.mjs';
import { unwrap } from './transport.mjs';
import { browserFailure } from './failure.mjs';

function native(command,input) {
  return new Promise((resolve,reject) => {
    const child = spawn(command,[],{stdio:['pipe','pipe','ignore']});
    child.stdout.setEncoding('utf8');
    let data = '', failed = false;
    const timer = setTimeout(()=>{failed=true;child.kill();reject(new Error('clipboard_unavailable'));},5000);
    child.on('error',()=>{clearTimeout(timer);reject(new Error('clipboard_unavailable'));});
    child.stdin.on('error',()=>{});
    child.stdout.on('data',c=>{data+=c;if(data.length>1_048_576){failed=true;child.kill();reject(new Error('clipboard_unavailable'));}});
    child.on('close',code=>{clearTimeout(timer);if(!failed) code === 0 ? resolve(data) : reject(new Error('clipboard_unavailable'));});
    child.stdin.end(input ?? '');
  });
}
const nativeClipboard = {write:value=>native('/usr/bin/pbcopy',value),read:()=>native('/usr/bin/pbpaste'),clear:()=>native('/usr/bin/pbcopy','')};
let fillQueue = Promise.resolve();
const lockPath = join(tmpdir(),`osiris-agent-vault-browser-${process.getuid?.() ?? 'user'}.lock`);
const controlled = s => s?.control?.owner === 'unclaimed' || (s?.control?.owner === 'agent' && s.control.ownedByCaller === true);

export function createBrowserDriver({callTool,clipboard = nativeClipboard,now = Date.now}) {
  if (typeof callTool !== 'function') throw new Error('invalid_configuration');
  const call = async (name,args) => unwrap(await callTool(name,args));
  async function inspect({tabId,threadId} = {}) {
    const s = await call('preview_status',tabId ? {tabId} : {});
    if (!s?.available || (tabId && s.tabId !== tabId)) throw new Error('host_control_unavailable');
    if (threadId !== undefined) await checkThread(threadId,tabId);
    let origin = null;
    try { origin = new URL(s.url).origin; } catch { /* Blank tab is not a login origin. */ }
    return {origin,url:s.url,owner:s.control?.owner,ownedByCaller:s.control?.ownedByCaller,
      controlGeneration:s.control?.generation,blocked:!!(s.dialog || s.fileChooser)};
  }
  async function guard(tabId,p,generation,allowLoading = false) {
    const s = await call('preview_status',{tabId});
    if (!s?.available || s.tabId !== tabId || !controlled(s) || s.dialog || s.fileChooser) throw new Error('host_control_unavailable');
    if (new URL(s.url).origin !== p.origin) throw new Error('origin_mismatch');
    if (generation !== undefined && s.control.generation !== generation) throw new Error('host_control_unavailable');
    // Analytics/fonts can keep the load event pending after the document is ready.
    if (!allowLoading && s.loading && !await evaluate(tabId,`location.origin===${JSON.stringify(p.origin)}&&document.readyState!=='loading'`)) throw new Error('host_control_unavailable');
    return s.control.generation;
  }
  async function settle(tabId,p,generation) {
    const started = now();
    for (let i = 0; i < 40 && now() - started < 5000; i++) {
      await guard(tabId,p,generation,true);
      const s = await call('preview_status',{tabId});
      if (!s.loading || await evaluate(tabId,`location.origin===${JSON.stringify(p.origin)}&&document.readyState!=='loading'`)) return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('host_operation_failed');
  }
  async function checkThread(threadId,tabId) {
    let cursor;
    for (let i = 0; i < 4; i++) {
      const page = await call('t3_preview_list',{limit:50,...(cursor === undefined ? {} : {cursor})});
      const tab = page.sessions?.find(s=>s.tabId === tabId);
      if (tab) { if (tab.threadId !== threadId) throw new Error('host_control_unavailable'); return; }
      if (page.nextCursor == null) break;
      cursor = page.nextCursor;
    }
    throw new Error('host_control_unavailable');
  }
  async function evaluate(tabId,expression) { return (await call('preview_evaluate',{tabId,expression,returnByValue:true})).value; }
  const visible = `e => !!e && e.getClientRects().length > 0 && !e.disabled`;
  async function focusOkay(tabId,p,selector,type) {
    return evaluate(tabId,`(() => { if (location.origin !== ${JSON.stringify(p.origin)} || !document.hasFocus()) return false; const es = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(${visible}); const e = es[0]; return es.length === 1 && document.activeElement === e && e.type === ${JSON.stringify(type)} && !e.readOnly; })()`);
  }
  async function pageState(tabId,p) {
    // No input values, DOM text, cookies, URLs or native records leave this evaluation.
    return evaluate(tabId,`(() => { if (location.origin !== ${JSON.stringify(p.origin)}) return 'denied'; const text = document.body?.innerText || ''; if (/incorrect (email|password)|invalid (email|password|credentials)|wrong password|authentication failed/i.test(text)) return 'credentials_rejected'; const challenge=[...document.querySelectorAll('iframe[src*="bframe"],iframe[title*="challenge"],input[autocomplete="one-time-code"]')].some(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0); if (challenge || /verify your identity|verification code|new device|two.factor authentication|check your email/i.test(text)) return 'verification_required'; return 'ready'; })()`);
  }
  async function fillLogin({threadId,tabId,provider,username,password}) {
    const p = fixedProvider(provider);
    if (!p) return {state:'unsupported_provider'};
    if (!threadId || !tabId || typeof username !== 'string' || !username || typeof password !== 'string' || !password || username.length > 4096 || password.length > 65536) return {state:'denied',reasonCode:'invalid_request'};
    const run = async () => {
      let locked = false, held;
      const clearHeld = async () => { if (held !== undefined && await clipboard.read() === held) await clipboard.clear(); held = undefined; };
      try {
        await mkdir(lockPath,{mode:0o700}); locked = true;
        const generation = await guard(tabId,p);
        await checkThread(threadId,tabId);
        const state = await pageState(tabId,p);
        if (state !== 'ready') return {state,reasonCode:state === 'credentials_rejected' ? 'login_rejected' : 'owner_verification_required'};
        if (p.loginHash && !await evaluate(tabId,`location.hash === ${JSON.stringify(p.loginHash)}`)) throw new Error('form_unavailable');
        const paste = async (selector,type,value) => {
          await guard(tabId,p,generation);
          // A real preview click is required to focus the native WebContents.
          // DOM focus alone cannot receive macOS clipboard shortcuts reliably.
          await call('preview_click',{tabId,locator:selector,timeoutMs:3000});
          const focused = await evaluate(tabId,`(() => { if (location.origin!==${JSON.stringify(p.origin)}) return false; const es=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(${visible}); if(es.length!==1)return false; const e=es[0];e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(hit!==e&&!e.contains(hit))return false;e.focus();return document.activeElement===e;})()`);
          if (!focused) throw new Error('form_unavailable');
          await guard(tabId,p,generation);
          if (!await focusOkay(tabId,p,selector,type)) throw new Error('form_unavailable');
          await call('preview_press',{tabId,key:'A',modifiers:['Meta']});
          await call('preview_press',{tabId,key:'Backspace'});
          held = value;
          await clipboard.write(value);
          await guard(tabId,p,generation);
          if (!await focusOkay(tabId,p,selector,type)) throw new Error('form_unavailable');
          if (await clipboard.read() !== value) throw new Error('clipboard_unavailable');
          await call('preview_press',{tabId,key:'V',modifiers:['Meta']});
          await guard(tabId,p,generation);
          if (!await focusOkay(tabId,p,selector,type)) throw new Error('form_unavailable');
          const received = await evaluate(tabId,`(() => {const e=document.activeElement;return location.origin===${JSON.stringify(p.origin)}&&e?.matches(${JSON.stringify(selector)})&&typeof e.value==='string'&&e.value.length>0;})()`);
          if (!received) throw new Error('form_unavailable');
          await clearHeld();
        };
        await paste(p.username,p.usernameType ?? 'email',username);
        await paste(p.password,'password',password);
        await guard(tabId,p,generation);
        if (!await focusOkay(tabId,p,p.password,'password')) throw new Error('form_unavailable');
        // Require the unique submit button in the same form as the focused password.
        const formOkay = await evaluate(tabId,`(() => { if (location.origin !== ${JSON.stringify(p.origin)}) return false; const password = document.activeElement; const buttons = [...document.querySelectorAll(${JSON.stringify(p.submit)})].filter(${visible}).filter(e=>!${JSON.stringify(p.submitText ?? '')}||e.textContent.trim()===${JSON.stringify(p.submitText ?? '')}); if (!password?.matches(${JSON.stringify(p.password)}) || buttons.length !== 1) return false; if (${JSON.stringify(Boolean(p.loginContainer))}) { const card=password.closest(${JSON.stringify(p.loginContainer ?? '.v-card')}); const users=[...document.querySelectorAll(${JSON.stringify(p.username)})].filter(${visible}); return location.hash===${JSON.stringify(p.loginHash ?? null)} && !!card && users.length===1 && card.contains(users[0]) && card.contains(buttons[0]) && buttons[0].textContent.trim()===${JSON.stringify(p.submitText ?? null)}; } return !!password.form && buttons[0].form === password.form; })()`);
        if (!formOkay) throw new Error('form_unavailable');
        await guard(tabId,p,generation);
        const submitted = await evaluate(tabId,`(() => { if(location.origin!==${JSON.stringify(p.origin)})return false;const bs=[...document.querySelectorAll(${JSON.stringify(p.submit)})].filter(${visible}).filter(e=>!${JSON.stringify(p.submitText ?? '')}||e.textContent.trim()===${JSON.stringify(p.submitText ?? '')});if(bs.length!==1)return false;const b=bs[0];b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(hit!==b&&!b.contains(hit))return false;b.click();return true;})()`);
        if (!submitted) throw new Error('form_unavailable');
        // Do not follow or fill an additional authentication origin.
        await settle(tabId,p,generation);
        // SPA login requests can still be pending after the navigation settles.
        for (let i=0;i<20;i++) {
          await guard(tabId,p,generation,true);
          const pending = await evaluate(tabId,`[...document.querySelectorAll(${JSON.stringify(p.password)})].some(e=>e.getClientRects().length>0)`);
          if (!pending || await pageState(tabId,p) !== 'ready') break;
          await new Promise(resolve=>setTimeout(resolve,200));
        }
        await guard(tabId,p,generation);
        const after = await pageState(tabId,p);
        return {state:after,...(after === 'credentials_rejected' ? {reasonCode:'login_rejected'} : after === 'verification_required' ? {reasonCode:'owner_verification_required'} : {})};
      } catch (error) {
        return browserFailure(error);
      } finally {
        let cleanupFailed = false;
        try { await clearHeld(); } catch { cleanupFailed = true; }
        if (locked) await rmdir(lockPath).catch(()=>{});
        if (cleanupFailed) return {state:'host_unavailable',reasonCode:'clipboard_unavailable'};
      }
    };
    const pending = fillQueue.then(run,run); fillQueue = pending.catch(()=>{}); return pending;
  }
  async function verifyIdentity({tabId,provider,expectedUsername}) {
    const p = fixedProvider(provider);
    if (!p || !p.normalize(expectedUsername)) return {matched:false};
    try {
      const generation = await guard(tabId,p);
      const state = await pageState(tabId,p);
      if (state !== 'ready') return {matched:false,verificationRequired:state === 'verification_required'};
      if (p.identityKind === 'profile-input') {
        // Only a fixed profile link or fixed workspace path may be followed.
        const onProfile = await evaluate(tabId,`location.origin === ${JSON.stringify(p.origin)} && new RegExp(${JSON.stringify(p.identityPathPattern)}).test(location.pathname)`);
        if (!onProfile) {
          const workspace = p.workspacePattern ? await evaluate(tabId,`location.pathname.match(new RegExp(${JSON.stringify(p.workspacePattern)}))?.[1] ?? null`) : null;
          if (typeof workspace === 'string' && /^[0-9]+$/.test(workspace)) {
            await guard(tabId,p,generation);
            await call('preview_navigate',{tabId,url:p.origin+'/'+workspace+p.profileSuffix,readiness:'domContentLoaded'});
            await settle(tabId,p,generation);
          } else {
            const link = await evaluate(tabId,`[...document.querySelectorAll(${JSON.stringify(p.profile)})].filter(${visible}).length === 1`);
            if (!link) return {matched:false,verificationRequired:true};
            await guard(tabId,p,generation);
            await call('preview_click',{tabId,locator:p.profile,timeoutMs:3000});
            await settle(tabId,p,generation);
          }
        }
      }
      await guard(tabId,p,generation);
      // The fixed adapter returns only a bounded current-user email.
      const email = await evaluate(tabId,p.identityExpression());
      await guard(tabId,p,generation);
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {matched:false,verificationRequired:true};
      return {matched:p.normalize(email) === p.normalize(expectedUsername),observedUsername:email};
    } catch { return {matched:false,verificationRequired:true}; }
  }
  return {inspect,fillLogin,verifyIdentity};
}
