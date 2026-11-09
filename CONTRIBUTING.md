# Contributing to Vault

Reports that describe what you tried, what you expected, and what happened help
maintainers reproduce a problem. Include your Vault revision, build type
(display overlay or compact web build), browser or client version, and
operating system. Use a disposable vault for screenshots and reproduction.
Open a [GitHub issue](https://github.com/OsirisMedici/vault/issues) for ordinary
bugs or feature requests. Use the [private reporting process](SECURITY.md) for
security issues.

## Source layout

- `branding/`, `templates/`, and `patches/` contain Vault’s assets, theme,
  and changes to the web and desktop clients.
- `scripts/` prepares isolated candidates and verifies built releases.
- `upstream.lock.json` records the upstream pins. Initialize just the
  submodule you need. For web source work, run
  `git submodule update --init --depth 1 upstream/web`.
- `docs/` contains [web build](docs/compact-web-release.md),
  [desktop](docs/desktop.md), and [operations](docs/operations.md) guides.

Keep the upstream checkouts pinned. Make client changes in a generated
candidate and save the reviewed change as an owned patch. Keep existing
license notices with the corresponding source.

## Before opening a pull request

1. Run `git diff --check`. For the overlay, follow the README quickstart and
   run `scripts/verify-release.py` against the disposable local instance.
2. For a web source patch, initialize `upstream/web` and run
   `python3 scripts/test-web-preparation.py`. For desktop preparation changes,
   initialize `upstream/desktop` and run
   `python3 scripts/test-desktop-preparation.py`.
3. Include the checks you ran and any user-facing behavior that still needs
   verification. Keep vault contents, passwords, recovery codes, exports,
   backups, session data, and private operational receipts out of Git and
   screenshots.
