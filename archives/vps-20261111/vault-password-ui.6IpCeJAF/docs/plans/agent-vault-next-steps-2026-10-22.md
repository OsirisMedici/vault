# Agent Vault next-step proposal

22 October 2026. Proposal after the real-account pilot, not authorization to
implement, migrate, deploy or perform additional website actions.

## Latest direction: shortest integration into existing Vault

Osiris clarified that Vault, its existing password collection, desktop client
and VPS should be reused. The immediate goal is to add the working agent-access
capability to that product, with minimal new infrastructure or duplicated data.
Treat the broader stages below as follow-up, not a prerequisite program.

The minimum browser-login change is a connector from the existing unlocked
Vault client to the private browser-fill mechanism already demonstrated, exposed
as one bounded login action. Account lookup should use existing item references,
and obtain the selected credential only when needed. Keep Vaultwarden as the
source of truth. Full upstream code import does not supply this connector.

Pinned Agent Vault supports built-in and Infisical credential stores, not a
Vaultwarden backend. Its proxy resolves credentials from its own encrypted
tables. Vaultwarden's encrypted server records are not directly readable by
that service. The current five-account trial worked from private copies and an
owner-powered helper. Do not describe it as automatic access to all Vault data.

If retaining the complete Agent Vault engine, run it as a pinned companion
service within Vault's deployment and use supported APIs. Keep its credential
backend and the trusted client/browser connector explicit. Do not rebuild the
signed desktop app merely to place a second server's code inside its bundle.
An API broker and browser password fill are distinct execution paths.

Current read-only checks: default `bw status` is unauthenticated; the registered
Vault MCP reports `native_adapter_required`. These do not imply that the official
desktop app is locked. Its unlock state is separate. No existing credential
bridge has been accepted by this chat. Source integration must not claim that
adding a sidecar alone makes all saved website logins available.

## What we should build

Use the pinned Agent Vault service as the agent-access engine and build a small,
supported browser-login adapter around it. Keep Vault as the durable project
home. Keep the working Bitwarden/Vaultwarden password manager intact while the
agent workflow proves itself. Avoid copying Agent Vault's encryption, database
or proxy implementation into Vault.

The primary user is Osiris, asking an agent to use a selected saved website
account without passwords entering model messages. Later users may grant
different agents access to different projects or client accounts.

## Why this is worth doing

Agent Vault already provides useful credential management, agent identities,
vault permissions, proxy access, tokens, service rules and proposal approvals.
The private browser test established that stored real credentials can support
successful website sign-ins. Reusing those components would let us focus on
selecting the correct account, filling the intended browser tab and verifying
the resulting identity.

This changes the practical priority from more storage implementation to a
small, repeatable login product. It does not establish that the upstream
generic proxy alone supports arbitrary website logins or that this local
same-user trial protects secrets from an unrestricted agent.

## Finished experience

Osiris asks, for example, "Open ClickUp using the saved Scale account." The
agent selects an opaque account reference and requests a login action for a
specific app-browser tab. The trusted adapter checks the destination and grant,
privately fills the login, and returns a bounded result: signed in as the
expected identity, verification required, credential rejected or unsupported.
It never returns passwords or session material. Existing grants can be reused;
request additional approval only when the requested action needs it.

If a provider requests MFA, CAPTCHA or a device approval, the adapter provides
a private human handoff and resumes only when it can verify completion.
Logging in does not authorize subsequent messages, purchases or account edits.

## Included and excluded

The first implementation should cover ClickUp and GoDial, the two observed
successful sign-ins, with exact identity verification on both. Add three current,
supported accounts only after the reusable mechanism passes. Exclude obsolete
Kit access and retired Closebot V1. Do not change Cal.com credentials merely to
make the test pass. Start with password login; passkeys and broader provider
coverage are later work.

Do not migrate the full personal vault, replace the signed Bitwarden app, merge
upstream cryptographic code, change the independent native-delivery thread, or
claim production security acceptance as part of this proposal.

## Technical approach

