// Editable Crayon design recipe. Run only inside the matching Crayon MCP file.
// This is design tooling, not Vault runtime code. Samples are fictional.
const V = storage.vault;
if (!V || crayon.currentFile?.id !== V.fileId) throw new Error('Wrong design file');
V.font = crayon.fonts.all.find(f => f.name === 'Inter');
V.swatches = V.swatches || {};
for (const [name, color] of Object.entries(V.colors)) {
  if (!V.swatches[color]) {
    const swatch = crayon.library.local.createColor();
    swatch.name = name;
    swatch.path = 'Vault';
    swatch.color = color;
    V.swatches[color] = swatch;
  }
}
V.fill = color => V.swatches[color] ? V.swatches[color].asFill() : {fillColor:color};
V.rect = (p,name,x,y,w,h,fill=V.colors.raised,radius=0,border=null) => {
  const r=crayon.createRectangle();r.name=name;r.resize(w,h);r.fills=fill?[V.fill(fill)]:[];
  r.borderRadius=radius;
  if(border) r.strokes=[{strokeColor:border,strokeWidth:1,strokeAlignment:'inner',strokeStyle:'solid'}];
  p.appendChild(r);r.x=p.x+x;r.y=p.y+y;return r;
};
V.text = (p,str,x,y,w=400,size=14,color=V.colors.text,weight=400,h=null) => {
  const t=crayon.createText(str);t.name=str.slice(0,70);
  V.font.applyToText(t,V.font.variants.find(v=>v.fontWeight===String(weight)&&v.fontStyle==='normal'));
  t.fontSize=String(size);t.lineHeight='1.4';t.resize(w,h||Math.ceil(size*1.5));t.growType='fixed';
  t.fills=[V.fill(color)];p.appendChild(t);t.x=p.x+x;t.y=p.y+y;return t;
};
V.board = (key,name,w=1440,h=960) => {
  if(V.boards[key] && V.boards[key].children.length) {
    if(key==='people' && V.boards[key].children.length===1) V.boards[key].children[0].remove();
    else throw new Error('Board already built: '+key);
  }
  const i=Object.keys(V.boards).indexOf(key)>=0?Object.keys(V.boards).indexOf(key):Object.keys(V.boards).length;
  const b=V.boards[key]||crayon.createBoard();b.name=name;b.resize(w,h);b.x=(i%4)*(w+120);b.y=Math.floor(i/4)*(h+160);b.fills=[V.fill(V.colors.canvas)];b.clipContent=true;
  b.setPluginData('vault-screen-key',key);V.boards[key]=b;return b;
};
V.panel = (p,name,x,y,w,h,fill=V.colors.surface,border=V.colors.border,radius=12) => {
  const b=crayon.createBoard();b.name=name;b.resize(w,h);b.fills=[V.fill(fill)];b.borderRadius=radius;
  if(border)b.strokes=[{strokeColor:border,strokeWidth:1,strokeAlignment:'inner',strokeStyle:'solid'}];
  b.clipContent=false;p.appendChild(b);b.x=p.x+x;b.y=p.y+y;return b;
};
V.link=(s,key)=>{V.links.push({shape:s.id,target:key});return s;};
V.button=(p,label,x,y,w=150,target=null,kind='primary',h=44)=>{
  const c=V.colors,fill=kind==='primary'?c.primary:kind==='danger'?c.dangerBg:kind==='ghost'?c.canvas:c.raised;
  const fg=kind==='primary'?c.canvas:kind==='danger'?c.danger:c.text;
  const b=V.panel(p,'Button / '+label,x,y,w,h,fill,kind==='primary'?null:c.border,8);
  const t=V.text(b,label,8,(h-21)/2,w-16,14,fg,500,22);t.align='center';if(target)V.link(b,target);return b;
};
V.badge=(p,label,x,y,tone='neutral',w=null)=>{
  const c=V.colors,bg={neutral:c.hover,success:c.successBg,warning:c.warningBg,danger:c.dangerBg,info:c.infoBg}[tone];
  const fg={neutral:c.secondary,success:c.success,warning:c.warning,danger:c.danger,info:c.info}[tone];
  w=w||Math.ceil(label.length*7.2+20);const b=V.panel(p,'Status / '+label,x,y,w,28,bg,null,6);
  V.text(b,label,10,5,w-20,12,fg,500,18);return b;
};
V.rule=(p,y,x=280,w=1120)=>V.rect(p,'Divider',x,y,w,1,V.colors.border);
V.avatar=(p,initials,x,y,size=36)=>{
  const e=crayon.createEllipse();e.name='Avatar / '+initials;e.resize(size,size);e.fills=[V.fill(V.colors.hover)];p.appendChild(e);e.x=p.x+x;e.y=p.y+y;
  const t=V.text(p,initials,x,y+(size-20)/2,size,12,V.colors.secondary,600,20);t.align='center';return e;
};
V.check=(p,x,y,checked=false,target=null)=>{
  const b=V.panel(p,checked?'Checkbox / selected':'Checkbox / unchecked',x,y,20,20,checked?V.colors.primary:V.colors.surface,V.colors.quiet,4);
  if(checked) {const t=V.text(b,'✓',0,-1,20,14,V.colors.canvas,600,22);t.align='center';}
  if(target)V.link(b,target);return b;
};
V.field=(p,label,value,x,y,w=520,helper=null,error=false)=>{
  if(label)V.text(p,label,x,y,w,14,V.colors.text,500);
  V.rect(p,'Input / '+label,x,y+30,w,48,V.colors.surface,8,error?V.colors.danger:V.colors.quiet);
  const t=V.text(p,value,x+14,y+43,w-28,15,value?V.colors.text:V.colors.muted,400,24);
  if(helper)V.text(p,helper,x,y+88,w,13,error?V.colors.danger:V.colors.muted,400,44);
  return t;
};
V.note=(p,title,body,x,y,w=1120,tone='info',h=88)=>{
  const c=V.colors,bg=tone==='warning'?c.warningBg:tone==='danger'?c.dangerBg:tone==='success'?c.successBg:c.infoBg;
  const fg=tone==='warning'?c.warning:tone==='danger'?c.danger:tone==='success'?c.success:c.info;
  const b=V.panel(p,title,x,y,w,h,bg,null,8);V.text(b,title,20,15,w-40,14,fg,600);
  V.text(b,body,20,40,w-40,13,c.secondary,400,h-44);return b;
};
V.heading=(b,title,description,step=null)=>{
  if(step)V.text(b,step,280,106,900,12,V.colors.muted,500);
  V.text(b,title,280,step?136:112,920,30,V.colors.text,600,46);
  V.text(b,description,280,step?188:164,1000,15,V.colors.secondary,400,44);
};
V.shell=(key,name,section='People',title=null,desc=null)=>{
  const b=V.board(key,name),c=V.colors;
  V.rect(b,'Sidebar',0,0,232,960,c.sidebar);
  const logo=crayon.createShapeFromSvg(V.logo);b.appendChild(logo);logo.name='Vault / original brand icon';logo.resize(32,32);logo.x=b.x+26;logo.y=b.y+27;
  V.text(b,'Vault',72,27,120,25,c.text,600,38);
  V.panel(b,'Business switcher',16,92,200,64,c.surface,c.border,9);
  V.text(b,'Osiris business',30,104,166,14,c.text,500);
  V.text(b,'Business vault',30,127,166,12,c.muted);
  const nav=(label,y,target,active)=>{
    if(active)V.rect(b,'Selected / '+label,12,y-8,208,44,c.hover,7);
    const t=V.text(b,label,28,y,180,14,active?c.text:c.secondary,active?500:400,25);V.link(t,target);
  };
  nav('My vault',190,'member',section==='My vault');
  V.rect(b,'Sidebar divider',20,244,192,1,c.border);
  V.text(b,'BUSINESS',28,271,174,11,c.quiet,600);
  nav('People',314,'people',section==='People');nav('Workspaces',362,'workspaces',section==='Workspaces');nav('Activity',410,'activity',section==='Activity');nav('Settings',458,'owner',section==='Settings');
  V.rect(b,'Profile divider',20,857,192,1,c.border);V.avatar(b,'OM',24,882,34);V.text(b,'Osiris Medici',70,878,145,13,c.text,500);V.text(b,'Business owner',70,901,145,12,c.muted);
  V.text(b,'Business  /  '+section,280,34,700,13,c.muted);
  V.text(b,'Osiris business',1204,34,188,13,c.secondary,400,22).align='right';
  V.rule(b,79,232,1208);if(title)V.heading(b,title,desc||'');return b;
};
V.steps=(b,active)=>{
  ['Person','Workspaces','Accounts','Review'].forEach((label,i)=>{
    V.rect(b,'Step '+(i+1),280+i*280,244,260,2,i<=active?V.colors.primary:V.colors.border);
    V.text(b,String(i+1).padStart(2,'0')+'  '+label,280+i*280,260,260,13,i===active?V.colors.text:V.colors.muted,i===active?500:400);
  });
};
V.footer=(b,back,nextLabel,nextTarget,summary=null)=>{
  V.rule(b,856);if(summary)V.text(b,summary,280,878,670,13,V.colors.secondary);
  if(back)V.button(b,'Back',1100,882,100,back,'secondary');V.button(b,nextLabel,1220,882,180,nextTarget);
};
V.workspaceRow=(p,name,description,y,selected=false,target=null,count=null)=>{
  const b=V.panel(p,'Workspace / '+name,0,y,p.width,88,V.colors.surface,selected?V.colors.secondary:V.colors.border,8);
  V.check(b,20,33,selected,target);V.text(b,name,60,18,650,16,V.colors.text,500);V.text(b,description,60,47,650,13,V.colors.muted);
  if(count)V.badge(b,count,p.width-176,30,'neutral',150);if(target)V.link(b,target);return b;
};
V.accountRow=(p,name,service,y,selected=false,permission='View',source=null,target=null)=>{
  V.rect(p,'Account row',0,y,p.width,76,V.colors.surface,0);V.rect(p,'Account divider',0,y+75,p.width,1,V.colors.border);
  V.check(p,20,y+27,selected,target);V.text(p,name,60,y+13,410,14,V.colors.text,500);V.text(p,service,60,y+39,410,12,V.colors.muted);
  if(source)V.badge(p,source,p.width-388,y+24,'neutral',170);
  V.button(p,selected?permission:'No access',p.width-190,y+18,170,target,selected?'secondary':'ghost',40);
};
V.peopleTable=(b,mode='normal')=>{
  const c=V.colors;V.rect(b,'People table header',280,286,1120,42,c.surface,7);
  [['PERSON',300],['ROLE',724],['WORKSPACES',870],['STATUS',1056]].forEach(([s,x])=>V.text(b,s,x,298,180,11,c.muted,500));
  const rows=mode==='empty'?[]:[['OM','Osiris Medici','owner@example.com','Owner','All workspaces','Active','success','owner'],['AC','Avery Chen','avery@example.com','Member','2 workspaces','Active','success','person'],['JB','Jordan Blake','jordan@example.com','Member','2 workspaces','Awaiting confirmation','warning','confirm']];
  rows.forEach((r,i)=>{
    const y=344+i*96;V.avatar(b,r[0],300,y+12,36);V.text(b,r[1],352,y+7,320,15,c.text,500);V.text(b,r[2],352,y+35,320,13,c.muted);
    V.text(b,r[3],724,y+21,130,14,r[3]==='Owner'?c.text:c.secondary,500);
    V.text(b,r[4],870,y+21,176,14,c.secondary);V.badge(b,r[5],1056,y+17,r[6],r[5].length>10?182:70);
    if(i===0)V.text(b,'Protected',1280,y+21,100,13,c.muted);else V.button(b,i===2?'Confirm':'Manage',1260,y+10,120,r[7],'secondary',40);
    V.rule(b,y+85);
  });
};
V.toast=(b,title,body)=>V.note(b,title,body,280,738,1120,'success',82);
V.memberSidebar=b=>{
  const c=V.colors;
  for(const s of [...b.children])if(s.parentX<232)s.remove();
  V.rect(b,'Member sidebar',0,0,232,960,c.sidebar);
  const logo=crayon.createShapeFromSvg(V.logo);b.appendChild(logo);logo.name='Vault / original brand icon';logo.resize(32,32);logo.x=b.x+26;logo.y=b.y+27;
  V.text(b,'Vault',72,27,120,25,c.text,600,38);V.text(b,'Osiris business',28,110,180,14,c.text,500);
  V.rect(b,'Selected member navigation',12,184,208,44,c.hover,7);V.link(V.text(b,'Shared with me',28,195,180,14,c.text,500),'member');
  V.text(b,'WORKSPACES',28,276,180,11,c.quiet,600);V.text(b,'AND Studio',28,320,180,14,c.secondary);V.text(b,'Scale',28,366,180,14,c.secondary);
  V.avatar(b,'AC',24,882,34);V.text(b,'Avery Chen',70,885,140,14,c.text,500);return b;
};
return {helpersReady:true,page:crayon.currentPage.id};
