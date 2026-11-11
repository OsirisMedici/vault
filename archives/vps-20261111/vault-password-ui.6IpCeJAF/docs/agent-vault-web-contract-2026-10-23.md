# Vault web agent access contract

Osiris authorized completing the web interface as soon as possible. The outcome
is one authenticated Vault page to select an imported account, request a sign-in,
and see its verified result. The existing chat-assisted browser remains the
executor. This is not unattended browser access or live Bitwarden sync.

## Source and UI

Pinned frontend source: upstream/web at
d2a095eb800fe80a9bc524579b974796eae51994, web2026.7.0. Keep it clean.
Apply an owned patch and branding/web-source.patch to a generated candidate.
Add the lazy standalone route `/#/agent-vault` inside UserLayoutComponent's
existing deepLinkGuard/authGuard. Add a navigation item named Agent access.
Use AccountService.activeAccount$, AuthService.activeAccountStatus$, and the
explicit-user ApiService.send overload. Never extract browser tokens/storage.
No calls containing Vault bearer credentials may target the engine origin.

Frontend API path prefix `/agent-vault`, relative to the configured Vault API
base, gives public URLs `/api/agent-vault/*` on the existing Vault origin.
On lock/logout/account change clear metadata and polling immediately, and
discard stale in-flight responses. Queueing requires explicit user action.
Use existing header, layout, form/button and typography components. No redesign.

## Browser-facing bridge

New owned Bun service under integrations/agent-vault/web-bridge/. No dependencies
are needed; use Bun.serve and bun:sqlite. Server listens 0.0.0.0:19433 in its
container; deployment publishes VPS loopback only. An upstream reverse proxy
strips `/api/agent-vault` to the service's relative route. Do not implement
frontend auth by looking at DOM or browser storage.

The bridge validates EVERY user API call's Bearer authorization by GETting
`/api/accounts/profile` on the configured existing Vault origin over validated
HTTPS, redirects forbidden. Match the returned profile id to an explicit
private allowlist of Vault owner UUIDs. Never accept a caller-supplied user id
as authentication. Browser Origin, when present, must exactly match the private
configured Vault HTTPS origin; mutating browser calls require it. No CORS.
Reject missing/invalid auth, other identities and unknown JSON fields. Bound
request bodies, responses, timeouts, metadata and queues. No raw errors/logs.

Private configuration comes from a fixed host path via VAULT_AGENT_WEB_CONFIG.
Shape: {version:1,vaultOrigin,allowedUserIds:[uuid],manifestPath,workerTokenFile,
databasePath,engineAddress}. All private files/parents have owner-only modes,
no links; config stays outside source. engineAddress is HTTPS or loopback HTTP.
The bridge has NO engine owner token or ability to reveal passwords.
Use the existing manifest schema for metadata only. Only ClickUp and GoDial
origins/providers are actionable. Unsupported rows may be omitted.

Endpoints, fixed JSON projections:
- GET /status -> {state:'ready'|'engine_unavailable',browserMode:'chat-assisted',
  importedAccounts:number,supportedAccounts:number}. Requires Vault auth.
- GET /accounts -> {accounts:[{accountId,name,username,origin,provider}]},
  provider is clickup|godial and origin must match the fixed provider.
- POST /requests body {accountId,provider} -> Request.
- GET /requests/:id -> Request, only original Vault user can read.
- POST /requests/:id/cancel body {} -> Request, only queued work cancellable.
- GET /health -> {status:'ok'}, public process-only check.

Request projection: {requestId,state,provider,name,username,origin,expiresAt,
identityVerified:boolean}. States queued,working,signed_in,verification_required,
credentials_rejected,failed,cancelled,expired. Do not include credential refs,
private paths, tokens or arbitrary upstream values. Requests expire in five
minutes. Enforce single active request per Vault user and bounded persisted
SQLite metadata. Cancellation/expiry must reject stale completions.

## Trusted chat executor

Worker APIs use ONLY a separate private random bearer capability, never Vault
user authorization or engine owner credentials. Exclude Origin/CORS access and
validate capability using constant-time comparison. No browser access.
- POST /worker/claim body {requestId} atomically changes queued to working;
  returns Request plus accountId. Expired/claimed requests are refused.
- POST /worker/complete body {requestId,state,identityVerified}; terminal states
  signed_in,verification_required,credentials_rejected,failed only. signed_in
  requires identityVerified true; others false. Can finish only working,
  nonexpired request. Return Request. Parent host code supplies verified result.

The parent owns trusted worker client, existing-controller adapter, deployment
and live UI acceptance. Worker code must not fill a website or see secrets.
The parent will open the fixed provider URL using injected T3 preview tools,
bind the exact selected imported account and actual thread/tab in the trusted
controller, and publish only the bounded outcome. UI explains that this chat's
browser connection must be active. A queued request is never signed-in proof.

## Verification and delivery

Broker owner runs one focused synthetic case covering unauthorized access,
owner/account isolation, queue/claim/completion and no secret projection.
Frontend owner supplies patch/preparation, no full suite or dependency install.
Parent builds the actual patched OSS client, validates current proxy/storage,
backs up the existing release privately, and performs one real authenticated
UI request through to a verified browser identity. Never fake Vault owner auth
or bypass the existing private sign-in/unlock needed for that live check.
Do not restart T3, replace Bitwarden, change master keys or mutate provider data.
