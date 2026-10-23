// C05 only. No live credentials, browser calls or additional acceptance cases.
import assert from 'node:assert/strict';
import { createLoginController } from './controller.mjs';
let origin = 'https://app.clickup.com', credentialReads = 0, privateFills = 0;
const driver = {
  inspect:async()=>({origin,url:origin,owner:'agent',ownedByCaller:true}),
  fillLogin:async()=>{privateFills++;return {state:'ready'};},
  verifyIdentity:async()=>({matched:false}),
};
const credentials = {
  status:async()=>({state:'ready'}),
  findAccounts:async()=>({state:'accounts_ready',accounts:[{accountId:'dummy-account',name:'Dummy',username:'owner@example.invalid',origins:[origin],credentialRef:'DUMMY'}]}),
  withCredential:async()=>{credentialReads++;throw new Error('must_not_retrieve');},
};
const controller = createLoginController({credentials,driver});
const found = await controller.findAccounts({threadId:'dummy-thread',tabId:'dummy-tab',query:'Dummy'});
origin = 'https://wrong.example.invalid';
const denied = await controller.signIn({threadId:'dummy-thread',tabId:'dummy-tab',selectionId:found.accounts[0].selectionId});
assert.equal(denied.state,'denied');
assert.equal(denied.reasonCode,'origin_mismatch');
assert.equal(credentialReads,0);
assert.equal(privateFills,0);
console.log(JSON.stringify({case:'C05',state:'passed',credentialReads,privateFills,result:denied}));
