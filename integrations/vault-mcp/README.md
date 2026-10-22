# Vault MCP connector

Local stdio MCP connection for requesting protected account lookup and website
sign-in. It stays discoverable while Vault is locked or the native adapter is
unavailable. A connection is not permission to unlock or use an account.

This is an intermediate source snapshot. Protocol tests pass. Daily T3 does not
yet contain the required native adapter, and no GoDaddy sign-in or biometric
acceptance is claimed. The signed official Bitwarden client remains the manual
Mac route. Its extension can autofill in a human-operated supported browser;
that does not install protected fill in T3's preview browser.

## Run and register

Requires Node.js 22 or later. From this directory:

```sh
npm ci --ignore-scripts
npm test
node src/server.mjs
```

The last command speaks MCP over stdin/stdout. Use an MCP client, rather than
typing requests at the process. No environment secret or password is configured.

For the Codex provider in T3, use its supported external MCP registration:

```sh
codex mcp add vault -- node '/absolute/path/to/Vault/integrations/vault-mcp/src/server.mjs'
codex mcp get vault
```

Then use T3's **Restart agent session** command in the existing conversation.
Other providers require their own supported MCP configuration; this snapshot
does not claim registration for them. `mcp.json` is a portable command template
for hosts which expand `PLUGIN_ROOT`; it is not an installed plugin.

## Protected flow

1. `vault_status` checks the native adapter. `native_adapter_required` is a
   blocked login path, not an invitation to enter passwords in chat.
2. `vault_find_accounts` binds a query to an explicit T3 thread and attached
   desktop preview tab. Native approval and unlock precede metadata release.
3. `vault_request_status` returns bounded status and approved account metadata.
   Explicitly select the right account when matches are ambiguous.
4. `vault_sign_in` takes the opaque selection handle in that same tab. The host
   checks its fixed provider adapter and requests fresh human approval. Website
   MFA/CAPTCHA may still require the owner in the private window.
5. Accept a login only after the native host verifies the exact account in the
   destination tab. `ready_to_verify` alone does not prove this.
6. `vault_cancel` clears active private work and memory access. Encrypted device
   enrollment survives normal cancellation. Explicit native removal is separate.

The native companion in Karen's protected integration owns credentials, private
approval, provider fill, session handoff and identity verification. The connector
only sends bounded commands over a mode-600 Unix socket in a mode-700 directory.
No HTTP listener, arbitrary URLs, browser scripts, credential-return tool or
personal Chrome automation is provided. Socket access is a same-user boundary;
it does not isolate secrets from an unrestricted agent with the same OS access.

## Supported and pending

The intended initial native browser adapter is an attached T3 desktop preview
tab. Server-only previews, other browsers, other Macs and arbitrary websites are
not accepted by this snapshot. Static Google and GoDaddy routes are under
development. Osiris selected the registered GoDaddy identity for first real
acceptance. Slack metadata may be discoverable after approval; this does not
grant a Slack fill adapter.

The native candidate must match the installed T3 source revision and pass review
before any installed-app replacement. Stable signing and real native approval,
identity verification, subsequent use and restart remain separate acceptance.

## Remove

```sh
codex mcp remove vault
```

Refresh the agent session. Stop only the captured native candidate process,
preserving its enrollment/profile. Removing this registration never removes
Bitwarden, its extension, Keychain entries, the Vault server or website sessions.
