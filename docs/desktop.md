# Vault desktop route

## Outcome

Osiris wants a macOS app called Vault that connects to the existing Vaultwarden
server and keeps convenient, secure Touch ID unlocking. The finished app should
show Vault in Finder, the Dock, the menu and its main navigation. It should sync
the same account without importing a decrypted export or changing the server.

Success requires a separately packaged and signed Vault app, fresh private
sign-in and biometric enrollment, and human verification of lock, unlock,
cancellation, restart and sync. A source patch or a successful login screen does
not prove those outcomes.

## Why the installed desktop still says Bitwarden

There are three separate components:

- Vaultwarden runs the server and stores encrypted vault data.
- This repository's web branding makes the browser app say Vault.
- The installed Bitwarden desktop app is an official client connected to that
  server. Its name, resources, signature and Touch ID enrollment belong to that
  desktop build. A website change cannot rename it.

On 2026-10-22, the inspected Mac was `osiris.local`, arm64, macOS 26.2. The
official app was Bitwarden 2026.10.0, bundle ID `com.bitwarden.desktop`, signed by
Bitwarden Inc., with a stapled notarization ticket. Strict signature verification
passed. Osiris had already verified fingerprint unlock himself. This run did
not repeat that human biometric test or inspect app account data.

Renaming or patching that installed bundle would risk its signature and existing
trust. The route here builds a separate derivative from source. The official app
remains the accepted client until Vault passes its own acceptance.

## Source and scope

The existing server and web pins stay unchanged. `upstream/web` is the reduced
Vaultwarden compatible web source; it contains no desktop app. The added
`upstream/desktop` gitlink points at official Bitwarden clients
`desktop-v2026.10.0`, commit `b449ac1d255784380d75ef026343198891286be7`, matching
the installed client's release. It is a source dependency inside this project,
not a second Vault project. `upstream.lock.json` records all three pins.

This is a reproducible source candidate for macOS arm64. Included:

- Vault product-label translations, login/page titles, landing/navigation wordmarks
  and key icon. Security, help and license copy retain upstream attribution.
- The same selected charcoal palette as the Vault web app, generated from
  `templates/scss/user.vaultwarden.scss.hbs` after desktop Tailwind. Web-only logo
  URL replacements are omitted because native SVG assets are already branded.
  The native window background is also charcoal.
- A proposed bundle ID of `com.osirismedici.vault`, a Vault package name and a
  fixed `~/Library/Application Support/Vault` profile. The name and bundle ID
  have not been cleared or registered with Apple.
- The existing macOS Touch ID and native Keychain source, byte for byte.
- Disabled upstream auto-updates, official browser manifest/socket operations,
  proxy launch and shared `bitwarden://` registration. Removal operations are
  disabled too, so Vault cannot delete the official client's manifests.
- Disabled SSH agent, system AutoFill and autotype initialization for acceptance.
- A self-hosted default of `https://vault.scaleadvertisement.com` only when the
  profile has no saved environment. Saved server choices and the custom-server
  selector continue to use the upstream environment service and validation.
- A separate unsigned local packaging configuration that retains upstream
  Electron security fuses, contains source notices, and excludes upstream
  signing/notarization hooks, provisioning profiles and extensions.

Excluded from this candidate: a release/update service, browser-extension
pairing, URL/SSO callbacks, Safari/macOS AutoFill extension distribution,
cross-platform packaging, and CLI or agent fingerprint-only unlock. Other
upstream integrations remain unverified and must stay disabled during acceptance.
Some secondary copy and support links
still identify upstream. This is not a full visual redesign.

The candidate does not change server APIs, key derivation, encryption, biometric
authentication logic or sync logic. Identity and integration restrictions are
reviewable in `branding/desktop/source.patch`. No data is copied from Bitwarden.

## Touch ID and signing

The GPL OSS desktop target loads the macOS biometric service. The service calls
Electron's `canPromptTouchID()` and `promptTouchID()`, then obtains the biometric
key from the native Keychain helper after successful authentication. Its service
name is `${app.getName()}_biometric`. Setting the name before loading services
gives Vault its own `Vault_biometric` enrollment. Keep this implementation intact.

