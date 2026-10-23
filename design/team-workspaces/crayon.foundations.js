const V=storage.vault,C=V.colors;
V.componentIds=[];V.typographyIds=[];
const b=V.board('foundations','F01 · Foundations and reusable components',1440,1180);
V.text(b,'Vault / team access',48,42,1300,32,C.text,600,50);V.text(b,'Existing charcoal palette. Inter. Explicit permissions. Clear before and after.',48,104,1300,16,C.secondary);
const palette=['canvas','sidebar','surface','raised','border','text','secondary','muted'];
palette.forEach((name,i)=>{V.rect(b,'Color / '+name,48+i*170,176,148,68,C[name],8,C.border);V.text(b,name,48+i*170,256,154,13,C.text,500);V.text(b,C[name],48+i*170,282,154,12,C.muted);});
V.text(b,'Type and spacing',48,354,1300,22,C.text,600);
V.text(b,'Page heading / 30, 600',48,412,650,30,C.text,600,48);V.text(b,'Section / 20, 600',48,476,650,20,C.text,600,34);V.text(b,'Body / 15, 400',48,526,650,15,C.secondary);
V.text(b,'Labels / 14, 500',760,414,600,14,C.text,500);V.text(b,'Supporting / 13, 400',760,462,600,13,C.muted);V.text(b,'Spacing / 4, 8, 12, 16, 24, 32, 48',760,510,600,15,C.secondary);
for(const [name,size,weight] of [['Page heading',30,600],['Section heading',20,600],['Body',15,400],['Control label',14,500],['Supporting',13,400],['Micro label',11,500]]){
  const t=crayon.library.local.createTypography();t.name=name;t.path='Vault';t.setFont(V.font,V.font.variants.find(v=>v.fontWeight===String(weight)&&v.fontStyle==='normal'));t.fontSize=String(size);t.fontWeight=String(weight);t.lineHeight='1.4';V.typographyIds.push(t.id);
}
V.text(b,'Controls',48,608,1300,22,C.text,600);
const primary=V.button(b,'Save changes',48,662,200),secondary=V.button(b,'Cancel',272,662,160,null,'secondary'),danger=V.button(b,'Remove access',456,662,220,null,'danger');
const focus=V.button(b,'Keyboard focus',700,662,220,null,'secondary');V.rect(focus,'Visible focus ring',-3,-3,226,50,null,10,C.text);
const active=V.badge(b,'Active',48,742,'success',120),pending=V.badge(b,'Awaiting confirmation',192,742,'warning',240),retained=V.badge(b,'View through Scale',456,742,'success',230),removed=V.badge(b,'No access',710,742,'danger',160);
const input=V.panel(b,'Email field component',48,826,628,100,C.canvas,null,0);V.field(input,'Email address','sam@example.com',0,0,628);
const account=V.panel(b,'Account grant row component',720,826,672,100,C.surface,C.border,8);V.check(account,20,32,true);V.text(account,'Shared design library',62,18,390,15,C.text,500);V.text(account,'AND Studio + Scale',62,48,390,13,C.muted);V.badge(account,'View',500,32,'neutral',150);
for(const [name,shape] of [['Button primary',primary],['Button secondary',secondary],['Button destructive',danger],['Button focus',focus],['Status active',active],['Status pending',pending],['Access retained',retained],['Access removed',removed],['Input email',input],['Account grant row',account]]){
  const component=crayon.library.local.createComponent([shape]);component.name=name;component.path='Vault';V.componentIds.push(component.id);
}
V.text(b,'Interaction rules',48,994,1300,20,C.text,600);V.text(b,'44 px actions · Visible focus · Status text with color · Field-level errors · Reduced motion\nRoutine updates are immediate. Use an optional 160 ms fade for panels; never delay access feedback.',48,1048,1300,15,C.secondary,400,84);
b.setPluginData('vault-complete','true');return {foundationBoard:b.id,components:V.componentIds,typography:V.typographyIds};
