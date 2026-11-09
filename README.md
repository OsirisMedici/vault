# Vault

Vault is a self-hosted password manager interface by Osiris Medici. It pairs a
compact web workspace with the Vaultwarden server and compatible web client.
Use it to find saved logins and organize team credentials into collections.

## Try Vault locally

You need Git, a running Docker daemon, and Python 3.9 or later. This quickstart
builds the branded web interface and runs it on loopback with a separate demo
volume. Use disposable logins for the demo.

```sh
git clone https://github.com/OsirisMedici/vault.git
cd vault
mkdir -p .cache/web-vault
base_image=$(python3 -c 'import json; print(json.load(open("upstream.lock.json"))["baseImage"])')
asset_container=$(docker create "$base_image")
docker cp "$asset_container:/web-vault/." .cache/web-vault/
docker rm "$asset_container"
python3 scripts/build-branding.py .cache/web-vault
docker build -t vault-local:overlay .
docker run --rm --name vault-demo \
  -p 127.0.0.1:8000:80 \
  --mount source=vault-demo-data,target=/data \
  -e DOMAIN=http://127.0.0.1:8000 \
  -e SIGNUPS_ALLOWED=true \
  vault-local:overlay
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000), create a demo account,
and save a sample login. In a second terminal, run
`python3 scripts/verify-release.py http://127.0.0.1:8000` from the checkout to
verify the web assets and API origin. Ctrl-C stops the container. The
`vault-demo-data` volume retains your demo entries for the next run. Build the
overlay from a fresh checkout or an empty asset and output directory.

## Build or deploy a web release

| Goal | Start here |
| --- | --- |
| Build the compact workspace with the collapsible sidebar and collection toolbar | [Compact web build and acceptance](docs/compact-web-release.md) |
| Run Vault on an existing Vaultwarden host | [Operations and rollback](docs/operations.md) |
| Evaluate the macOS desktop candidate | [Desktop source and signing status](docs/desktop.md) |
| Explore agent credential brokering with dummy data | [Agent Vault evaluation](docs/agent-vault-evaluation-2026-10-22.md) |
| Try the disposable Mac launcher and agent fixture | [Agent-access pilot source](https://github.com/OsirisMedici/vault/tree/codex/agent-access-pilot-public/integrations/agent-access-pilot) |

The local quickstart uses the display overlay. Building the compact workspace
requires the separate web source pipeline above. The compact build supports
shorter master passwords where organization policy permits them. Use strong
master passwords and apply the policy appropriate for your organization.

For a live installation, use HTTPS and follow the operations guide. Preserve
your existing Vaultwarden data volume, configuration, and proxy rules. The
official Bitwarden desktop, mobile, and extension clients can connect to the same
server. The branded desktop source candidate still needs its own signing and
release acceptance.

## Work on Vault

Start with [Contributing](CONTRIBUTING.md) for source layout, checks, and how to
report a bug. Use [Security](SECURITY.md) for private vulnerability reports.

Vault’s original files are GPL-3.0-only. The pinned server, web client, and
desktop sources retain their own licenses and notices. Read [NOTICE.md](NOTICE.md)
before building or redistributing.
