import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createLoginController } from './controller.mjs';
import { fixedProvider, providerForOrigin, supportedOrigins } from './providers.mjs';
import { publicResult } from './public.mjs';
import { getT3TransportReadiness } from './transport.mjs';
import { executeWebRequest } from './web-request.mjs';

// One aggregate synthetic acceptance allocation. No runtime/private factory imports,
// external tools, real clipboard, provider requests or native browser interaction.
test('B2: tab lifecycle gates and existing provider contracts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-browser-v2-'));
  const previousTemp = process.env.TMPDIR;
  process.env.TMPDIR = directory;
  let createBrowserDriver;
  try { ({ createBrowserDriver } = await import('./driver.mjs')); }
  finally {
    if (previousTemp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTemp;
  }
  try {
    assert.deepEqual(supportedOrigins, ['https://app.clickup.com', 'https://app.godial.cc']);
    assert.equal(getT3TransportReadiness({ env: {} }).configured, false);
    const username = 'selected@example.invalid', password = 'synthetic-only-no-real-credential';
    const binding = { threadId:'fixture-thread', tabId:'fixture-tab' };
    const hazards = [
      tab => { tab.available = false; },
      tab => { tab.tabId = 'replacement-tab'; },
      tab => { tab.url = 'https://wrong.example.invalid'; },
      tab => { tab.url += '/changed'; },
      tab => { tab.control.owner = 'human'; },
      tab => { tab.control.ownedByCaller = false; },
      tab => { tab.control.generation++; },
      tab => { tab.threadId = 'another-thread'; },
      tab => { tab.dialog = { type:'alert' }; },
    ];
    let blockedSelections = 0, blockedEngineRaces = 0, verifiedProviders = 0;
    function fixture(provider, { onRead, observed = username, fillMode = false } = {}) {
      const tab = { available:true, ...binding,
        url:provider.origin + (provider.id === 'clickup' ? '/123/settings/profile' : '/#/home'),
        control:{ owner:'agent', ownedByCaller:true, generation:7 } };
      const calls = [];
      const element = { value:observed, textContent:'Profile', getClientRects:()=>[{}] };
      const document = {
        body:{ innerText:'' },
        querySelectorAll(selector) {
          if (selector === 'h4') return [{ ...element, textContent:'Hello!' }];
          if (selector === provider.identity || selector === 'h1,h2,[role="heading"]') return [element];
          return [];
        },
        querySelector:()=>({ __vue__:{ $store:{ getters:{ user:{ email:observed } } } } }),
      };
      const driver = createBrowserDriver({
        clipboard:{ write:async()=>assert.fail('unexpected clipboard write'), read:async()=>'', clear:async()=>{} },
        async callTool(name,args) {
          calls.push({ name,args });
          if (name === 'preview_status') return structuredClone(tab);
          if (name === 't3_preview_list') return { sessions:[{ tabId:tab.tabId,threadId:tab.threadId }] };
          if (name === 'preview_evaluate') {
            if (fillMode) return { value:args.expression.includes('const text =') ? 'ready' : true };
            return { value:runInNewContext(args.expression,{ location:new URL(tab.url), document }) };
          }
          if (fillMode && ['preview_click','preview_press'].includes(name)) return {};
          assert.fail('unexpected browser mutation');
        },
      });
      let reads = 0, fills = 0;
      const credentials = {
        status:async()=>({ state:'ready' }),
        findAccounts:async()=>({ state:'accounts_ready', accounts:['selected','other'].map(accountId=>({
          accountId,name:accountId,username,origins:[provider.origin],credentialRef:'SYNTHETIC',
        })) }),
        async withCredential(args, consume) {
          assert.equal(args.accountId, 'selected');
          assert.equal(args.origin, provider.origin);
          reads++; onRead?.(tab);
          return consume({ username,password });
        },
      };
      const controller = createLoginController({ credentials, driver:{ ...driver,
        fillLogin:async()=>{ fills++; return { state:'ready' }; },
      } });
      return { tab,calls,driver,credentials,controller,counts:()=>({ reads,fills }) };
    }
    for (const origin of supportedOrigins) {
      const provider = providerForOrigin(origin);
      assert.ok(Object.isFrozen(provider));
      assert.equal(provider.normalize(' SELECTED@EXAMPLE.INVALID '), username);
      assert.equal(fixedProvider({ id:provider.id,origin:'https://evil.example.invalid',username:'input.attacker' }), provider);
      assert.equal(providerForOrigin(origin + '.evil.example.invalid'), undefined);
      assert.equal(fixedProvider('unapproved'), undefined);
      assert.equal(provider.password, provider.id === 'clickup' ? 'input#password-input' : 'input[type="password"]');
      assert.equal(provider.username, provider.id === 'clickup' ? 'input#login-email-input' : 'input[type="text"]');
      for (const hazard of hazards) {
        const f = fixture(provider);
        const found = await f.controller.findAccounts({ ...binding,query:'selected' });
        assert.equal(found.selectionRequired, true);
        hazard(f.tab);
        const denied = await f.controller.signIn({ ...binding,selectionId:found.accounts[0].selectionId });
        assert.ok(['denied','host_unavailable'].includes(denied.state));
        assert.deepEqual(f.counts(), { reads:0,fills:0 });
        assert.equal((await f.controller.signIn({ ...binding,selectionId:found.accounts[0].selectionId })).reasonCode, 'selection_invalid');
        assert.ok(f.calls.every(c => ['preview_status','t3_preview_list'].includes(c.name)));
        blockedSelections++;
      }
      // Tab changes during asynchronous engine I/O cannot reach the fill function.
      for (const hazard of hazards) {
        const f = fixture(provider, { onRead:hazard });
        const found = await f.controller.findAccounts({ ...binding,query:'selected' });
        const denied = await f.controller.signIn({ ...binding,selectionId:found.accounts[0].selectionId });
        assert.equal(denied.state, 'denied');
        assert.deepEqual(f.counts(), { reads:1,fills:0 });
        blockedEngineRaces++;
      }
      const f = fixture(provider);
      const found = await f.controller.findAccounts({ ...binding,query:'selected' });
      const verified = await f.controller.signIn({ ...binding,selectionId:found.accounts[0].selectionId });
      assert.equal(verified.state, 'signed_in');
      assert.deepEqual(f.counts(), { reads:1,fills:1 });
      const wrong = fixture(provider, { observed:'other@example.invalid' });
      assert.equal((await wrong.driver.verifyIdentity({ ...binding,provider,expectedUsername:username })).matched, false);
      const login = fixture(provider, { fillMode:true });
      const writes = [], presses = [];
      let held = '';
      const driver = createBrowserDriver({
        async callTool(name,args) {
          if (name === 'preview_status') return structuredClone(login.tab);
          if (name === 't3_preview_list') return { sessions:[binding] };
          if (name === 'preview_evaluate') return { value:args.expression.includes('const text =') ? 'ready' : true };
          if (name === 'preview_press') presses.push(args.key);
          assert.ok(!JSON.stringify(args).includes(password));
          assert.ok(!JSON.stringify(args).includes(username));
          return {};
        },
        clipboard:{
          async write(value) { held = value; writes.push(value); login.tab.control.owner = 'human'; },
          read:async()=>held,
          clear:async()=>{ held = ''; },
        },
      });
      const denied = await driver.fillLogin({ ...binding,provider,username,password });
      assert.equal(denied.reasonCode, 'host_control_unavailable');
      assert.deepEqual(writes, [username]);
      assert.ok(!presses.includes('V'));
      assert.equal(held, '');
      // Preflight must stop before reading the private worker config or claiming.
      login.tab.available = false;
      const web = await executeWebRequest({ credentials:login.credentials,driver:login.driver,
        requestId:'00000000-0000-4000-8000-000000000001',...binding });
      assert.equal(web.state, 'denied');
      assert.equal(web.reasonCode, 'host_control_unavailable');
      assert.deepEqual(login.counts(), { reads:0,fills:0 });
      verifiedProviders++;
    }
    assert.deepEqual(publicResult({ state:'failed',reasonCode:'private error',password }), { state:'failed' });
    console.log(JSON.stringify({ case:'B2',state:'passed',blockedSelections,blockedEngineRaces,
      verifiedProviders,realProviderCalls:0,nativeClipboardCalls:0 }));
  } finally { await rm(directory, { recursive:true,force:true }); }
});
