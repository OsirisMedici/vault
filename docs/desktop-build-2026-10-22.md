# MacBook desktop build, 2026-10-22

## Outcome and current boundary

The requested outcome is an installed Vault app that uses the existing hosted
account, preserves the official Bitwarden installation, and supports separately
verified Touch ID unlocking. The source now compiles and packages on the M2
MacBook Air. The hardened local build cannot launch with an ad hoc signature.
It must not be described as ready for passwords or as an accepted replacement.

## Verified

- Used the existing repository and pinned desktop commit
  `b449ac1d255784380d75ef026343198891286be7`. The upstream checkout stayed clean.
- Prepared `.cache/desktop-macbook-20261022` without copying account data.
  A fresh source verification after the framework fix checked 9,157 upstream
  files, seven patch files and 66 product-label locales. Biometric and Keychain
  source remained byte-for-byte identical to upstream.
- Installed Node 24 alongside the existing Node version. Used Rust 1.97.1 and
  the installed Xcode Command Line Tools. Global Node selection was unchanged.
- `npm ci` completed. Main, preload and renderer production OSS builds passed.
  Renderer output included upstream Sass, unused-file and bundle-size warnings.
- Native release compilation passed. A direct module-load check initially
  failed with missing `ASCredentialIdentityStore`. Explicitly linking
  AuthenticationServices in the generated native Objective-C build fixed it.
  The corrected arm64 N-API module loaded successfully in Node 24.
- Packaged with `electron-builder.vault.json`. The app contains the arm64 N-API
  binding, upstream notices, changed-source attribution and an inventory of
  3,212 npm lock entries and 650 Cargo lock entries. This includes build tools
  and other platforms; it is not a runtime-only license or vulnerability audit.
- Package identity is `com.osirismedici.vault`, product name Vault. The build has
  no bundled upstream proxy or provisioned extension. Upstream updates and
  shared URL/browser integrations remain disabled by the existing patch.
- Electron fuses disable RunAsNode, Node options and Node CLI inspection; enable
  cookie encryption, ASAR-only loading and embedded ASAR integrity validation.
- Signed nested code and the outer app ad hoc using `@electron/osx-sign`, with
  hardened runtime and only the existing JIT entitlement. Strict deep signature
  verification passed. There is no Apple team identity or notarization ticket.
- Existing hosted `/alive` and `/api/config` responded successfully. API,
  identity, notifications and web vault destinations matched the hosted origin.
  The incognito web login page loaded without submitting credentials.
- Read only the saved environment fields from the two client profiles. Both
  selected the same self-hosted origin. The existing Vault profile had no
  account state. No tokens, passwords, decrypted items or Keychain values were
  read, copied or printed. Browser native messaging manifest metadata stayed
  unchanged.
- The official Bitwarden app retained its valid signature and Gatekeeper
  acceptance. No official app, profile or Keychain enrollment was changed.

## Launch blocker

The app was copied to `/Applications/Vault.app` and launch was attempted.
macOS terminated it before app initialization. The crash report states:

```text
Library not loaded: @rpath/Electron Framework.framework/Electron Framework
mapping process and mapped file (non-platform) have different Team IDs
```

Both components have ad hoc signatures and no team ID. Gatekeeper assessment
also rejects this candidate. This Mac reports zero valid code-signing identities.
Strict codesign verification proves bundle integrity, not trusted publisher
identity, Gatekeeper acceptance, successful launch or safe account use.

No Gatekeeper setting, quarantine attribute, library-validation entitlement or
hardened-runtime protection was weakened to get past this failure.

The failed installation was moved out of Applications into the ignored review
folder `.cache/desktop-macbook-blocked/Vault.app`, after verifying that it still
matched this run's candidate. The packaged original remains at
`.cache/desktop-macbook-20261022/apps/desktop/dist-vault/mac-arm64/Vault.app`.
No failed Vault app is left in Applications as though it were ready for use.

## User-selected handoff

Osiris chose the signed official Bitwarden app with the existing server for now.
The app was opened from `/Applications/Bitwarden.app`. Its existing account
loaded the vault view. No item detail, password or edit action was opened.
The File > Sync now command was invoked. The official profile then recorded a
fresh last-sync timestamp of `2026-10-22T14:27:10.740Z`, verified at 14:27:28 UTC.
No success or error toast was exposed by accessibility immediately afterward.
This is not a two-client edit/sync test
or a new human Touch ID acceptance test. No separate Vault sign-in is needed
to continue using the official client.

## Remaining acceptance

Use an owner-provisioned Apple Developer signing identity and reviewed
entitlements, then sign and notarize the final build. Recheck Gatekeeper,
launch, profile isolation and the original official app. A separately authorized
local development build would have a different security boundary and must be
documented separately.

After the launch checks pass, the owner signs in privately with the existing
account and MFA, confirms a harmless known item and enrolls Touch ID afresh.
Test lock/unlock, cancellation, quit/relaunch and timeout behavior. Verify an
approved harmless revision against a second client. Login, sync and Touch ID
have not been verified in this build. Browser pairing, AutoFill extensions,
SSH, autotype and agent unlock remain outside acceptance.

Build logs and binaries remain in ignored `.cache` paths. No source push,
public binary release, VPS deployment or protected-login integration change
was performed.
