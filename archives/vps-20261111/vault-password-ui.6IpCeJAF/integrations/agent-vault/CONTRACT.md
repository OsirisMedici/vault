# Agent Vault integration contract v1

Frozen by the manager on 22 October 2026 for independent implementation.
Change proposals go only to manager a9cfb71e-af79-472a-b333-a368756aeac2.
These are internal Node ESM interfaces. Secret values never cross MCP results.

## Layout and imports

- engine/client.mjs exports createEngineClient.
- credentials/provider.mjs exports createCredentialProvider.
- browser/controller.mjs exports createLoginController.
- browser/driver.mjs exports createBrowserDriver.
- browser/mcp.mjs is the additive runnable tool entrypoint.
- import/ contains engineer 4's independent import utility.

Use asynchronous functions, plain objects, injected dependencies and built-in
Node modules where sufficient. Browser MCP may use the pinned SDK versions from
integrations/vault-mcp/package.json in its own package. Do not assume that
node_modules or upstream submodules are installed in a fresh worktree.

## Public shapes

AccountMetadata:
{ accountId, name, username, origins: ["https://app.example.com"], credentialRef }

accountId is a source UUID when available, otherwise an opaque stable
nonsecret-derived reference. credentialRef is internal, never an authority by
itself. For a UUID, prefix is VW_ + UUID without hyphens, uppercase.
Engine credential keys are prefix + _USERNAME and prefix + _PASSWORD.

PublicAccount:
{ selectionId, name, username, origins, supported }

PublicResult uses state plus optional bounded approved metadata only:
{ state, requestId?, accounts?: PublicAccount[], selectionRequired?,
  account?: { name, username, origin }, reasonCode? }

Public states:
ready, import_required, engine_unavailable, host_unavailable, needs_private_unlock,
accounts_ready, unsupported_provider, verification_required, credentials_rejected,
signed_in, denied, expired, cancelled, failed.

Errors use stable reasonCode strings from a closed local allowlist. Do not
serialize upstream bodies, native errors, stack traces, private paths, password,
token, cookies, arbitrary response keys or a credential-bearing object.

signed_in requires the observed browser identity to equal the selected account's
expected username under that provider's explicit normalization. A dashboard URL
alone is insufficient.

## Private configuration

Directory ~/.config/osiris-agent-vault/integration-v1 mode700, files mode600.
Do not rewrite files owned by another engineer during parallel work.

engine.json example structure, never real values in source:
{ version:1, address:"http://127.0.0.1:18431",
  vaultName:"bitwarden-import-20261022", tokenFile:"/private/path/member-token" }

Engine config is read by trusted host code. Management token authorizes internal
read/write. It must not be given to the ordinary agent. A proxy-only token cannot
perform browser credential reveal; do not pretend otherwise.
Allow loopback HTTP for this local test only. Remote engines require validated
HTTPS or a documented private local tunnel. Do not disable TLS validation.

import-manifest.json:
{ version:1, vaultName:"bitwarden-import-20261022", accounts:[
  { accountId:"source-item-uuid", name:"Example", username:"owner@example.invalid",
    origins:["https://app.example.invalid"],
    credentialRef:"VW_SOURCEUUIDWITHOUTDASHES", sourceItemId:"source-item-uuid",
    importedAt:"ISO-8601" }
] }

Optional loginUrl must be HTTPS on an allowed origin and free of embedded
credentials. It never grants access to arbitrary paths/domains by itself.
Manifest schema must not include password, notes, TOTP, cookies or tokens.
Private file readers reject symlinks, wrong owner, group/world access and
oversize/malformed input. Tests use temporary dummy fixture files.

## Engine interface

createEngineClient({ address, vaultName, tokenFile, fetchImpl? }) returns:
- health(): Promise<{state:"ready"|"engine_unavailable"}>
- putLogin({ credentialRef, username, password }): Promise<{state:"ready"}>
- withLogin(credentialRef, consume): Promise<callback result>

withLogin resolves only the exact expected _USERNAME/_PASSWORD key pair in the
configured vault, then invokes consume({username,password}) inside trusted code.
No credential-bearing result is serialized by the client itself. Do not return
passwords from health/status/CLI commands. Validate reference and pair
completeness. Fail closed on a missing credential or wrong role.

