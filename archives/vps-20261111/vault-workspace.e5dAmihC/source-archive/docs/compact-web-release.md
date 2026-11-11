# Compact Vault web release

Vault, Folder, Type, and More filters open beside their controls so the results
stay in place. Collections opens below the toolbar. The sidebar can collapse to
a rail, and Settings opens at the bottom. Vaults and the Admin Console are
available in both sidebar modes when the account has access.

## Source and build

Start with the pinned upstream web source and the public
[agent web build tooling](https://github.com/OsirisMedici/vault/tree/f561d1862dc95d86689585f080acedf12e6fc3a7).
Use its preparation script with the pinned Bun 1.4.4. In the isolated prepared
candidate, apply these patches from this repository in order:

1. `branding/web-password-discovery.patch`
2. `branding/web-copy-login.patch`
3. `branding/web-mac-menu-copy.patch`
4. `branding/web-collections-toolbar.patch`
5. `branding/web-compact-workspace.patch`
6. `patches/web-short-master-passwords.patch`

Install the frozen dependencies with lifecycle scripts disabled. Run the OSS
web build with Bun and Node 26.12.0 for Angular and webpack. Package the full
output with the agent web release packager, its branding assets and upstream
notices. Include this repository's Vaultwarden SCSS template and keep the
existing Vaultwarden server image as the base. The Collections transition
adapts the spring from [Cult UI's expandable toolbar](https://www.cult-ui.com/docs/components/toolbar-expandable).

## Acceptance and rollback

Use a disposable Vaultwarden account to test filter selection, clearing,
collection matching, and Escape focus. Sign in and unlock a disposable account
with a one-character master password, then check that a saved item still
decrypts. Run the policy, strength warning, and lock tests described in the
[short-password guide](short-master-passwords.md).

The web release permits a one-character minimum where organization policy
allows it. Short passwords are vulnerable to offline guessing. If users adopt
passwords below the prior sign-in minimum, keep a compatible web build available
during rollback. Follow the backup, activation, and public verification steps
in [operations.md](operations.md).
