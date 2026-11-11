// Run after crayon.helpers.js inside the dedicated editable design file.
const V=storage.vault,C=V.colors;
V.screenBuilders={};
V.screenBuilders.invitePerson=()=>{
  const b=V.shell('invitePerson','D02 · Invite / person');
  V.heading(b,'Invite a person','One invitation for their workspaces and accounts.','INVITE PERSON');V.steps(b,0);
  V.field(b,'Email address','sam@example.com',280,342,640,'They will sign in with their own Vault account.');
  V.text(b,'Business role',280,504,640,14,C.text,500);V.badge(b,'Member',280,542,'neutral',100);
  V.text(b,'Members receive only the workspaces and accounts you select.',280,594,760,14,C.secondary);
  V.note(b,'You stay in control','Only you can invite people and manage access. Your owner role is protected.',280,680,1120,'info',88);
  V.footer(b,'people','Choose workspaces','inviteWorkspaces','Nothing is sent until you review and send.');return b;
};
V.screenBuilders.inviteWorkspaces=()=>{
  const b=V.shell('inviteWorkspaces','D03 · Invite / workspaces');
  V.heading(b,'Choose workspaces','Select where Sam will work. Account access comes next.','INVITE SAM · sam@example.com');V.steps(b,1);
  const p=V.panel(b,'Workspace selection',280,330,1120,352,C.canvas,null,0);
  V.workspaceRow(p,'AND Studio','Design, content and studio operations',0,true,null,'3 accounts');
  V.workspaceRow(p,'Scale','Marketing and client operations',108,true,null,'3 accounts');
  V.workspaceRow(p,'ILDL','Lighting projects and client delivery',216,false,null,'2 accounts');
  V.note(b,'Membership and account access are separate','Sam will join 2 workspaces. No accounts are shared until you select them.',280,698,1120,'info',88);
  V.footer(b,'invitePerson','Choose accounts','inviteAccounts','2 workspaces selected');return b;
};
V.screenBuilders.inviteAccounts=()=>{
  const b=V.shell('inviteAccounts','D04 · Invite / accounts');
  V.heading(b,'Choose permitted accounts','Share only what Sam needs. View allows revealing and copying the credentials.','INVITE SAM · sam@example.com');V.steps(b,2);
  V.text(b,'AND Studio',280,322,700,16,C.text,600);V.text(b,'2 of 3 accounts selected',1110,324,290,13,C.muted).align='right';
  const p=V.panel(b,'AND Studio account choices',280,360,1120,228,C.surface,C.border,8);
  V.accountRow(p,'Instagram · Studio','social@example.com',0,true,'View');
  V.accountRow(p,'Shared design library','design@example.com',76,true,'View');
  V.accountRow(p,'Studio email','studio@example.com',152,false);
  V.text(b,'Scale',280,620,700,16,C.text,600);V.text(b,'1 account selected',1110,622,290,13,C.muted).align='right';
  const q=V.panel(b,'Scale account choice',280,658,1120,76,C.surface,C.border,8);
  V.accountRow(q,'Hosting · Scale','hosting@example.com',0,true,'Edit and delete');
  V.text(b,'Editing an account never gives Sam permission to share it with someone else.',280,772,1050,13,C.muted);
  V.footer(b,'inviteWorkspaces','Review invitation','inviteReview','2 workspaces · 3 accounts');return b;
};
V.reviewRow=(b,name,sub,y,permission='View',status='Grant')=>{
  V.text(b,name,304,y,600,15,C.text,500);V.text(b,sub,304,y+28,670,13,C.muted);
  V.badge(b,permission,1050,y+6,'neutral',145);V.badge(b,status,1220,y+6,status==='Grant'?'success':'neutral',140);V.rule(b,y+66,304,1072);
};
V.screenBuilders.inviteReview=()=>{
  const b=V.shell('inviteReview','D05 · Invite / review');
  V.heading(b,'Review Sam’s access','One business invitation. These are the only accounts Sam will receive.','INVITE SAM · sam@example.com');V.steps(b,3);
  V.badge(b,'AND Studio',280,328,'neutral',130);V.badge(b,'Scale',422,328,'neutral',84);
  V.reviewRow(b,'Instagram · Studio','AND Studio',396);
  V.reviewRow(b,'Shared design library','AND Studio',488);
  V.reviewRow(b,'Hosting · Scale','Scale',580,'Edit and delete');
  V.note(b,'Sharing includes the full account item','Sam can reveal and copy shared credentials. Removing access later cannot erase a copy they already have.',280,714,1120,'warning',88);
  V.footer(b,'inviteAccounts','Send invitation','inviteSent','sam@example.com · 2 workspaces · 3 accounts');return b;
};
V.screenBuilders.inviteSent=()=>{
  const b=V.shell('inviteSent','D06 · Invitation sent','People','Invitation sent','Sam will receive one invitation to Osiris business.');
  const p=V.panel(b,'Invitation status',280,274,1120,328,C.surface,C.border,12);
  V.avatar(p,'ST',28,30,48);V.text(p,'Sam Taylor',96,31,700,20,C.text,600);V.text(p,'sam@example.com',96,66,700,14,C.muted);V.badge(p,'Invited',930,40,'warning',140);
  V.text(p,'1. Invitation sent',28,133,300,15,C.text,500);V.text(p,'2. Sam accepts',380,133,300,15,C.muted);V.text(p,'3. You confirm',732,133,300,15,C.muted);
  V.text(p,'Selected access',28,200,700,13,C.muted);V.text(p,'2 workspaces · 3 accounts',28,232,850,20,C.text,500);
  V.note(b,'Access is not active yet','After Sam accepts, confirm their identity from People to activate encrypted sharing.',280,646,1120,'info',88);
  V.button(b,'Back to People',280,778,180,'people');V.button(b,'View recipient flow',480,778,200,'recipient','secondary');return b;
};
V.personHeader=(b,name='Avery Chen',email='avery@example.com',active=true)=>{
  V.avatar(b,name==='Avery Chen'?'AC':'JB',280,116,52);V.text(b,name,350,112,660,30,C.text,600,46);V.text(b,email,350,159,600,14,C.muted);V.badge(b,active?'Active':'Awaiting confirmation',350,198,active?'success':'warning',active?75:190);
};
V.personAccounts=(b,after=false)=>{
  V.text(b,'Permitted accounts',280,484,700,20,C.text,600);V.text(b,after?'2 accounts':'3 accounts',1210,490,190,13,C.muted).align='right';
  const p=V.panel(b,'Effective account access',280,532,1120,after?178:266,C.surface,C.border,8);
  const row=(name,source,y,perm='View')=>{V.text(p,name,24,y+14,520,15,C.text,500);V.text(p,source,24,y+43,760,13,C.muted);V.badge(p,perm,904,y+25,'neutral',190);if(y<(after?88:176))V.rect(p,'Account separator',24,y+87,1072,1,C.border);};
  if(!after)row('Instagram · Studio','AND Studio',0);
  row('Shared design library',after?'Scale':'AND Studio + Scale',after?0:88);
  row('Hosting · Scale','Scale',after?88:176,'Edit and delete');
};
V.screenBuilders.person=()=>{
  const b=V.shell('person','D07 · Person / effective access');V.personHeader(b);V.button(b,'Edit access',1240,126,160,'editAccess');
  V.text(b,'Workspaces',280,282,800,20,C.text,600);
  const p=V.panel(b,'Workspace memberships',280,328,1120,108,C.surface,C.border,8);
  V.text(p,'AND Studio',24,22,450,16,C.text,500);V.text(p,'2 account grants',24,57,450,13,C.muted);
  V.text(p,'Scale',582,22,450,16,C.text,500);V.text(p,'2 account grants',582,57,450,13,C.muted);
  V.personAccounts(b);V.button(b,'View activity',280,850,160,'activity','secondary');V.button(b,'Remove from business',1160,850,240,'offboard','danger');return b;
};
V.drawEdit=(b,issue=null)=>{
  V.heading(b,'Edit Avery’s access','Change the selected workspace. Other memberships and grants stay as they are.','AVERY CHEN · avery@example.com');
  if(issue==='failed')V.note(b,'Changes could not be saved','Your selections are still here. No access changed. Try saving again.',280,240,1120,'danger',78);
  const top=issue==='failed'?350:270;
  const p=V.panel(b,'AND Studio removal',280,top,1120,176,C.surface,C.border,8);
  V.check(p,24,26,false);V.text(p,'AND Studio',62,21,650,18,C.text,600);V.badge(p,'Remove membership',866,22,'danger',228);
  V.text(p,'This will remove Avery’s 2 grants from AND Studio.',62,68,920,14,C.secondary);
  V.text(p,'Instagram · Studio will no longer be available. The shared design library remains available through Scale.',62,105,1005,14,C.muted,400,54);
  const q=V.panel(b,'Scale retained',280,top+200,1120,156,C.surface,C.border,8);
  V.check(q,24,26,true);V.text(q,'Scale',62,21,650,18,C.text,600);V.badge(q,'Unchanged',944,22,'neutral',150);
  V.text(q,'Shared design library · View',62,70,960,14,C.secondary);V.text(q,'Hosting · Scale · Edit and delete',62,104,960,14,C.secondary);
  V.footer(b,'person',issue==='failed'?'Try again':'Review changes','editReview','1 workspace removed · Scale remains active');
};
V.screenBuilders.editAccess=()=>{const b=V.shell('editAccess','D08 · Edit / remove one workspace');V.drawEdit(b);return b;};
V.screenBuilders.editReview=()=>{
  const b=V.shell('editReview','D09 · Review / retained access','People','Review access changes','Only AND Studio will change. Scale and its account grants stay active.');
  V.note(b,'Remove AND Studio membership','Avery loses 2 grants from this workspace. Their Scale membership remains active.',280,246,1120,'warning',88);
  const p=V.panel(b,'Before and after review',280,366,1120,300,C.surface,C.border,8);
  V.text(p,'ACCOUNT',24,18,600,11,C.muted,500);V.text(p,'AFTER SAVING',746,18,340,11,C.muted,500);
  V.text(p,'Instagram · Studio',24,70,600,16,C.text,500);V.text(p,'Previously shared through AND Studio',24,101,650,13,C.muted);V.badge(p,'No access',844,77,'danger',240);
  V.rect(p,'Review divider',24,145,1072,1,C.border);
  V.text(p,'Shared design library',24,169,650,16,C.text,500);V.text(p,'AND Studio grant removed. Scale grant retained.',24,201,700,13,C.muted);V.badge(p,'View through Scale',844,178,'success',240);
  V.text(p,'Hosting · Scale keeps Edit and delete access.',24,258,1020,13,C.secondary);
  V.text(b,'Removing one grant does not remove access provided by another workspace.',280,708,1100,14,C.secondary);
  V.footer(b,'editAccess','Save changes','saved','1 account loses access · 1 remains through Scale');return b;
};
V.screenBuilders.saved=()=>{
  const b=V.shell('saved','D10 · Access saved');V.personHeader(b);V.button(b,'Edit access',1240,126,160,'editAccess');
  V.text(b,'Workspaces',280,282,800,20,C.text,600);const p=V.panel(b,'Remaining membership',280,328,1120,108,C.surface,C.border,8);
  V.text(p,'Scale',24,22,900,16,C.text,500);V.text(p,'2 account grants',24,57,900,13,C.muted);V.badge(p,'Active',966,36,'success',130);
  V.personAccounts(b,true);V.toast(b,'Access updated','AND Studio was removed. Scale and its 2 permitted accounts are unchanged.');V.button(b,'Back to People',280,854,180,'people','secondary');return b;
};
V.screenBuilders.confirm=()=>{
  const b=V.shell('confirm','D11 · Confirm a teammate');V.personHeader(b,'Jordan Blake','jordan@example.com',false);
  V.note(b,'Jordan has accepted the invitation','Confirm this is the person you intended to invite before activating encrypted sharing.',280,270,1120,'warning',88);
  const p=V.panel(b,'Identity confirmation',280,390,1120,268,C.surface,C.border,8);
  V.text(p,'Verify Jordan’s fingerprint phrase',24,25,1020,18,C.text,600);V.text(p,'Compare this phrase with Jordan through a trusted conversation.',24,62,1020,14,C.secondary);
  V.rect(p,'Fingerprint phrase',24,109,1072,60,C.canvas,8,C.border);V.text(p,'cedar  ·  lantern  ·  meadow  ·  orbit  ·  pebble',44,126,1032,18,C.text,500,28);
  V.text(p,'Selected access: AND Studio + Scale · 3 accounts',24,205,1020,14,C.secondary);
  V.button(b,'Cancel',1000,730,120,'people','secondary');V.button(b,'Confirm identity',1140,730,260,'confirmed');
  V.text(b,'Your vault must be unlocked to complete confirmation.',280,750,670,13,C.muted);return b;
};
V.screenBuilders.confirmed=()=>{
  const b=V.shell('confirmed','D12 · Confirmation complete','People','Jordan is ready to work','Encrypted account sharing is active after the next sync.');
  V.note(b,'Identity confirmed','Jordan can access 3 selected accounts in AND Studio and Scale. No other accounts were shared.',280,278,1120,'success',104);
  V.text(b,'What Jordan can do',280,442,900,20,C.text,600);
  V.text(b,'Open their permitted accounts in Vault or a compatible client.\nReveal and copy shared credentials.\nEdit and delete only where you selected that permission.',280,498,1000,16,C.secondary,400,126);
  V.button(b,'Back to People',280,704,190,'people');V.button(b,'View teammate experience',490,704,260,'member','secondary');return b;
};
V.screenBuilders.workspaces=()=>{
  const b=V.shell('workspaces','D13 · Workspaces','Workspaces','Workspaces','Organize business accounts. Choose each person’s access from People.');
  V.button(b,'New workspace',1210,116,190,'createWorkspace');
  [['AND Studio','Design and studio operations','3 accounts','2 members'],['Scale','Marketing and client operations','3 accounts','3 members'],['ILDL','Lighting projects and client delivery','2 accounts','Owner only']].forEach((r,i)=>{
    const y=276+i*142,p=V.panel(b,'Workspace / '+r[0],280,y,1120,114,C.surface,C.border,9);
    V.text(p,r[0],24,20,700,20,C.text,600);V.text(p,r[1],24,56,700,14,C.muted);V.badge(p,r[2],770,40,'neutral',130);V.badge(p,r[3],920,40,'neutral',170);V.link(p,'workspace');
  });V.text(b,'New workspaces do not grant anyone access automatically.',280,756,1100,14,C.secondary);return b;
};
V.screenBuilders.workspace=()=>{
  const b=V.shell('workspace','D14 · Workspace / account inventory','Workspaces','AND Studio','Design, content and studio operations.');
  V.button(b,'Manage people',1220,116,180,'people','secondary');V.badge(b,'3 accounts',280,232,'neutral',130);V.badge(b,'2 members',422,232,'neutral',130);
  V.rect(b,'Account table header',280,306,1120,44,C.surface,7);V.text(b,'ACCOUNT',304,320,760,11,C.muted,500);V.text(b,'SHARED WITH',1040,320,300,11,C.muted,500);
  [['Instagram · Studio','social@example.com','Avery Chen'],['Shared design library','design@example.com','Avery Chen'],['Studio email','studio@example.com','Owner only']].forEach((r,i)=>{
    const y=374+i*96;V.text(b,r[0],304,y,700,16,C.text,500);V.text(b,r[1],304,y+30,700,13,C.muted);V.badge(b,r[2],1040,y+14,'neutral',220);V.rule(b,y+77);
  });V.note(b,'Accounts can appear in more than one workspace','Shared design library also appears in Scale. A person may retain access through that workspace.',280,720,1120,'info',88);return b;
};
V.screenBuilders.member=()=>{
  const b=V.board('member','D15 · Teammate / permitted accounts'),c=C;
  V.rect(b,'Member sidebar',0,0,232,960,c.sidebar);V.text(b,'Vault',28,28,180,25,c.text,600,40);V.text(b,'Osiris business',28,110,180,14,c.text,500);
  V.rect(b,'Selected nav',12,184,208,44,c.hover,7);V.text(b,'Shared with me',28,195,180,14,c.text,500);V.text(b,'WORKSPACES',28,276,180,11,c.quiet,600);V.text(b,'AND Studio',28,320,180,14,c.secondary);V.text(b,'Scale',28,366,180,14,c.secondary);
  V.avatar(b,'AC',24,882,34);V.text(b,'Avery Chen',70,885,140,14,c.text,500);V.text(b,'Business / Shared with me',280,34,900,13,c.muted);V.rule(b,79,232,1208);
  V.heading(b,'Shared with me','Your permitted accounts from AND Studio and Scale.');
  V.field(b,'','Search permitted accounts',280,206,640);
  [['Instagram · Studio','AND Studio','View'],['Shared design library','AND Studio + Scale','View'],['Hosting · Scale','Scale','Edit and delete']].forEach((r,i)=>{
    const y=326+i*128,p=V.panel(b,'Permitted account / '+r[0],280,y,1120,104,c.surface,c.border,9);
    V.text(p,r[0],24,18,800,18,c.text,500);V.text(p,r[1],24,54,800,13,c.muted);V.badge(p,r[2],900,34,'neutral',190);V.link(p,'account');
  });V.text(b,'Need another account? Ask Osiris to update your access.',280,770,1000,14,c.secondary);return b;
};
V.screenBuilders.account=()=>{
  const b=V.memberSidebar(V.shell('account','D16 · Shared account / view','My vault','Shared design library','Available through AND Studio and Scale.'));
  V.badge(b,'View',280,236,'neutral',100);V.text(b,'You can reveal and copy this shared account. You cannot edit or share it.',400,241,1000,14,C.secondary);
  const p=V.panel(b,'Encrypted item view',280,304,1120,346,C.surface,C.border,9);
  V.text(p,'Username',24,25,900,13,C.muted);V.text(p,'design@example.com',24,57,900,18,C.text,500);
  V.text(p,'Password',24,119,900,13,C.muted);V.text(p,'••••••••••••••••',24,153,700,20,C.text,500);V.button(p,'Reveal',908,142,180,'accountRevealed','secondary');
  V.text(p,'Website',24,227,900,13,C.muted);V.text(p,'https://design.example.com',24,261,1020,16,C.secondary);
  V.button(b,'Back to shared accounts',280,710,250,'member','secondary');return b;
};
V.screenBuilders.accountRevealed=()=>{
  const b=V.memberSidebar(V.shell('accountRevealed','D17 · Shared account / revealed example','My vault','Shared design library','Available through AND Studio and Scale.'));
  V.note(b,'Sample credential only','This prototype uses fictional data. A real shared account can be revealed by its permitted recipient.',280,244,1120,'info',88);
  const p=V.panel(b,'Revealed sample item',280,372,1120,220,C.surface,C.border,9);
  V.text(p,'Password',24,25,900,13,C.muted);V.text(p,'example-password-not-a-secret',24,66,900,20,C.text,500);V.button(p,'Hide',908,58,180,'account','secondary');
  V.text(p,'Website',24,130,900,13,C.muted);V.text(p,'https://design.example.com',24,163,1020,16,C.secondary);V.button(b,'Back to shared accounts',280,662,250,'member','secondary');return b;
};
V.screenBuilders.offboard=()=>{
  const b=V.shell('offboard','D18 · Remove from business','People','Remove Avery from business?','This removes all access provided by Osiris business.');
  const p=V.panel(b,'Business removal confirmation',280,270,1120,344,C.surface,C.border,12);
  V.text(p,'Avery Chen',28,28,950,22,C.text,600);V.text(p,'avery@example.com',28,67,950,14,C.muted);
  V.text(p,'Will be removed',28,126,950,15,C.danger,600);V.text(p,'2 workspace memberships\nAll business account grants\nAny pending business access',28,164,1000,16,C.secondary,400,100);
  V.text(p,'Their personal vault and other business memberships stay intact.',28,288,1030,14,C.secondary);
  V.note(b,'Review provider access too','Vault cannot erase copied passwords or close website sessions. Rotate sensitive credentials and revoke provider sessions separately.',280,646,1120,'warning',98);
  V.button(b,'Keep access',974,800,156,'person','secondary');V.button(b,'Remove from business',1150,800,250,'removed','danger');return b;
};
V.screenBuilders.removed=()=>{
  const b=V.shell('removed','D19 · Business access removed','People','Avery’s access was removed','Their personal vault and memberships in other businesses are unchanged.');
  V.note(b,'Business membership revoked','Avery can no longer retrieve shared business accounts. This does not erase copies already on their devices.',280,278,1120,'success',98);
  V.text(b,'If Avery returns',280,442,900,22,C.text,600);V.text(b,'Invite them again and review their current workspace and account selections.\nTheir previous grants will not be restored automatically.',280,494,1040,16,C.secondary,400,80);V.button(b,'Back to People',280,664,190,'people');return b;
};
V.screenBuilders.activity=()=>{
  const b=V.shell('activity','D20 · Activity / access changes','Activity','Activity','A record of invitations, confirmations and access changes.');
  [['Today, 10:42','You removed AND Studio access for Avery','Scale and its 2 account grants were retained.'],['Today, 10:30','You confirmed Jordan’s identity','3 selected accounts became active after sync.'],['Today, 10:12','You invited Sam Taylor','2 workspaces · 3 accounts · awaiting acceptance.'],['Yesterday, 16:20','You added Hosting · Scale for Avery','Edit and delete access granted in Scale.']].forEach((r,i)=>{
    const y=276+i*124;V.text(b,r[0],280,y,210,13,C.muted);V.text(b,r[1],520,y,850,16,C.text,500);V.text(b,r[2],520,y+36,850,14,C.secondary);V.rule(b,y+94);
  });V.text(b,'Activity records access changes. It does not record passwords or secret values.',280,822,1100,13,C.muted);return b;
};
V.screenBuilders.owner=()=>{
  const b=V.shell('owner','D21 · Settings / protected owner','Settings','Business settings','One business. Multiple workspaces. You remain the owner.');
  const p=V.panel(b,'Protected business owner',280,278,1120,242,C.surface,C.border,10);V.avatar(p,'OM',28,30,48);V.text(p,'Osiris Medici',96,28,900,21,C.text,600);V.text(p,'Business owner',96,66,900,14,C.muted);V.badge(p,'Protected',920,40,'neutral',160);
  V.text(p,'Your owner role cannot be changed from People.',28,124,1040,16,C.text,500);V.text(p,'Ownership transfer and recovery require a separate reviewed process.',28,164,1040,14,C.secondary);
  V.note(b,'New workspaces start private','Creating a workspace does not grant other people access. Choose memberships and accounts from People.',280,570,1120,'info',92);V.button(b,'Manage people',280,734,190,'people');return b;
};
V.screenBuilders.recipient=()=>{
  const b=V.board('recipient','D22 · Recipient / accept invitation');V.text(b,'Vault',80,54,1000,28,C.text,600,44);V.text(b,'INVITATION',80,180,1100,12,C.muted,600);
  V.text(b,'Join Osiris business',80,222,1160,44,C.text,600,66);V.text(b,'Osiris invited sam@example.com to work together in Vault.',80,310,1160,20,C.secondary,400,48);
  const p=V.panel(b,'Invitation scope',80,414,1280,204,C.surface,C.border,12);V.text(p,'Your selected access',28,28,1200,20,C.text,600);V.text(p,'AND Studio + Scale',28,79,1200,24,C.text,500,40);V.text(p,'3 permitted accounts · Shared after identity confirmation',28,135,1200,16,C.secondary);
  V.text(b,'Sign in as sam@example.com to accept. Use your own Vault account.',80,675,1200,16,C.secondary);V.button(b,'Sign in and accept',80,742,280,'recipientWaiting');V.button(b,'Invitation problem?',384,742,220,'inviteInvalid','secondary');
  V.text(b,'Existing sign-in and MFA screens remain part of the secure Vault login flow.',80,848,1220,13,C.muted);return b;
};
V.screenBuilders.recipientWaiting=()=>{
  const b=V.board('recipientWaiting','D23 · Recipient / awaiting confirmation');V.text(b,'Vault',80,54,1000,28,C.text,600,44);V.badge(b,'Awaiting confirmation',80,190,'warning',210);
  V.text(b,'You’re almost ready',80,254,1240,44,C.text,600,66);V.text(b,'Osiris needs to confirm your identity before accounts can be shared.',80,346,1200,22,C.secondary,400,70);
  const p=V.panel(b,'Recipient fingerprint phrase',80,474,1280,190,C.surface,C.border,12);V.text(p,'Share your fingerprint phrase with Osiris',28,28,1200,20,C.text,600);V.text(p,'cedar  ·  lantern  ·  meadow  ·  orbit  ·  pebble',28,87,1200,24,C.text,500,48);
  V.text(b,'No shared accounts are available yet. Your personal vault is still yours.',80,720,1240,16,C.secondary);V.button(b,'View active sample',80,796,240,'member','secondary');return b;
};
V.build=key=>{
  if(V.boards[key]?.getPluginData('vault-complete')==='true')return {key,id:V.boards[key].id,alreadyBuilt:true};
  if(!V.screenBuilders[key])throw new Error('Unknown screen: '+key);
  const b=V.screenBuilders[key]();b.setPluginData('vault-complete','true');return {key,id:b.id,shapes:crayonUtils.findShapes(()=>true,b).length};
};
return {screenRecipes:Object.keys(V.screenBuilders)};