Relevant source is under `apps/desktop/src/key-management/biometrics/` and
`apps/desktop/desktop_native/core/src/password/macos.rs` in the pinned checkout.
No private Keychain entry was read or changed to establish this route.

The Mac reported **zero valid code-signing identities**. The shell's Node was
26.12.0; upstream requests Node 24 in `.nvmrc`. Source preparation and macOS icon
conversion work without installing the full JavaScript/Rust toolchain.

The supplied packaging config deliberately produces a local unsigned candidate.
It does not claim Bitwarden's Apple team, access groups or signing identity.
Upstream's normal `pack:mac` hooks are unsuitable: they sign proxy binaries,
copy extensions and contain Bitwarden-specific provisioning/notarization values.
Use the Vault config, not those commands. Disabling macOS security or bypassing
Gatekeeper is not an acceptance step.

For a trusted release, provision Osiris's own Apple Developer signing identity,
register the chosen bundle ID, review entitlements, and sign all nested code and
the outer app with hardened runtime after setting fuses. Add a reviewed
notarization step using private Keychain-backed credentials, staple its ticket,
then verify strict codesign and Gatekeeper assessment. The current config's
`identity: null` must be replaced in that reviewed release configuration. Signing
does not itself prove that Touch ID works. Recheck human enrollment, cancellation,
restart and updates under the final identity before considering replacement.

Initial sign-in still needs the account's private password/MFA as applicable.
macOS and upstream may require fallback authentication. Existing official Touch
ID is not evidence of fingerprint-only CLI or agent unlock.

Osiris's integration requirement is one explicit private enrollment followed by
fingerprint-only normal agent unlock and automated login. Do not repeat email,
master-password or MFA test loops. The parent integration task owns the separate
Electron Touch ID gate and Keychain-backed `safeStorage` sealed CLI unlock key,
identity validation and revocation. That key is not the master password. No such
broker is implemented in this repository, and this desktop work must stay
separate from that active implementation. Its current completion is unknown here.

For the parent, Electron documents two relevant constraints. `promptTouchID()`
authenticates user presence; it does not itself protect stored data. A host must
gate every sensitive operation and fail closed on denial. `safeStorage` uses
macOS Keychain protection and needs a consistent signing identity to avoid
permission prompts across rebuilds. This Mac's lack of a signing identity is a
release/continuity limitation, not proof that the APIs cannot run in development.
Check API availability against the parent's actual Electron version. No gate or
`safeStorage` runtime probe was run here.

## Prepare and inspect

From the repository root, initialize the pinned sources and create a new ignored
candidate. Preparation fails on a dirty or mismatched desktop source, an
unexpected source remote, an existing output directory, or output outside
`.cache`. It never installs or launches an app.

```sh
git submodule update --init --depth 1
python3 scripts/prepare-desktop.py
bash scripts/build-desktop-icons.sh
python3 scripts/verify-desktop.py .cache/desktop-source
```

The candidate has a hash receipt. Inspect its diff and packaging config before
building. To prepare another candidate, use a new `.cache` path with `--output`
and pass that same path to the icon and verification scripts. Discarding only
that generated candidate reverses preparation. The upstream submodule stays
clean and the installed app stays intact.

## Build a local candidate

Use Node 24, npm, Rust/Cargo and Xcode Command Line Tools on macOS arm64. Complete
the upstream prerequisites, inspect dependencies and license coverage, then run
the following in the **generated candidate**, not the pinned submodule:

```sh
cd .cache/desktop-source
npm ci
cd apps/desktop
npm run build --workspace @bitwarden/desktop-napi -- --release
npm run build:oss
CSC_IDENTITY_AUTO_DISCOVERY=false npx --no-install electron-builder \
  --config electron-builder.vault.json --mac --arm64 --dir --publish never
```

The expected candidate output is beneath `apps/desktop/dist-vault/`. The native
N-API command builds the existing macOS Keychain module; it does not install a
browser proxy or build the Swift AutoFill provider. Do not use upstream's
development launcher, which enables debugging flags. Do not launch with a real
account until the reviewed signing and isolation checks pass.

