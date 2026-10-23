// Fixed routes only. These selectors fail closed when provider markup changes.
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const routes = [
  {id:'clickup',origin:'https://app.clickup.com',username:'input#login-email-input',password:'input#login-password-input',submit:'button[type="submit"]',profile:'a[href="/settings/profile"]',identityPath:'/settings/profile',identity:'input[type="email"]'},
  {id:'godial',origin:'https://app.godial.cc',username:'input[type="email"]',password:'input[type="password"]',submit:'button[type="submit"]',profile:'a[href="/profile"]',identityPath:'/profile',identity:'input[name="email"]'},
].map(p => Object.freeze({...p,normalize:normalizeEmail}));
export function providerForOrigin(origin) { return routes.find(p => p.origin === origin); }
export function fixedProvider(provider) { return routes.find(p => p.id === (typeof provider === 'string' ? provider : provider?.id)); }
