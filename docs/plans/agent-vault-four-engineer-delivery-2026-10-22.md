# Vault and Agent Vault: four independent engineers

22 October 2026. Manager thread: a9cfb71e-af79-472a-b333-a368756aeac2.

## Latest handoff: independent chats, planning chat settled

Osiris subsequently directed that chats 01, 02 and 03 continue independently
while this planning chat finishes. Their original automatic reports to the
manager are disabled by an explicit delivered steer. They must report progress,
blockers and completion in their own chats, without contacting each other or
this planning chat. Technical interfaces, ownership and check allocations stay
unchanged. The bulk-import task is now managed separately by Osiris; this chat
will not contact or monitor that task further.

The manager-assembly section below is the documented future integration
procedure, not background work continuing after this handoff. Independent
commits do not automatically merge, deploy or become a complete application.
See agent-vault-dispatch/00-status.md for verified thread/worktree bindings.

## What we are building

Add the existing Infisical Agent Vault engine to Vault's agent workflow, using
the passwords already maintained in Bitwarden/Vaultwarden. The first usable
version imports login passwords privately, lets an agent select the correct
saved account, fills an app-browser login without printing its password, and
verifies the resulting account. The first browser routes are ClickUp and GoDial.

Osiris asked for three isolated implementation chats and then explicitly added
a fourth chat for immediate bulk import. All four work on separate branches and
worktrees. They report only to this manager. No engineer coordinates with,
messages, reads the chat history of, cherry-picks from, or edits the worktree of
another engineer. No engineer launches further workers.

## Why this is the shortest route

Vault's existing VPS service and signed Bitwarden desktop client remain useful.
Rebuilding either is unnecessary for the first working agent login. The upstream
Agent Vault binary already provides credential storage, identities, permissions,
proxy rules and a management API. Use that engine intact.

The user-authorized bulk copy supplies the first credential source. The
credential engineer can build against the import manifest and Agent Vault API,
rather than implementing desktop decryption, a new Touch ID enrollment, or
continuous Bitwarden synchronization first. Original Bitwarden records stay the
source of truth. Imported copies are a snapshot and require explicit refresh
after a password changes.

The browser pilot worked through an additional privileged private-paste helper.
Agent Vault's generic proxy strips Set-Cookie, so it is not the browser session
transport. A supported host-side login adapter still has to fill the form and
verify identity. Keep that concrete dependency visible.

## The finished experience

1. Osiris asks the agent to open a supported website with a saved account.
2. The agent searches approved account metadata for that website.
3. It selects an opaque account handle bound to its thread and browser tab.
4. The local trusted connector checks account, destination and available access.
5. The host privately fills the intended form; no secret enters model arguments.
6. The normal browser establishes its own website session.
7. The connector reports signed_in only after observing the expected identity.
   Other bounded outcomes include verification_required, credentials_rejected,
   needs_private_unlock and unsupported_provider.

For the initial import, Bitwarden may require one normal private export
confirmation. This is a source-protection requirement, not another design
approval. The user never sends a master password, code or link in chat.

## Included now

- The full pinned upstream Agent Vault engine as a companion, not copied
  cryptographic internals or a substitute Bitwarden database.
- A private import of all eligible active password-bearing login entries from
  the verified owner account, preserving source entries and duplicate records.
- A metadata-only private import manifest with stable account references.
- A small internal engine client, credential provider and app-browser login
  tool, with fixed interfaces so work can proceed independently.
- ClickUp and GoDial provider routes and exact identity verification.
- A concrete deployment package for the existing VPS; manager reviews and
  performs any narrowly scoped deployment after code is assembled.
- At most ten acceptance cases across every engineer and the manager.

## Deferred

No redesign, signed-desktop rebuild or replacement, T3 restart/replacement,
new Touch ID/Keychain enrollment, native adapter signing work, broad provider
framework, password resets, bulk source edits, automatic vault synchronization,
passkeys, TOTP/recovery-secret migration, secure notes/cards/attachments,
organization-wide access expansion, public broker exposure, or full security
certification. Do not make the older independent native-delivery work a
dependency or disturb its checkout.

Kit is excluded because its verification email is obsolete. Closebot V1 is
retired. Cal.com rejected one saved-password attempt; do not reset or retry it
merely to satisfy a test.

## Current verified and historical evidence

- Root repository HEAD at dispatch: adf6d29dd68b59eb10fe51975844a7018d0a49d6.
  The root has uncommitted work; manager creates a separate planning baseline
  without changing its HEAD/index or absorbing unrelated native-delivery work.
- Pinned Agent Vault v0.40.1:
  d5836ec3bb2315de38043d742ae5daca11a4944a.
- Current VPS container osiris-vaultwarden is healthy on the existing Vault
  image. Read-only SSH works as hostinger-osiris using sudo -n for Docker.
  Do not enumerate or modify unrelated services.
