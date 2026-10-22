# Agent Vault integration

Vault reuses the full pinned Infisical Agent Vault engine and the imported
Bitwarden login snapshot. The trusted engine client, account selector and
browser controller are assembled here. Source and runtime state are separate.

## What works now

- A macOS user LaunchAgent runs the preserved engine at loopback port 18431,
  with its private proxy on 18432, independently of the originating chat process.
- The original database, encryption wrapping, CA, owner and imported account
  records were retained. A consistent SQLite backup included committed WAL
  records. All 253 imported accounts and 506 credential fields remain present.
- Lookup uses the private metadata manifest. Its Python UTC timestamps now
  validate without changing or reimporting passwords.
- A chat-assisted host controller privately fills and submits ClickUp and
  GoDial logins, then verifies the exact current email. Both fresh sign-ins
  completed through the assembled code on 22 October 2026.
- Supported tools and private helper actions carry metadata/status only.
  Passwords remain in the host process, native clipboard and intended website.

The same-user clipboard workflow is not isolation against unrestricted local
code, clipboard history or malicious software. Keep that limitation distinct
from the useful protection against printing secrets into model/tool arguments.

## Current runtime

Private root: ~/.local/share/osiris-agent-vault/engine.
Private integration config: ~/.config/osiris-agent-vault/integration-v1.
Neither belongs in source control or a shared report attachment.

The LaunchAgent label is com.osirismedici.agent-vault. It starts when this macOS
user logs in and restarts the owned process if it exits. The Mac must be online
and awake. An actual machine reboot/login was not exercised; managed startup
registration and a real service restart were verified. VPS Vault is unchanged.

The runtime root contains the owned binary, private runtime copy, key file,
consistent pre-install snapshot and a nonsecret install receipt. The snapshot
also contains unlock material and must remain private. It is not an independently
encrypted off-host backup or a validated disaster-recovery restore.

The follow-up [recovery helper](../../docs/agent-vault-recovery.md) now creates
a new consistent snapshot and verifies a separate offline copy. One real case
passed with all 253 accounts and the existing wrapping/master/CA material
preserved. It does not test decryption, a live restore or off-host recovery.

Public source revision: upstream v0.40.1,
d5836ec3bb2315de38043d742ae5daca11a4944a. The retained binary has only the
documented trial state-path override. No crypto or authorization logic changed.

## Daily operation

From this checkout:

```sh
python3 integrations/agent-vault/runtime/manage.py status
bun integrations/agent-vault/runtime/status.mjs
```

If the private host session expires, refresh its existing enrollment internally:

```sh
python3 integrations/agent-vault/runtime/configure.py
```

The helper makes at most one normal engine-owner login attempt using the
already-private enrollment. It prints neither the owner password nor session.
It does not change provider accounts or source Bitwarden data.

Service control affects only this owned engine:

```sh
python3 integrations/agent-vault/runtime/manage.py restart
python3 integrations/agent-vault/runtime/manage.py stop
python3 integrations/agent-vault/runtime/manage.py start
```

start bootstraps a stopped/unloaded LaunchAgent; restart applies to the loaded
service. No need to reinstall state or regenerate a master password.

## Browser use in a chat

Ask the agent to log into ClickUp or GoDial with the intended saved account.
Keep that chat's in-app Browser active during native paste. Other websites may
still use the previously demonstrated private field helper, but are not accepted
provider routes in this new controller. MFA/CAPTCHA/device checks remain private
owner handoffs; this code does not bypass them.

The current supported route is an explicit chat tool relay:

```sh
bun run --cwd integrations/agent-vault/browser chat
```

An agent starts the host session with a PTY and services its nonsecret JSON
tool_request messages using only the in-app T3 tools. See browser/chat-relay.js
for the orchestration adapter. It is tool-runner code, not a shell command.
The host retains all engine credentials and performs clipboard operations.

Commands on the private host session are newline-delimited JSON:

