// Fixed routes only. These selectors fail closed when provider markup changes.
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const routes = [
  {id:'clickup',origin:'https://app.clickup.com',username:'input#login-email-input',usernameType:'email',password:'input#password-input',submit:'button[type="submit"]',profile:'a[href$="/settings/profile"]',identityPathPattern:'^/[0-9]+/settings/profile/?$',identity:'#email-input',workspacePattern:'^/([0-9]+)(?:/|$)',profileSuffix:'/settings/profile',identityKind:'profile-input'},
  {id:'godial',origin:'https://app.godial.cc',username:'input[type="text"]',usernameType:'text',password:'input[type="password"]',submit:'button.black.white--text',submitLocator:'button.black.white--text:text-is("Login")',submitText:'Login',loginContainer:'.v-card',loginHash:'#/',identitySource:'godial-current-user',identityKind:'godial-current-user'},
].map(p => Object.freeze({...p,normalize:normalizeEmail,
  // These builders accept no caller selectors, origins or identity rules.
  identityExpression: () => identityExpression(p),
}));
export const supportedOrigins = Object.freeze(routes.map(p => p.origin));
function identityExpression(p) {
  if (p.identityKind === 'godial-current-user') {
    // Accepted GoDial rule projects only the greeting's current-user email.
    return `(() => { if (location.origin !== ${JSON.stringify(p.origin)} || location.pathname !== '/' || !/^#\\/(home|settings|organization)(?:[/?]|$)/.test(location.hash) || [...document.querySelectorAll('input[type="password"]')].some(e=>e.getClientRects().length)) return null; const greeting=[...document.querySelectorAll('h4')].some(e=>e.getClientRects().length&&e.textContent.trim()==='Hello!'); if (!greeting) return null; const email=document.querySelector('#app')?.__vue__?.$store?.getters?.user?.email; return typeof email==='string'?email.slice(0,320):null; })()`;
  }
  if (p.identityKind === 'profile-input') {
    return `(() => { if (location.origin !== ${JSON.stringify(p.origin)} || !new RegExp(${JSON.stringify(p.identityPathPattern)}).test(location.pathname) || [...document.querySelectorAll('input[type="password"]')].some(e=>e.getClientRects().length)) return null; const headings = [...document.querySelectorAll('h1,h2,[role="heading"]')].some(e=>/^(my settings|personal settings|profile|my profile)$/i.test(e.textContent.trim())); const es = [...document.querySelectorAll(${JSON.stringify(p.identity)})].filter(e=>e.getClientRects().length); return headings && es.length === 1 ? es[0].value?.slice(0,320) : null; })()`;
  }
  throw new Error('form_unavailable');
}
export function providerForOrigin(origin) { return routes.find(p => p.origin === origin); }
export function fixedProvider(provider) { return routes.find(p => p.id === (typeof provider === 'string' ? provider : provider?.id)); }