- A local trial API at http://127.0.0.1:18431 is already running, with its proxy
  on 127.0.0.1:18432. It now contains real copied credentials. Engineer 4 is its
  ONLY runtime writer during bulk import. Other engineers use fixtures or their
  own disposable dummy state. Never restart or migrate this process mid-import.
- Five earlier copied accounts are in real-pilot. ClickUp identity was verified;
  GoDial reached its dashboard without an independent exact-identity check.
- The default bw CLI was unauthenticated; this says nothing about the separate
  official desktop app's unlock state.
- The registered old Vault MCP returns native_adapter_required. Implement an
  additive supported login path without claiming that native adapter is present.
- Historical upstream suites already passed. Do not rerun them.
- Read docs/agent-vault-evaluation-2026-10-22.md for the source/pilot distinction.

## Engineer 1: engine and deployment

Branch work/agent-vault-engine. Own only:
- integrations/agent-vault/engine/
- deploy/agent-vault/
- docs/agent-vault-engine-handoff.md

Deliver:
- Pure Node ESM createEngineClient following CONTRACT.md.
- Private configuration loader and health check with bounded errors.
- Internal credential write/read callbacks using upstream's supported API.
  Do not put secrets in exceptions, command-line arguments or model output.
- A pinned companion deployment package and exact startup/rollback commands.
  Keep UI/API and proxy private; no Vaultwarden volume/database mount.
- Safe provisioning for the target vault, strict unmatched deny and separate
  administrative/member capability versus proxy-only agent capability.
- A precise source/image pin, notice/license boundary, and minimal config
  examples with placeholders only.
- Identify the shortest manager activation sequence. The first local login
  must not wait for a full VPS migration.

No changes to live services, running trial, personal applications, root
registration or real import data. Prepare concrete deployable files for manager.
If a matching official image is unavailable, supply a pinned upstream build
recipe rather than silently using latest or rebuilding the world.

Acceptance allocation C01-C02 only. Commit owned source and hand back a SHA.

## Engineer 2: account metadata and credential connector

Branch work/agent-vault-credentials. Own only:
- integrations/agent-vault/credentials/
- docs/agent-vault-credentials-handoff.md

Deliver:
- createCredentialProvider following CONTRACT.md.
- Load only the private import manifest; find accounts by bounded query and
  exact HTTPS origin; preserve distinct accounts and stable IDs.
- Obtain the selected credential through engine.withLogin only inside the
  trusted host. Pass it to the browser callback without returning it publicly.
- Refuse an account not present in the manifest or an unapproved origin.
- Validate private file ownership/permissions and schema. Reject a malformed
  or missing manifest with a bounded result; do not dump its contents.
- Provide a status showing import_required or engine_unavailable, not fake
  readiness. Avoid touching CLI login or desktop export. Engineer 4 owns the
  single private export interaction and runtime writes.
- Implement against fixtures/injected engine immediately. Do not wait for import
  or contact the other engineer. The manager supplies runtime config on assembly.

MVP reads the imported snapshot, not live Bitwarden records. State that
limitation plainly. No separate decryption/biometric system or bulk duplication.
Acceptance allocation C03 only. Commit owned source and hand back a SHA.

## Engineer 3: browser login and agent tools

Branch work/agent-vault-browser. Own only:
- integrations/agent-vault/browser/
- docs/agent-vault-browser-handoff.md

Deliver:
- Additive MCP/host login tools without replacing the existing Vault MCP.
- createLoginController and createBrowserDriver following CONTRACT.md.
- Bind selections to threadId/tabId and supported account/provider; expire and
  consume them. Prevent secret-bearing return values.
- Fixed ClickUp and GoDial routes with origin checks and exact identity checks.
  Unsupported providers must stay unsupported.
- Discover the current supported T3 preview/host transport first. Use supported
  MCP/CLI/IPC capabilities. Do not modify T3 internals or Karen's active source.
- Prefer a supported private-fill API. If none exists, the host can use the
  demonstrated temporary native clipboard plus preview_press Meta+V. Only
  trusted code handles the secret, never preview_type, tool JSON, eval scripts,
  or shell argv containing the password. Serialize private fills, check current
  origin/owner/focus before paste and submit, and clear only unchanged clipboard
  contents afterward, including errors. Document the remaining clipboard risk.
- Use the ordinary browser session, not the generic credential proxy.
- A runnable entrypoint plus small config/registration instructions. Do not
  replace existing registrations or restart the active agent/session.
- If the supported preview transport cannot be invoked from the connector,
  report exact capability evidence to manager immediately while completing
  provider/controller code with an injected driver. Never label a mock or
  unsupported host as live login.

