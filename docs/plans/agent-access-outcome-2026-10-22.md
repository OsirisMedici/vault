# Manual desktop and agent login outcome

Updated 22 October 2026. This document records the selected product route and
acceptance boundaries. It does not publish private runtime handoffs or claim
that the protected login integration is complete.

## Outcome

The owner can use the signed official Bitwarden app on Mac, connected to the
existing self-hosted Vault server, to find an account and manually use its
username, password and website link. T3 agents should have a persistent,
discoverable MCP connection for requesting an account and completing a supported
website login through a trusted host.

Ordinary tool results and model context contain bounded account metadata and
request states, not passwords or sessions. A connected service remains subject
to the user's authorization for subsequent actions.

The intended flow is to select the correct account, approve unlock when
required, fill the intended website, and verify the signed-in identity. Website
MFA, passkeys and CAPTCHA may require the owner. An available MCP connection
does not mean an unlocked vault.

GoDaddy is the selected provider for the first real MCP login acceptance.
Other providers are outside that first authentication test.

## Manual desktop decision

The signed official Bitwarden app is the selected Mac route. A signed-in and
sync observation has been reported. Specific item search, opening, copying,
editing and fresh biometric behavior still need their own acceptance evidence.

The branded Vault derivative remains optional. Preserve its source without
weakening runtime security or replacing the selected official client. Its
signing and Gatekeeper limitations remain documented in [desktop.md](../desktop.md).
Choosing the official client does not complete the protected browser bridge.

## Approved scope

The approved work covers the persistent daily T3 connection and the saved-session
lifecycle fix. Reuse the existing protected-login prototype while checking its
compatibility with the actual supported host version.

Prefer a supported independent MCP connection if it meets protected browser-fill
requirements and avoids changing signed host binaries. A metadata-only MCP tool
is an intermediate result until a functioning protected browser adapter is
available and accepted. If native host integration is necessary, document the
prerequisite and prepare a reviewable compatible candidate before any separately
authorized installed-app replacement.

Team sharing, unrelated desktop integrations and universal browser support are
not prerequisites for the first accepted login. Broad browser and site support
is a longer-term goal. Report the actual supported adapters and unsupported
surfaces. Agent browser automation uses the approved T3 preview or in-app
Browser. Personal Chrome remains outside automation.

## Source ownership

Two implementation workstreams have separate file ownership. Private scheduling,
thread identifiers and local checkout locations are intentionally omitted from
this public plan.

The connection owner controls connection architecture, `integrations/vault-mcp/**` and
configuration, account metadata lookup and ambiguity handling, the provider and
browser bridge, request status, and the sole integration-runtime lifecycle.
`PrivateVaultLogin.ts` and its tests belong to this owner. Request lifecycle
review from the lifecycle owner rather than editing the same files concurrently.

The lifecycle owner exclusively controls `VaultCli.ts`, `VaultCli.test.ts`,
`VaultDeviceUnlock.ts` and `VaultDeviceUnlock.test.ts` in the protected integration
source. This owner verifies the existing cleanup and CLI-lock fix, corrects
proven lifecycle defects, and hands exact changes and acceptance needs to the
connection owner. It does not launch competing runtimes or edit browser-owner
files.

The desktop owner controls the branded desktop build, packaging, visual source
and its documentation. The desktop candidate is not a prerequisite for the first
MCP login. Coordinate changes across these ownership boundaries and preserve
existing dirty source.

Original upstream checkouts, the official Bitwarden app and profile, Keychain
enrollment, private profiles and host application data must remain intact.
Checkpoints and publication contain only reviewed non-secret source. Source
publication, installed-app replacement and server deployment are separate actions
with separate authorization.

## Evidence and next steps

1. Read the repository contract and [desktop guidance](../desktop.md). Obtain
   current private handoff information through its authorized local channel;
   private handoff material is outside this public source snapshot.
2. Inspect the active source and supported tool catalog. A signed-in web page,
   opened tab, MCP registration or metadata response is not protected-login
   acceptance. Do not rely on stale runtime receipts.
3. Record the minimum viable connection compatible with the supported host.
   Identify target files, browser adapter and the exact source/build delivery.
   Prefer supported connection discovery over patching a signed installed app.
4. Implement focused checks and coordinate the browser/lifecycle contract.
   Fixture and compilation results establish source behavior only.
5. Prepare one coordinated private acceptance after the connection and protected
   adapter function. Request human input only when the ready control needs it.
   Do not repeat password or enrollment loops to compensate for a missing adapter.

## Current source evidence

The lifecycle owner reports 109 owned CLI/device tests, desktop typecheck,
scoped lint and formatting passing. Fixtures cover cancellation during filesystem
preparation, cancellation between enrollment commands, and unlock after failed
removal. The fixes preserve ordinary request locking without invalidating the
CLI session. Explicit removal waits for local deletion and CLI revocation, and
blocks restoration on failure until retry. `searchAccounts(query)` returns bounded
metadata only.

A browser readiness race remains with the connection owner. These are reported
source and fixture results, not native or installed-integration acceptance. The
active `integrations/vault-mcp/**` connector is excluded from this publication until its owner releases an
explicit stable reviewed source receipt.

## Completion criteria

- Manual desktop uses the selected signed official client against the same
  self-hosted server. Manual search, open and copy behavior, and any claimed
  biometric or edit behavior, require explicit acceptance evidence.
- MCP is registered and discoverable in the daily host. Metadata search resolves
  the intended account, asks on ambiguity and exposes no real secrets in tool
  results.
- Login binds one supported target tab and provider to an explicitly selected
  account and current authorization. Private unlock, host fill and exact provider
  identity verification must succeed. An opened URL or `ready_to_verify` state
  alone is insufficient.
- Ordinary cancellation clears memory and private request work without
  invalidating future enrolled restoration. The next request requires its
  intended approval. Restart restoration and explicit removal are verified
  separately.
- Delivery records exact source, build and configuration; check results;
  supported browser/provider coverage; installed status; pending human checks;
  and rollback/removal steps. A fixture build does not establish universal
  browser support or a completed release.
