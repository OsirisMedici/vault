# Vault

An open-source vault interface by Osiris Medici, built on Vaultwarden and its
compatible web client. Vault gives the web app a charcoal theme and its own
name while retaining the upstream password-manager implementation.

The deployed web release changes appearance and branding. This repository is
also the durable home for further Vault app work. A pinned macOS desktop source
candidate is documented in [docs/desktop.md](docs/desktop.md); it has not been
compiled, signed or accepted as a replacement app. Team sharing configuration,
agent permissions and protected browser credential filling are separate work.
Official Bitwarden desktop, mobile and extension clients retain their branding
and can keep using the same server.

An isolated [team/agent policy foundation](docs/team-agent-access-implementation.md)
now rehearses scoped grants, approvals, expiry, revocation and audit using
harmless fixtures. It has no authentication or broker adapter; real execution
is denied. It is not included in the deployed image or desktop candidate.

## Source

```sh
git clone --recurse-submodules https://github.com/OsirisMedici/vault.git
cd vault
git submodule update --init --depth 1
```

- `upstream/server` contains the complete pinned Vaultwarden source.
- `upstream/web` contains the pinned compatible web client source, without desktop.
- `upstream/desktop` contains the pinned official desktop-capable clients source.
- `upstream.lock.json` records exact release tags, commits and the base image.
- `branding/` holds original Vault assets and a display-name source patch.
- `templates/scss/user.vaultwarden.scss.hbs` is the supported theme override.
- `scripts/build-branding.py` creates the release's display-only asset overlay.
- `scripts/prepare-desktop.py` applies Vault desktop changes to an ignored copy,
  keeping the upstream checkout and the installed official app intact.

Submodules preserve the upstream licenses and make future security updates
reviewable. They are source checkouts, not a claim that every file has the same
license. Read [NOTICE.md](NOTICE.md) before building or redistributing.

## Build the branded release

Requirements: Docker and Python 3.9 or newer. No Node dependencies are needed
for the display-only release overlay.

```sh
mkdir -p .cache/web-vault
docker create --name vault-assets vaultwarden/server:1.37.4@sha256:efb3cde962015fcc036b2ea625242248611943b27212ebf4392841fb30fad055
docker cp vault-assets:/web-vault/. .cache/web-vault/
docker rm vault-assets
python3 scripts/build-branding.py .cache/web-vault
docker build -t osiris-vault:0.1.1 .
```

`vault-assets` is never started. The build extracts only public static client
assets. Use an empty cache and overlay directory for a new release.
The script fails if the expected branding strings no longer match. It writes a
new content-hashed main filename so existing browsers do not reuse old code.

For deeper UI work, create a branch in `upstream/web`, apply
`branding/web-source.patch`, follow its build prerequisites, and use its OSS
`npm run dist:oss:selfhost` target. Audit the license coverage of any additional
modules before enabling them. Keep authentication, key derivation, encryption,
storage and synchronization changes separate from visual changes.

## Host it

Vault is a custom image of the same Vaultwarden server. It is not a migration
to another password service or a second account. For an existing installation,
build the image on its host, verify a fresh encrypted backup, and change only
the Compose service image to `osiris-vault:0.1.1`. Retain the existing data volume,
domain, network, proxy gates, runtime environment, user, limits and permissions.
The image sets `TEMPLATES_FOLDER=/vault-templates`; check for an existing
override before deploying.

Use HTTPS through the existing reverse proxy. Never expose `/admin` or enable
public registration as a side effect of branding. The upstream deployment and
enrollment documentation still applies.

Read [docs/operations.md](docs/operations.md) for verification and rollback.
Run `python3 scripts/verify-release.py https://your-vault.example` for public
asset checks without signing in. For a deployment with the documented closed
proxy gates, add `--expect-proxy-gates`.
This repository deliberately contains no runtime environment, private account
directory, credentials, vault database, exports or backups.

## License

Vault's original files are GPL-3.0-only. The server is AGPLv3 and the client
has its own license map. Existing upstream notices and disclaimers are retained.
See [NOTICE.md](NOTICE.md). The Vault name has not received trademark clearance.