1. Move the real pilot out of temporary demo custody into a documented private
   service location, with reliable startup, protected administrative state and
   a tested encrypted recovery procedure. Review the two reported high npm
   findings before production use. Treat this as separate deployment scope.
2. Replace the temporary owner-powered clipboard script with a trusted adapter
   exposing a named login action. Prefer a supported browser private-fill API
   to the shared clipboard. Keep privileged store access behind the adapter;
   a generic proxy-only agent token cannot reveal a password for browser fill.
3. Validate exact origin, intended tab, account reference and existing grant.
   Keep request and response schemas narrow. Store browser sessions in a
   dedicated profile under the trusted browser's custody.
4. Use Agent Vault's supported management API/SDK for provisioning and bounded
   API proxy work. Leave its core pinned and independently updateable. Generic
   proxy traffic must not be used as the browser cookie/session mechanism:
   the tested proxy strips `Set-Cookie`.
5. Keep broker administration and storage outside an unrestricted agent's
   filesystem/process access. A separate broker host helps isolate API secrets;
   private browser fill also needs a trusted browser and adapter boundary.
6. Add the working login adapter to Vault through supported tools. Decide on a
   Bitwarden/Vaultwarden credential-source bridge only after testing it. No
   automatic synchronization or existing connector is assumed. Selected copied
   credentials can diverge when the source password changes.

For API work, service host/path matching is not action-level permission. A named
adapter must check method/input and return approved fields where that matters.
The dummy echo test returned an injected credential, so outbound injection alone
does not guarantee that provider responses cannot disclose secrets.

## Testing and decision

Repeat ClickUp and GoDial from a fresh browser state using only the login tool,
with no owner token available to the calling agent. Verify the exact account,
normal session reuse, logout and relogin. Then reach five supported accounts.
Exercise wrong credentials, wrong origin, a redirect to another origin, an
ungranted account, expired access and private verification handoff. Confirm no
password/session value enters ordinary tool output or persisted logs.

Test broker expiry/revocation separately from website logout. Revoking broker
access does not automatically revoke a session already issued by a website.
If access should end with the grant, the adapter/browser must enforce that
session policy too. Existing evidence covers new proxy connections, not every
established tunnel or long-lived browser session.

Success means Osiris can request repeatable exact-account sign-in through one
supported action, while unauthorized requests fail and recovery works. At that
point, integrate the service and browser tools into Vault. Reconsider replacing
human password-manager features only if a later product decision requires it.

## Evidence and application map

The [evaluation](../agent-vault-evaluation-2026-10-22.md) records observed tests.
The [source assessment](../agent-vault-research-2026-10-22.md) provides pinned
references and license boundaries. This proposal uses upstream `v0.40.1`, commit
`d5836ec3bb2315de38043d742ae5daca11a4944a`.

| Area | Purpose | Evidence boundary |
| --- | --- | --- |
| Vaults | Group credentials, service rules and grants. | Isolated dummy and real pilot vaults used. |
| Credentials | Store static secrets; upstream also supports OAuth credentials. | Static real pairs imported. OAuth lifecycle not tested. |
| Agents and users | Represent automation and human administrators. | Restricted agent provisioned; important denial checks passed. |
| Tokens | Authenticate agents and provide scoped sessions. | New-connection revocation tested. Full expiry/tunnel behavior pending. |
| Services and proxy | Match destinations and inject credentials into HTTP requests. | Dummy HTTPS bearer and Basic auth passed. Browser cookies stripped. |
| Proposals | Ask humans to approve credential/service configuration changes. | Source reviewed. Full interactive lifecycle not tested. |
| Skills | Store named instruction content inside a vault. | UI/source reviewed. Instructions do not enforce authorization. |
| Logs | Inspect proxied request metadata. | Dummy structured-log checks passed. Complete production audit not performed. |
| Settings and stores | Control instance/vault policy and credential backends. | Strict deny used. Infisical backend, Postgres and container isolation not accepted. |

Upstream's core is MIT-covered with enterprise-directory and third-party
exceptions. Retain notices and existing Vault component license boundaries in
any later redistribution. Prefer an independently maintained service dependency.
