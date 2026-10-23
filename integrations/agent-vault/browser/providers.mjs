// Fixed routes only. These selectors fail closed when provider markup changes.
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const routes = [
  {id:'clickup',origin:'https://app.clickup.com',username:'input#login-email-input',usernameType:'email',password:'input#password-input',submit:'button[type="submit"]',profile:'a[href$="/settings/profile"]',identityPathPattern:'^/[0-9]+/settings/profile/?$',identity:'#email-input'},
  {id:'godial',origin:'https://app.godial.cc',username:'input[type="text"]',usernameType:'text',password:'input[type="password"]',submit:'button.black.white--text',submitLocator:'button.black.white--text:text-is("Login")',submitText:'Login',loginContainer:'.v-card',loginHash:'#/',identitySource:'godial-current-user'},
].map(p => Object.freeze({...p,normalize:normalizeEmail}));
export function providerForOrigin(origin) { return routes.find(p => p.origin === origin); }
export function fixedProvider(provider) { return routes.find(p => p.id === (typeof provider === 'string' ? provider : provider?.id)); }