```json
{"type":"command","id":"lookup","action":"find","args":{"threadId":"current-thread","tabId":"observed-tab","query":"ClickUp"}}
{"type":"command","id":"login","action":"sign-in","args":{"threadId":"current-thread","tabId":"observed-tab","selectionId":"returned-selection-handle"}}
```

Return each requested T3 tool's structured result as a tool_response with the
matching id. Tool requests contain fixed controls and nonsecret page queries,
never password values. Results contain only bounded status and account metadata.
Do not relay arbitrary tool names, caller scripts or another thread's browser.
End the session with action close after work is finished.

The controller requires a real preview click to focus native WebContents before
clipboard entry, then uses Meta+A/Backspace and Meta+V with uppercase key names.
DOM focus alone does not reliably receive these shortcuts. If the Browser is
not active, a timeout, missing native focus or empty paste must stop the fill.
Never treat tool success alone as proof a secret reached the form. Clipboard
cleanup clears only the operation's unchanged value. A native process crash
can still leave the clipboard or lock behind.

## Standalone MCP status

The additive MCP entrypoint is wired to the real engine/provider by default:

```sh
bun run --cwd integrations/agent-vault/browser start
```

The private runtime factory is also configured for hosts using
VAULT_AGENT_RUNTIME_MODULE. The existing Vault MCP registration is unchanged.
No active agent/T3 restart or new MCP registration was forced.

The external transport still needs officially supplied T3_ACP_MCP_ENDPOINT and
T3_ACP_MCP_AUTHORIZATION. This host does not inherit them. Its status therefore
reports host_unavailable rather than pretending autonomous browser control
works. The chat relay above uses already-injected supported tools and is a
separate, verified fallback. Do not scrape T3 state/tokens or claim the relay
solves that external capability requirement.

Run `bun integrations/agent-vault/browser/check-transport-readiness.mjs` for one
metadata-only external transport probe. It prints presence flags and bounded
status, never capability values. The [transport handoff](../../docs/agent-vault-transport-readiness.md)
records the exact host prerequisite. Supplying an environment to the transport
now also controls its default executable and optional entrypoint.

## Provider verification

ClickUp uses its observed numeric-workspace /settings/profile URL and the
visible #email-input text field. GoDial uses hash routes. Its current profile
email is projected from the same Vuex current-user getter that renders the
greeting, under the expected authenticated route and visible greeting. Only
that email is read; the store, tokens and other state are never returned.

Neither a dashboard URL nor successful submit is sufficient for signed_in.
Both providers compare the observed email against the selected imported entry.
The browser retains its own cookies; the generic Agent Vault proxy does not
carry the website session.

## Delivery and rollback

Owned engineer commits are combined on work/agent-vault-integrated. The original
main checkout, upstream checkouts, Bitwarden data/Keychain and installed T3 app
are preserved. No source push, main-branch merge or VPS engine deployment is
claimed. VPS deployment files in deploy/agent-vault remain prepared separately.

The [VPS delivery package](../../deploy/agent-vault/README.md) now accepts the
recovery helper's snapshot directly and stages an existing database/master/CA
into a fresh Linux destination. It excludes Mac helper files and refuses
overwrite or fresh empty initialization. Its synthetic preservation case and
Compose validation passed. Container build, Linux ownership, real unlock and
VPS acceptance remain unverified; no remote activation or transfer occurred.

To stop the added runtime, use manage.py stop. Preserve its data, keys and
pre-install snapshot. The original temporary source state is also retained for
rollback; do not start it concurrently on the same ports. Removing branding or
this source branch must never delete either vault database.

The browser package uses Bun 1.4.4 with bun.lock migrated from the engineer's
resolved npm lockfile. Dependency versions remain pinned. Upstream toolchains
and lockfiles were not changed. Complete source/dependency security acceptance,
automatic Bitwarden synchronization and off-host recovery remain follow-up work.
