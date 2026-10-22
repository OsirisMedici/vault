# Vault desktop source candidate

This is an independent derivative of Bitwarden desktop 2026.10.0, changed by
Osiris Medici for Vault on 2026-10-22. It is not an official Bitwarden release.

Changes cover product labels, icons, navigation and login wordmarks, macOS package identity,
an isolated Vault profile, disabled upstream updates, disabled browser bridge and
shared URL registration, disabled SSH/system AutoFill/autotype initialization,
and separate local candidate packaging. The desktop reuses Vault's selected web
charcoal palette, including neutral controls and a matching native window background.
A profile with no saved server selection
defaults to https://vault.scaleadvertisement.com through the existing self-hosted
environment service. Saved selections and the custom-server selector are retained. The existing
macOS biometric and Keychain implementation is retained. Existing attribution,
warnings, API formats, encryption, key derivation and vault synchronization remain
upstream code. Some product copy and support links still identify upstream.

This candidate has no reviewed release feed, Apple signing identity, notarization,
browser extension integration, SSO callback integration, or account/Touch ID acceptance.
Desktop Touch ID requires private sign-in, fresh enrollment and human verification.
No fingerprint-only CLI or agent unlock is implemented.

Corresponding source and build instructions:
https://github.com/OsirisMedici/vault

Keep upstream license notices and supply corresponding source for each binary
distributed. Build the GPL OSS desktop target only. The separate
`bitwarden_license` directory retains its own terms and is outside this route.
