const V=storage.vault,C=V.colors;
V.mobileShell=(key,name,title,subtitle)=>{
  const b=V.board(key,name,390,844);V.rect(b,'Mobile header',0,0,390,72,C.sidebar);V.text(b,'Vault',24,22,220,20,C.text,600,30);V.text(b,'Osiris business',202,26,164,12,C.muted).align='right';
  V.text(b,title,24,102,342,26,C.text,600,42);if(subtitle)V.text(b,subtitle,24,155,342,14,C.secondary,400,48);return b;
};
V.mobileFooter=(b,label,target,back=null)=>{
  V.rect(b,'Mobile action bar',0,728,390,116,C.sidebar);V.rule(b,728,0,390);
  if(back){V.button(b,'Back',24,752,82,back,'secondary');V.button(b,label,118,752,248,target);}else V.button(b,label,24,752,342,target);
  V.rect(b,'Home indicator',135,826,120,4,C.secondary,2);
};
Object.assign(V.screenBuilders,{
  mobilePeople:()=>{
    const b=V.mobileShell('mobilePeople','M01 · People / mobile','People','Invite once. Manage each person’s access.');V.button(b,'Invite person',24,216,342,'mobileAccounts');
    [['OM','Osiris Medici','Owner · All workspaces','Protected','owner'],['AC','Avery Chen','Member · 2 workspaces','Active','mobilePerson'],['JB','Jordan Blake','Member · 2 workspaces','Awaiting confirmation','confirm']].forEach((r,i)=>{
      const y=288+i*134,p=V.panel(b,'Mobile person / '+r[1],24,y,342,114,C.surface,C.border,9);V.avatar(p,r[0],16,18,34);V.text(p,r[1],64,16,258,15,C.text,500);V.text(p,r[2],64,44,258,12,C.muted);V.badge(p,r[3],64,76,r[3]==='Active'?'success':r[3]==='Protected'?'neutral':'warning',r[3].length>12?222:118);V.link(p,r[4]);
    });V.text(b,'People  ·  Workspaces  ·  Activity',24,756,342,13,C.secondary);V.link(b.children[b.children.length-1],'mobileWorkspaces');return b;
  },
  mobileAccounts:()=>{
    const b=V.mobileShell('mobileAccounts','M02 · Invite / mobile account choices','Choose accounts','Sam · sam@example.com\n2 workspaces selected');
    V.text(b,'AND Studio',24,232,342,16,C.text,600);
    const row=(name,sub,y,perm)=>{const p=V.panel(b,'Mobile account / '+name,24,y,342,96,C.surface,C.border,8);V.check(p,16,22,true);V.text(p,name,50,13,274,14,C.text,500);V.text(p,sub,50,38,274,12,C.muted);V.badge(p,perm,50,63,'neutral',180);};
    row('Instagram · Studio','social@example.com',268,'View');row('Shared design library','design@example.com',376,'View');V.text(b,'Scale',24,500,342,16,C.text,600);row('Hosting · Scale','hosting@example.com',536,'Edit and delete');
    V.text(b,'View includes revealing and copying credentials.',24,662,342,12,C.muted,400,40);V.mobileFooter(b,'Review invitation','mobileReview','mobilePeople');return b;
  },
  mobileReview:()=>{
    const b=V.mobileShell('mobileReview','M03 · Invite / mobile review','Review invitation','Sam · sam@example.com');V.badge(b,'2 workspaces',24,222,'neutral',145);V.badge(b,'3 accounts',182,222,'neutral',140);
    [['Instagram · Studio','AND Studio · View'],['Shared design library','AND Studio · View'],['Hosting · Scale','Scale · Edit and delete']].forEach((r,i)=>{const p=V.panel(b,'Mobile review / '+r[0],24,278+i*94,342,80,C.surface,C.border,8);V.text(p,r[0],16,14,310,15,C.text,500);V.text(p,r[1],16,44,310,13,C.muted);});
    V.note(b,'Share the full account','Sam can reveal and copy shared credentials. Removing access cannot erase a copy.',24,582,342,'warning',112);V.mobileFooter(b,'Send invitation','mobileSent','mobileAccounts');return b;
  },
  mobileSent:()=>{
    const b=V.mobileShell('mobileSent','M04 · Invitation / mobile sent','Invitation sent','One invitation for Sam’s selected access.');V.badge(b,'Invited',24,240,'warning',120);
    V.text(b,'2 workspaces\n3 permitted accounts',24,304,342,25,C.text,500,96);V.note(b,'Not active yet','Sam accepts, then you confirm their identity before encrypted sharing becomes active.',24,476,342,'info',132);V.mobileFooter(b,'Back to People','mobilePeople');return b;
  },
  mobilePerson:()=>{
    const b=V.mobileShell('mobilePerson','M05 · Person / mobile','Avery Chen','avery@example.com');V.badge(b,'Active',24,222,'success',96);V.badge(b,'2 workspaces',134,222,'neutral',160);
    V.text(b,'Permitted accounts',24,286,342,18,C.text,600);
    [['Instagram · Studio','AND Studio · View'],['Shared design library','AND Studio + Scale · View'],['Hosting · Scale','Scale · Edit and delete']].forEach((r,i)=>{const p=V.panel(b,'Mobile permitted / '+r[0],24,332+i*104,342,88,C.surface,C.border,8);V.text(p,r[0],16,16,310,15,C.text,500);V.text(p,r[1],16,48,310,12,C.muted);});
    V.text(b,'Remove AND Studio in the sample flow.',24,670,342,13,C.muted);V.mobileFooter(b,'Review access change','mobileRetained','mobilePeople');return b;
  },
  mobileRetained:()=>{
    const b=V.mobileShell('mobileRetained','M06 · Review / mobile retained access','Review changes','Remove AND Studio. Keep Scale intact.');
    V.note(b,'AND Studio will be removed','Only this membership and its grants change.',24,234,342,'warning',100);
    const p=V.panel(b,'Mobile lost access',24,366,342,110,C.surface,C.border,8);V.text(p,'Instagram · Studio',16,16,310,16,C.text,500);V.badge(p,'No access',16,62,'danger',180);
    const q=V.panel(b,'Mobile retained access',24,496,342,132,C.surface,C.border,8);V.text(q,'Shared design library',16,16,310,16,C.text,500);V.badge(q,'View through Scale',16,62,'success',236);V.text(q,'The AND Studio grant is removed.',16,100,310,12,C.muted);
    V.text(b,'Hosting · Scale is unchanged.',24,660,342,13,C.secondary);V.mobileFooter(b,'Save changes','mobileSaved','mobilePerson');return b;
  },
  mobileSaved:()=>{
    const b=V.mobileShell('mobileSaved','M07 · Access / mobile saved','Access updated','Avery’s Scale access is unchanged.');V.note(b,'AND Studio removed','Scale and its 2 permitted accounts remain active.',24,248,342,'success',112);
    V.text(b,'Still permitted',24,416,342,20,C.text,600);V.text(b,'Shared design library · View\nHosting · Scale · Edit and delete',24,474,342,15,C.secondary,400,82);V.mobileFooter(b,'Back to People','mobilePeople');return b;
  },
  mobileWorkspaces:()=>{
    const b=V.mobileShell('mobileWorkspaces','M08 · Workspaces / mobile','Workspaces','Organize accounts. Manage access from People.');
    [['AND Studio','3 accounts · 2 members'],['Scale','3 accounts · 3 members'],['ILDL','2 accounts · Owner only']].forEach((r,i)=>{const p=V.panel(b,'Mobile workspace / '+r[0],24,248+i*134,342,110,C.surface,C.border,9);V.text(p,r[0],16,20,310,19,C.text,600);V.text(p,r[1],16,60,310,13,C.muted);V.link(p,'workspace');});V.mobileFooter(b,'Back to People','mobilePeople');return b;
  }
});
return {mobileRecipes:['mobilePeople','mobileAccounts','mobileReview','mobileSent','mobilePerson','mobileRetained','mobileSaved','mobileWorkspaces']};