Use only your own dummy tab/fixture during implementation. Manager owns final
real ClickUp and GoDial sign-ins. No peer messages or private source state reads.
Acceptance allocation C04-C05 only. Commit owned source and hand back a SHA.

## Engineer 4: immediate private bulk import

Branch work/agent-vault-bulk-import. Own only:
- integrations/agent-vault/import/
- docs/agent-vault-import-handoff.md

This fourth chat was launched immediately from the original HEAD with its entire
self-contained prompt. It does not need the later planning commit to start.

Use the current verified owner account in the official Bitwarden desktop app,
or an existing supported authenticated private stream. Normal export
reauthentication belongs in private native UI. Never extract desktop memory,
unlocked client caches or Keychain secrets to avoid it.

Prepare importer and mode700 private staging location before asking the owner
to confirm export. A temporary normal JSON export may exist outside all
checkouts, under mode600, only long enough to process and verify. Do not emit it
as a tool result. Delete only the owned temporary plaintext export afterward,
including failure paths. Do not claim secure erasure.

Import active login username/password pairs only to a NEW dedicated vault
bitwarden-import-20261022, with strict unmatched deny. Preserve duplicate items
by source ID. Do not copy notes, TOTP, recovery material, passkeys, attachments
or arbitrary custom secret fields. No real-password echo/proxy rules.

Write the private metadata-only manifest specified in CONTRACT.md. Keep progress
receipts nonsecret and report counts rather than the entire account inventory.
The historical 256 vault items are not a current eligible-password count.

Acceptance allocation C06-C07 only. Commit owned importer code; never runtime
data. Notify manager of the one private interaction and final bounded outcome.

## Shared implementation contract

The frozen interfaces and example shapes are in
integrations/agent-vault/CONTRACT.md. Every engineer uses injection/fixtures for
peer components, not temporary incompatible APIs. Proposed changes go only to
manager, who resolves them and sends any necessary updated instruction.

Common runtime state:
~/.config/osiris-agent-vault/integration-v1/
with parent mode700 and private files mode600. Private files never enter source.
The import manifest vaultName initially is bitwarden-import-20261022.

Two credential boundaries are explicit:
- Model/MCP output carries metadata and bounded states only.
- Trusted host modules can handle username/password internally and read a
  private management capability. Proxy-only agent tokens cannot reveal passwords.

The local same-user host remains a workflow boundary, not isolation against
a fully unrestricted agent. Keep that honest; do not expand this MVP into a
container-hardening project.

## Maximum ten acceptance cases

Each case is one targeted acceptance exercise. Do not add suites or subtest
matrices. A failure may be fixed and its same case repeated; record the repeat.
Build/format/secret checks should be narrow, not an excuse to run hundreds of
upstream tests. Escalate any mandatory conflicting repository check to manager.

- C01, engineer 1: companion/client starts with isolated dummy state, health is
  ready, and a restart preserves its dummy credential.
- C02, engineer 1: a proxy-only token cannot reveal a dummy stored password.
- C03, engineer 2: metadata selection resolves only its bound fixture account
  and passes its credential privately to the consuming callback.
- C04, engineer 3: own dummy app-browser form is filled via the supported host
  driver, without a secret-bearing public response.
- C05, engineer 3: wrong-origin selection is denied before private fill.
- C06, engineer 4: eligible source count matches the import manifest count;
  skip/error counts are explicit.
- C07, engineer 4: private readback matches imported username/password values;
  only aggregate counts/booleans leave the helper.
- C08, manager: assembled MCP lookup selects an imported account through the
  real engine and returns only approved metadata.
- C09, manager: one fresh ClickUp login reaches the exact intended identity.
- C10, manager: one fresh GoDial login reaches the exact intended identity.

If native/private approval or export blocks, preserve the working services and
report that action. Do not manufacture a pass or secretly replace a live case
with a mock. Tests beyond these ten are deferred at the user's request.

## Manager assembly and handoff

1. Record each engineer's actual thread/worktree/branch in the dispatch receipt.
2. Receive early blockers only here; route resolutions separately. No peer sync.
3. Inspect each bounded diff and handoff. Merge/cherry-pick explicit owned
   commits into a manager integration branch, preserving the dirty root checkout.
4. Wire the frozen modules and configure the private manifest/engine capability.
   Prefer the already-running local engine for the first login while deployment
   files are prepared independently.
5. Run C08-C10 only. Correct an observed failure with its owner rather than
   starting a broad rewrite or extra suite.
6. Review the additive companion deployment/rollback before any VPS activation.
   Live Vault and its database remain intact. Installed-app replacement remains
   outside this scope.
7. Report source readiness, imported data status, local runtime, VPS deployment
   and real login acceptance separately. Provide the exact daily-use command and
   any one-time private action remaining.

No Git push, PR or public artifact is required to obtain the first working login.
The manager owns later publication and exact-branch remote verification.
