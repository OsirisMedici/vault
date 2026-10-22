# Attribution and licensing

Keyflow is an independent open-source project by Osiris Medici. It adds web
branding and a charcoal theme to Vaultwarden. It is not affiliated with
Bitwarden, Inc. or endorsed by the Vaultwarden maintainers.

Keyflow's original files are licensed under GPL-3.0-only. See LICENSE.
The pinned upstream repositories retain their original licenses and notices:

- `upstream/server`: Vaultwarden 1.37.4, AGPLv3. Its server binary is unmodified.
- `upstream/web`: the compatible web client, v2026.7.0+0. Its default license is
  GPLv3; any separately licensed modules remain under their own licenses.
- The upstream client repository also contains a `bitwarden_license` directory
  and Bitwarden License text. These are not a general production reuse grant.
  The upstream OSS build is the relevant build target. A recursive source
  checkout preserves those notices; it does not change their terms.

The release process uses the exact web client already bundled with the pinned
Vaultwarden image. It changes only display-name strings, logo labels, static
branding assets and index metadata. It adds CSS through Vaultwarden's supported
`scss/user.vaultwarden.scss.hbs` hook. Existing upstream disclaimers remain.

The GPL and AGPL do not grant trademark rights. Bitwarden and Vaultwarden are
used here to identify upstream projects. Keyflow naming/trademark availability
has not been cleared. Do not imply upstream affiliation.

Source:
- https://github.com/dani-garcia/vaultwarden/tree/1.37.4
- https://github.com/vaultwarden/vw_web_builds/tree/v2026.7.0%2B0
- https://github.com/dani-garcia/vaultwarden/wiki/Customize-Vaultwarden-CSS
- https://github.com/bitwarden/server/blob/main/TRADEMARK_GUIDELINES.md
