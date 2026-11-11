const V=storage.vault,C=V.colors;
Object.assign(V.screenBuilders,{
  empty:()=>{
    const b=V.shell('empty','S01 · People / first teammate','People','People','Keep business access in one place.');
    V.text(b,'Your business starts with you',280,312,1080,28,C.text,600,46);
    V.text(b,'Invite a teammate once, then choose their workspaces and permitted accounts.\nYour personal vault stays private.',280,378,1000,17,C.secondary,400,84);
    V.button(b,'Invite your first person',280,506,260,'invitePerson');V.badge(b,'Osiris Medici · Owner protected',280,624,'neutral',310);return b;
  },
  failed:()=>{const b=V.shell('failed','S02 · Save failed / draft preserved');V.drawEdit(b,'failed');return b;},
  stale:()=>{
    const b=V.shell('stale','S03 · Stale revision / compare again','People','Access changed while you were editing','Review the latest access before saving your changes.');
    V.note(b,'Your changes were not applied','Another update changed Avery’s access. Your draft is preserved and nothing was overwritten.',280,266,1120,'warning',96);
    const p=V.panel(b,'Conflicting revision',280,410,1120,208,C.surface,C.border,10);
    V.text(p,'Latest change',24,24,1020,14,C.muted,500);V.text(p,'Hosting · Scale changed from View to Edit and delete.',24,70,1020,19,C.text,500,34);
    V.text(p,'Your draft removes AND Studio. Scale must keep its latest permission.',24,132,1020,15,C.secondary,400,50);
    V.button(b,'Review latest access',280,700,250,'person');V.button(b,'Return to draft',550,700,190,'editAccess','secondary');return b;
  },
  inviteInvalid:()=>{
    const b=V.board('inviteInvalid','S04 · Invitation / invalid or expired');V.text(b,'Vault',80,54,1000,28,C.text,600,44);
    V.badge(b,'Invitation unavailable',80,190,'warning',220);V.text(b,'This invitation can’t be used',80,258,1240,42,C.text,600,66);
    V.text(b,'It may have expired, been replaced or been issued to another account.\nAsk Osiris for a new invitation, or sign in with the invited email.',80,366,1230,20,C.secondary,400,100);
    V.button(b,'Return to sign in',80,560,240,'recipient');V.text(b,'No shared access was granted.',80,654,1200,15,C.muted);return b;
  },
  existingPerson:()=>{
    const b=V.shell('existingPerson','S05 · Existing person / manage instead','People','Avery is already in your business','Manage their existing access instead of sending another invitation.');
    V.field(b,'Email address','avery@example.com',280,282,740);
    V.note(b,'Existing member found','Avery Chen already belongs to AND Studio and Scale. Their current memberships will be preserved.',280,454,1120,'info',100);
    V.button(b,'Manage Avery’s access',280,620,260,'person');V.button(b,'Use another email',560,620,220,'invitePerson','secondary');return b;
  },
  loading:()=>{
    const b=V.shell('loading','S06 · People / loading','People','People','Loading the latest business access…');
    for(let i=0;i<3;i++){const y=290+i*110;V.rect(b,'Avatar skeleton',300,y,36,36,C.raised,18);V.rect(b,'Name skeleton',356,y,246,16,C.raised,4);V.rect(b,'Email skeleton',356,y+30,320,12,C.raised,4);V.rect(b,'Permission skeleton',900,y+10,250,20,C.raised,4);V.rule(b,y+78);}
    V.text(b,'Access controls become available after the latest permissions load.',280,712,1100,14,C.muted);V.button(b,'View loaded state',280,788,210,'people','secondary');return b;
  },
  loadFailed:()=>{
    const b=V.shell('loadFailed','S07 · People / load failure','People','People','Manage invitations, workspaces and account access.');
    V.note(b,'We couldn’t load People','Your business access has not changed. Check the connection and try again.',280,282,1120,'danger',100);V.button(b,'Try again',280,434,170,'people');return b;
  },
  permissionMenu:()=>{
    const b=V.shell('permissionMenu','S08 · Permission options','People','Choose account permission','The same permission labels appear in invitations and later access changes.');
    const p=V.panel(b,'Permission menu',280,284,750,308,C.raised,C.quiet,10);
    V.text(p,'View',24,26,700,18,C.text,600);V.text(p,'Reveal and copy the shared account. No editing.',24,62,700,14,C.secondary);V.rule(p,111,24,702);
    V.text(p,'Edit and delete',24,138,700,18,C.text,600);V.text(p,'View, edit and delete the shared account item.',24,174,700,14,C.secondary);V.text(p,'Neither option allows changing who has access.',24,242,700,14,C.muted);
    V.button(b,'Back to account choices',280,674,270,'inviteAccounts','secondary');return b;
  },
  createWorkspace:()=>{
    const b=V.shell('createWorkspace','S09 · Create a workspace','Workspaces','Create a workspace','A place for related business accounts. Access starts with you.');
    V.field(b,'Workspace name','Client delivery',280,280,820);V.field(b,'Description · optional','Accounts used for client delivery',280,420,820);
    V.note(b,'Nobody is added automatically','Choose accounts for this workspace, then give people explicit access from People.',280,614,1120,'info',92);
    V.footer(b,'workspaces','Create workspace','workspaceEmpty','Only Osiris has access initially.');return b;
  },
  workspaceEmpty:()=>{
    const b=V.shell('workspaceEmpty','S10 · New workspace / empty','Workspaces','Client delivery','Only you have access to this workspace.');V.badge(b,'0 accounts',280,238,'neutral',130);V.badge(b,'Owner only',422,238,'neutral',140);
    V.text(b,'Add the accounts this workspace needs',280,360,1090,28,C.text,600,46);V.text(b,'Reuse an existing business account without copying its credentials.\nAdding an account here does not share it with anyone automatically.',280,428,1060,17,C.secondary,400,88);
    V.button(b,'Add a business account',280,576,280,'accountPicker');V.button(b,'Back to workspaces',580,576,220,'workspaces','secondary');return b;
  },
  accountPicker:()=>{
    const b=V.shell('accountPicker','S11 · Add an existing business account','Workspaces','Add accounts to Client delivery','Choose existing business-owned accounts. Personal items stay private.');
    const p=V.panel(b,'Business account picker',280,282,1120,228,C.surface,C.border,9);
    V.accountRow(p,'Hosting · Scale','Already in Scale',0,true,'Selected');V.accountRow(p,'Shared design library','Already in AND Studio + Scale',76,false);V.accountRow(p,'Studio email','Already in AND Studio',152,false);
    V.note(b,'One account, multiple workspaces','The original item stays the same. Existing workspace memberships and account grants do not change.',280,570,1120,'info',100);
    V.footer(b,'workspaceEmpty','Add 1 account','workspaceAdded','No new person receives access.');return b;
  },
  workspaceAdded:()=>{
    const b=V.shell('workspaceAdded','S12 · Account added / no automatic access','Workspaces','Client delivery','1 business account · Owner only');
    const p=V.panel(b,'Added business account',280,282,1120,132,C.surface,C.border,9);V.text(p,'Hosting · Scale',24,24,1000,20,C.text,600);V.text(p,'Also in Scale · Shared with nobody in Client delivery',24,71,1000,14,C.muted);
    V.note(b,'Account added. Sharing is unchanged.','Use People to select who can join Client delivery and which accounts they may access.',280,474,1120,'success',100);
    V.button(b,'Manage people',280,646,200,'people');V.button(b,'Back to workspaces',500,646,230,'workspaces','secondary');return b;
  }
});
return {stateRecipes:['empty','failed','stale','inviteInvalid','existingPerson','loading','loadFailed','permissionMenu','createWorkspace','workspaceEmpty','accountPicker','workspaceAdded']};