The full native release, OSS main/preload/renderer compilation and arm64 packaging
commands passed on `osiris.local` on 2026-10-22. The app launched through normal
macOS `open` without credentials or a security bypass. This establishes a local
launch, not account, sync or Touch ID acceptance. See the
[build receipt and handoff](desktop-build-2026-10-22.md).

For a fresh candidate, the repeatable command below provisions checksum-pinned
Node 24.22.1 inside this project's `.cache/runtime`, prepares and verifies source,
then runs the same build and packaging steps. Cargo honors upstream's Rust 1.97.1
toolchain file when rustup is available. It never launches, installs or publishes.
The output directory must not already exist.

```sh
bash scripts/build-desktop-local.sh .cache/desktop-source-next
```

The local bundle has an ad-hoc signature so modified arm64 Electron code can run.
It has no Developer ID, Apple team identity or notarization. Strict deep codesign
verification passed; Gatekeeper assessment rejected it as an untrusted release.
Do not remove quarantine, add security exceptions or disable Gatekeeper to share
or launch it. A complete dependency/license inventory and trusted release remain
pending.

## Acceptance and handoff

1. Verify the candidate's product/bundle ID, signature, notarization, entitlements
   and Electron fuses. Confirm its updater is disabled and it contains no
   upstream proxy, provisioned extension or Bitwarden team identity.
2. Use an isolated macOS test account first. Confirm no official app data,
   Keychain service, browser manifests, sockets or URL registration change.
   Check the Vault name and key icon throughout launch, menu, Dock and navigation.
3. Select the existing self-hosted server in the client. Have Osiris privately
   sign in with MFA, inspect a known harmless item, and enroll Touch ID afresh.
   Do not copy the official profile or export/decrypt the vault for migration.
4. Lock and unlock with Touch ID; cancel a prompt and confirm access stays
   locked; quit/relaunch; test the upstream fallback and lock/timeout behavior.
   Confirm account switching/logout do not expose another account's items.
5. Verify sync with an approved harmless record and a second client. Keep SSH,
   autotype, browser bridging and extensions disabled until separately accepted.
6. Reverify the official app and its existing fingerprint unlock. Retain it
   until a later reviewed decision explicitly replaces it. Removing a failed
   candidate must not remove the official profile or Keychain entries.

Source preparation, patch/identity checks, public website checks and a Git push
are separate from packaged runtime acceptance. No VPS redeployment, database
change, official-app replacement or protected browser-login test is part of
this work. Karen's active protected-login checkout remains with its owner.

## License and maintenance

Vault's original files remain GPL-3.0-only. The upstream server is AGPLv3. The
desktop client's default license is GPLv3; `bitwarden_license` retains separate
terms. Use `build:oss`, preserve notices and changed-source attribution, and
provide the exact corresponding source/build instructions with distributed
binaries. A complete dependency/license inventory is still required before
distribution. Trademarks are separate from code licenses.

Matching the installed desktop release limits initial differences. It does not
establish that all pinned server/web/desktop dependencies are the newest secure
versions. Track security advisories and review upgrades with patch reapplication
and fresh acceptance. A derivative needs its own update ownership.

Primary references:

- [Pinned client license map](https://github.com/bitwarden/clients/blob/desktop-v2026.10.0/LICENSE.txt)
- [Pinned desktop build targets](https://github.com/bitwarden/clients/blob/desktop-v2026.10.0/apps/desktop/package.json)
- [Pinned packaging configuration](https://github.com/bitwarden/clients/blob/desktop-v2026.10.0/apps/desktop/electron-builder.json)
- [Upstream desktop build prerequisites](https://contributing.bitwarden.com/getting-started/clients/desktop/)
- [Official biometric setup](https://bitwarden.com/help/biometrics/)
- [Electron Touch ID API and protection boundary](https://www.electronjs.org/docs/latest/api/system-preferences#systempreferencesprompttouchidreason-macos)
- [Electron safeStorage and signing continuity](https://www.electronjs.org/docs/latest/api/safe-storage)
