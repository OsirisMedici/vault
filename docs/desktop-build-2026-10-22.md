# Local desktop candidate, 2026-10-22

Vault is now a compiled macOS arm64 app bundle for local inspection. It is not
an accepted replacement for the working official Bitwarden app. No account,
sync or human Touch ID acceptance has been performed.

## Artifact and inspection

Host: `osiris.local`, arm64, macOS 26.2. The isolated build worktree is
`/Users/osirismedici/.t3/worktrees/Vault/work-vault-desktop-build`.

The app path, relative to that worktree, is:

```text
.cache/desktop-source/apps/desktop/dist-vault/mac-arm64/Vault.app
```

To inspect it on this Mac, use normal macOS launch:

```sh
open .cache/desktop-source/apps/desktop/dist-vault/mac-arm64/Vault.app
```

Inspect the Vault logo, login heading and menu, neutral charcoal palette, and
the selected `vault.scaleadvertisement.com` server. Open the server selector to
review the self-hosted URL and available custom-server controls. No password or
MFA is needed for this inspection. Leave browser pairing, SSH, system AutoFill
and autotype disabled. Do not import the official app's profile.

If macOS blocks this candidate, stop there. Do not remove quarantine, add a
Gatekeeper exception or disable security settings. A successful local launch
does not establish that another Mac will trust the bundle.

## Build evidence

The source starts at Vault main `1b7e6b14cc704c7622ce2c2edab8e86a3fb765fe`.
The desktop upstream is still pinned to official `desktop-v2026.10.0`, commit
`b449ac1d255784380d75ef026343198891286be7`. Pinned submodules were initialized
in this worktree, and original upstream checkouts remain clean.

The build used checksum-verified project-local Node 24.22.1 with npm 11.19.1,
upstream's Rust 1.97.1 toolchain, and Xcode Command Line Tools. The host Node 26
was not used for compilation. Run the repeatable fresh-candidate command:

```sh
bash scripts/build-desktop-local.sh .cache/desktop-source-next
```

The following completed successfully:

- Source verification against 9,157 tracked upstream files, including exact
  review of nine patched files, 66 locale files, and generated branding assets.
- `npm ci`, release N-API compilation, OSS main/preload/renderer compilation,
  and arm64 `electron-builder --dir` packaging with the Vault configuration.
- Native launch through normal macOS `open`. The observed window belongs to
  `com.osirismedici.vault` and loads its packaged `app.asar`, not a web preview.
- Arm64 Mach-O checks for the main executable and packaged native module.
- Strict deep codesign verification of the local ad-hoc signature.

The renderer reports upstream Sass deprecations and bundle-size warnings.
Packaging reports a dependency collector warning about the native package's
build-time `@napi-rs/cli` dev dependency. Packaging still exits zero, and the
arm64 native module and loader are present in the app.

Build logs and source receipts stay in ignored `.cache` directories. They are
local build evidence, not credentials or app-profile backups.

## Resulting behavior

The app has its own Vault name, icon, bundle ID and
`~/Library/Application Support/Vault` profile. This profile did not exist before
the first launch. The chosen charcoal palette comes directly from
`templates/scss/user.vaultwarden.scss.hbs`, loaded after desktop Tailwind. Only
web-specific logo URL replacements are omitted because desktop SVG assets are
already branded. The native window background uses the same charcoal.

An unset server selection is seeded through upstream's self-hosted environment
service with `https://vault.scaleadvertisement.com`. Empty deserialized state is
treated as unset. A saved region or saved URL configuration is preserved.
The existing selector and URL validation remain available. No server is changed.

Upstream updates, browser manifest/socket changes, proxy launch and shared URL
registration remain disabled. SSH, system AutoFill and autotype startup are
disabled for this candidate. Biometric and native Keychain source remain byte
for byte identical to the pinned upstream. Help, license, security and legal copy
retain their upstream attribution.

## Security and remaining acceptance

Zero valid signing identities are installed. The candidate has an ad-hoc
signature with no Apple team identity or notarization. Gatekeeper assessment
rejects it as an untrusted release. The signing configuration requests hardened
runtime, but this ad-hoc build does not establish trusted hardened-runtime
release acceptance or entitlement behavior.

Electron fuses preserve upstream settings. Run-as-Node, environment Node options
and CLI inspection are disabled. Cookie encryption, ASAR integrity validation,
ASAR-only loading and Wasm trap handlers are enabled. The upstream V8 snapshot
and file-protocol privilege settings remain unchanged. No browser proxy,
provisioning profile, AutoFill extension, shared URL scheme or Bitwarden Apple
team identity was found in the bundle.

The official `/Applications/Bitwarden.app` was not modified or replaced. Its
strict signature verification passed before and after the candidate launch, and
its bundle modification timestamp stayed unchanged. Its user data and Keychain
were not read or copied. Existing fingerprint unlock was not retested.

A trusted release still needs Osiris's Developer ID, reviewed nested signing and
entitlements, notarization, and the human acceptance steps in
[desktop.md](desktop.md). Initial account sign-in, sync, biometric enrollment,
unlock/cancel/restart and signed-update continuity remain pending. A complete
dependency/license inventory is required before distribution. No VPS, server,
database, crypto or protected Karen integration changes are included.
