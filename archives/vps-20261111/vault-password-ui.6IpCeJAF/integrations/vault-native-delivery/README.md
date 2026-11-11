# Native adapter delivery

This directory prepares the existing protected-login adapter for the installed
T3 Nightly. Osiris should be able to request a saved account in the same T3
browser, approve native unlock and verify the destination identity. Packaging
and source tests do not accept that experience.

Scope is the adapter's source receipt, reproducible packaging, trust checks and
application-bundle rollback. It does not rebuild Bitwarden, export credentials,
change Infisical, install a second test app or publish source. The current
implementation and all results are owned by this chat. The former coordinator
is testing Infisical independently and must not receive adapter updates.

## Pinned source and identity

- T3 base: `3b95e7831b11b17627dff16843bc087bfca397ec`, MIT. Preserve T3-LICENSE.
- Installed version: `0.1.2-nightly.20261022.3512`, arm64.
- Bundle: `com.t3tools.t3code`, `T3 Code (Nightly).app`.
- Existing signing team: T3 Tools, Inc., `ARK85ZXQ4Z`.
- `patches/t3-3512-vault-adapter.patch` preserves the 31 changed/new adapter
  source and test files against that base. It is the existing integration,
  including the lifecycle fixes, not a newly accepted authentication design.
- Patch SHA-256: `319e25661054576a9beb29697a171ec121875fb0997a7f551837ba468af24279`.

Apply this patch only to a fresh generated copy of the exact base. Never apply
it to the installed signed bundle, pinned upstream submodules or dirty Karen
checkout. All 31 patched files were replayed against the base and matched their
recorded hashes. Build source remains `.cache/t3-vault-native-3512-source`.

The earlier `-vault.1` package suffix is incompatible with this base's anchored
Nightly version recognition. It selected Beta branding and runtime name. Keep
the upstream version exactly; distinguish artifacts through filenames, hashes
and the source receipt. The macOS packaged Electron profile remains
`~/Library/Application Support/t3code-v2`; default server state is
`~/.t3/userdata`. Neither was opened or changed for this work. Environment
overrides must remain unchanged at eventual cutover. A matching path alone
does not establish Keychain/signing continuity.

## Reproduce without installing

Run from the Vault root. New output directories must not already exist.

```sh
python3 integrations/vault-native-delivery/delivery.py build \
  --source .cache/t3-vault-native-3512-source \
  --output .cache/native-delivery-new \
  --kind diagnostic
```

This runs the integrated desktop/server/web build with development autolaunch
disabled. It packages the exact Nightly identity without an update feed,
then signs only the generated diagnostic bundle with an ad-hoc identity and
hardened runtime. It claims no Apple team, restricted entitlement or Keychain
access group. It never launches or installs the app. No runtime protections or
Electron fuses are disabled. Current fuse values match the signed installed app.

The verifier checks byte-identical packaged main/preload code, nine native
modules against the build's source map, the embedded base/version, strict
signature integrity, Gatekeeper and stapling. The diagnostic's resource seal
passes. Its trust checks deliberately fail; do not launch it with real accounts.
The signing helper is not an installation or Gatekeeper bypass.

```sh
python3 integrations/vault-native-delivery/delivery.py verify \
  '.cache/native-delivery-20261022-r2/payload/T3 Code (Nightly).app' \
  --require-trusted
```

This must exit 1 for the current diagnostic. `verify` without
`--require-trusted` prints a non-secret inspection receipt, not acceptance.

## Trusted delivery prerequisite

This Mac currently has **zero valid code-signing identities**. The trusted build
preflight exits 1 before compilation if there is no valid Developer ID
Application identity for the installed team. Keeping the existing signing team
preserves the current app's entitlement and Keychain trust boundary. The
installed app carries that team's app identifier, associated domain and WebAuthn
Keychain group. Copying its signed bundle does not grant permission to sign
changed code with that identity.

The smallest in-place delivery dependency is an authorized T3 Tools build/signing
host producing this source with its valid Developer ID identity, authorized
provisioning profile and notarization. No private key or Apple credentials
should be pasted into this chat or copied from the installed app. An unrelated
personal Developer ID would require a separately reviewed signing/Keychain and
passkey migration and is not a verified drop-in replacement.

On the authorized signing host, set upstream's private signing/notarization
configuration outside source control, including `T3CODE_APPLE_TEAM_ID`,
`T3CODE_MACOS_PROVISIONING_PROFILE` and its public Clerk domain configuration.
Use the same command with `--kind trusted`. The upstream signing hooks remain
responsible for signing and notarization. Completion requires matching app/team
identity, hardened runtime, strict codesign, accepted Gatekeeper assessment,
valid stapled ticket, matching payload/fuses and no unexpected update feed.
Failure leaves the artifact uninstalled. This repository has no installer or
automatic app-stop action.

## Rollback and cutover

The verified original signed app is archived at:

`.cache/native-rollback-20261022-r1/T3-Code-0.1.2-nightly.20261022.3512-original-signed.zip`

SHA-256: `fce9c13f65786a27bcf1a41265d54eb18f3c47c9d1af5afdfaab19bebb625a11`.

Its extracted `verified-rollback/T3 Code (Nightly).app` passes strict codesign,
Gatekeeper and stapler validation. This archive contains only application code,
not chats, profiles, enrollment, vault content or logs. A new archive can be
made with `delivery.py backup --output .cache/native-rollback-new`.

At an eventual trusted cutover, first arrange a safe shutdown boundary with
Osiris **in this native-delivery chat**. Do not stop active T3 unexpectedly or
coordinate through the independent Infisical chat. Recheck the installed
revision and preserve any runtime path overrides. Once T3 has closed cleanly,
make an appropriate private, consistent state backup outside source control.
Do not inspect or transcribe its contents. Preserve the original app bundle and
install a complete verified signed replacement; never patch it in place.

If native connection or acceptance fails, close only that exact replacement
through the coordinated boundary. Verify the rollback ZIP hash, extract it to
a fresh directory and verify its app with `delivery.py verify --require-trusted`.
Restore that complete original bundle to `/Applications/T3 Code (Nightly).app`
and launch normally with the same paths. Preserve chats, browser data, existing
enrollment and Keychain. Do not automatically restore stale state over live
data or remove device enrollment to compensate for a connection failure.

## Acceptance still pending

The independent Vault MCP remains registered for Codex. The adapter listens on
the same user's private Unix socket
`~/.config/osiris-agent-vault/run/t3-vault.sock`, with directory mode 700 and
socket mode 600. Native source binds thread/tab to an attached desktop preview
and captured ownership generation. Fixture tests cover revocation and stale
requests; actual installed native binding has not been accepted.

After trusted delivery, verify discoverable MCP and locked native status in the
actual installed app, then approved metadata lookup in an owned browser tab.
Use the ready private host UI for any one-time enrollment and native Touch ID.
Test cancellation, a new approved request, GoDaddy login with exact account
identity, subsequent use and restart restoration. Website MFA/CAPTCHA may need
Osiris privately. Do not repeat credential loops after a failure.

Only GoDaddy and Google/Gmail routes exist. Metadata from other websites does
not grant fill support. Five distinct website sign-ins cannot currently be
promised. Four additional supported account tests require approved metadata to
show appropriate accounts after native delivery; four additional website
providers require more adapter implementation. No real login or Touch ID
acceptance was performed by this packaging work.

See `receipt-2026-10-22.md` for exact artifacts and verification.
