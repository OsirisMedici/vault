# Attribution and licensing

Vault is an independent open-source project by Osiris Medici. It adds web
branding and a charcoal theme to Vaultwarden, plus a separate desktop source
candidate. It is not affiliated with
Bitwarden, Inc. or endorsed by the Vaultwarden maintainers.

Vault's original files are licensed under GPL-3.0-only. See LICENSE.
The pinned upstream repositories retain their original licenses and notices:

- `upstream/server`: Vaultwarden 1.37.4, AGPLv3. Its server binary is unmodified.
- `upstream/web`: the compatible web client, v2026.7.0+0. Its default license is
  GPLv3; any separately licensed modules remain under their own licenses.
- `upstream/desktop`: official Bitwarden clients desktop-v2026.10.0, with GPLv3
  as its default license and a separately licensed `bitwarden_license` directory.
- The upstream client license map reserves `bitwarden_license` for code covered
  by separate terms. The reduced web checkout retains that license map and the
  Bitwarden License text without containing that directory. These are not a
  general production reuse grant.
  The upstream OSS build is the relevant build target. A recursive source
  checkout preserves those notices; it does not change their terms.

The release process uses the exact web client already bundled with the pinned
Vaultwarden image. It changes only display-name strings, logo labels, static
branding assets, index metadata and a translation-cache suffix. It adds CSS through Vaultwarden's supported
`scss/user.vaultwarden.scss.hbs` hook. Existing upstream disclaimers remain.

The desktop candidate uses the GPL OSS target and the original macOS Touch ID
and Keychain implementation. Vault's changes and pending signing/runtime checks
are recorded in `branding/desktop/MODIFICATIONS.md` and `docs/desktop.md`.
No desktop binary is released by this source-preparation work. Preserve upstream
and dependency notices and supply corresponding source when distributing binaries.

The GPL and AGPL do not grant trademark rights. Bitwarden and Vaultwarden are
used here to identify upstream projects. Vault naming/trademark availability
has not been cleared. Do not imply upstream affiliation.

Source:
- https://github.com/dani-garcia/vaultwarden/tree/1.37.4
- https://github.com/vaultwarden/vw_web_builds/tree/v2026.7.0%2B0
- https://github.com/dani-garcia/vaultwarden/wiki/Customize-Vaultwarden-CSS
- https://github.com/bitwarden/server/blob/main/TRADEMARK_GUIDELINES.md