The module's putLogin supports narrowly scoped internal provisioning. Importer
may call the upstream HTTP API directly and is not blocked on this module.

## Credential provider interface

createCredentialProvider({ engine, manifestPath, now? }) returns:
- status(): Promise<{state:"ready"|"import_required"|"engine_unavailable"}>
- findAccounts({query,origin}): Promise<{state:"accounts_ready",accounts:AccountMetadata[]}>
- withCredential({accountId,origin},consume): Promise<callback result>

Read approved metadata from the manifest, not from a plaintext vault export.
Exact HTTPS origin membership is required before withCredential invokes engine.
Use no wildcard origins. Bound metadata to the selected account and confirm the
engine username still matches manifest username before invoking consume.
A cached snapshot is sufficient for v1. No live Bitwarden session is required
after successful import. Refresh is a later explicit import, not silent sync.

findAccounts may return metadata for multiple matching accounts; the controller
must require explicit selection when ambiguous. No match returns an empty list.
On unavailable state, use a bounded error/state, never include private data.

## Browser driver interface

createBrowserDriver({callTool,clipboard?,now?}) returns:
- inspect({tabId}): Promise<{origin,url,owner,ownedByCaller}>
- fillLogin({threadId,tabId,provider,username,password}): Promise<bounded status>
- verifyIdentity({tabId,provider,expectedUsername}):
  Promise<{matched:boolean,observedUsername?:string,verificationRequired?:boolean}>

callTool is a trusted host transport, not arbitrary agent-provided JS/URL/tool
names. Discover the supported T3 transport. Internal fixed provider selectors
are code, never untrusted caller inputs.
Driver rechecks origin and browser control ownership before secret entry. It
must not act on a human-owned tab. If default clipboard fallback is used,
password enters native pbcopy via stdin inside the host; preview_press receives
only Meta+V. Do not call preview_type or preview_evaluate with secrets embedded.
Serialize fills and clear only an unchanged password clipboard in all exits.
Never print clipboard data or restore an unrelated old sensitive clipboard.
Take care not to capture secret values via DOM snapshots or browser logs.

ClickUp approved login origin https://app.clickup.com.
GoDial approved login origin https://app.godial.cc.
Any additional auth origin/redirect needs an explicit fixed-provider rule and
manager review; no arbitrary suffix matching. Normal websites own their cookie
sessions, not the generic Agent Vault proxy.

## Login controller and MCP interface

createLoginController({credentials,driver,now?,selectionTtlMs?}) returns:
- status()
- findAccounts({threadId,tabId,query})
- signIn({threadId,tabId,selectionId})
- cancel({requestId?})

The controller converts AccountMetadata to PublicAccount using opaque random
selection handles bound to exact thread/tab/origin/account. Default selection
TTL is five minutes. Deny expired, consumed, wrong-thread, wrong-tab, wrong-origin
or unsupported-provider requests before credential access.
status reflects real engine/manifest/host readiness.
findAccounts inspects the specified tab and filters metadata to its origin.
signIn obtains the selected credential through withCredential, calls host fill,
then verifies exact identity. No secret-bearing response escapes.
Do not make an existing grant prompt again without a reason. Existing source
approval is distinct from provider MFA/device verification.

Additive MCP tool names:
vault_agent_status
vault_agent_find_accounts {threadId,tabId,query}
vault_agent_sign_in {threadId,tabId,selectionId}
vault_agent_cancel {requestId?}

Keep the existing integrations/vault-mcp and its registration untouched.
Avoid constructing a second unrelated MCP ecosystem; use a small entrypoint and
provide the exact supported registration command to manager. No active T3 or
agent restart during implementation.

## Ownership and integration

Engineers build against injected peer objects or local dummy fixtures. They
must not wait for imports or the other branches to exist. Each worker commits
only its owned paths, returns its SHA and at most its allocated acceptance
results, and reports to manager only. The manager wires concrete imports and
performs C08-C10. Any interface mismatch is a manager issue, not peer negotiation.

Do not claim a strong security boundary against unrestricted same-user code.
Keep this limitation in the handoff while completing the practical workflow.
