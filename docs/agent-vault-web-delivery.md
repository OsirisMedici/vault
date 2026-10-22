# Agent access web delivery

The combined web UI reuses Vault's unlocked account and existing API client.
Its authenticated bridge lists supported imported accounts and queues explicit
sign-in requests. The trusted executor in this chat claims the selected request,
uses the VPS-held credential internally, verifies the website identity, and
reports the result for the UI to display. The supported providers are ClickUp
and GoDial. The imported snapshot is not a live Bitwarden sync, and external
unattended T3 browser access remains unavailable.

## Build and package

Use the pinned [Bun build path](agent-vault-web-bun.md). After compilation:

```sh
python3 scripts/prepare-agent-web-release.py \
  .cache/agent-web-bun-resume/apps/web/build \
  --output .cache/agent-web-release
```

Packaging preserves every compiled JavaScript byte, applies the existing Vault
wordmark, icon and manifest branding, and loads the existing charcoal stylesheet
from the accepted server image. It verifies that the compiled Agent access UI
exists. Original licenses and attribution remain in the source and web bundle.
This source build intentionally adds a guarded Angular feature; it is no longer
only a display-string overlay of the original precompiled client.

The web Docker recipe is `deploy/agent-vault-web/Web.Dockerfile`. Supply the
packaged files as `web/`, plus that Dockerfile, `LICENSE`, and `NOTICE.md` in a
public-source-only context. Build on the existing VPS from the accepted
`osiris-vault:0.1.1-f9a2511` image. Do not copy the Mac's private configuration,
dependencies, exports or engine data into the context.

## Activation and rollback

The bridge is already deployed as `osiris-vault-agent-web`, using private config
and SQLite state beneath `/opt/osiris-agent-vault`. Caddy exposes its authenticated
user endpoints only beneath `/api/agent-vault/`; worker routes remain publicly
blocked. The managed Mac SSH tunnel forwards the engine and private bridge
worker ports. Credentials and worker capabilities stay outside source control.

Run `activate-web.py` on the VPS as root with the newly built image tag, shaped
as `osiris-vault:0.2.0-agent-web-<source revision>`. The helper verifies the exact
accepted base image and inherited server layers/configuration, the existing
encrypted backup, the current running container, and the single-service Compose
configuration. It saves a private pre-release Compose file, validates that only
the image changes, and recreates only `vaultwarden`. Health failure restores the
original Compose image. A successful health check still requires rendered and
authenticated UI acceptance; it does not prove login automation works.

The encrypted backup is
`/opt/vaultwarden/backups/vaultwarden-20261022T184241808398Z.tar.age`.
The activation receipt identifies the exact rollback Compose file. To undo only
this release, restore that file to `/opt/vaultwarden/compose.yaml`, validate it,
and recreate only `vaultwarden` with `--no-deps`. Preserve `/opt/vaultwarden/data`,
the companion state, all keys, and the previous images. No schema migration or
database restore is part of this release or its rollback.

## Acceptance

Open `https://vault.scaleadvertisement.com/#/agent-vault` in this chat's in-app
Browser, using the owner's private unlocked Vault session. Select the intended
GoDial account, request sign-in once, and use the opaque request ID with the
trusted host's `web-sign-in` action. The executor must use the exact claimed
account ID and username. Only a verified website identity can complete as
`signed_in`. Confirm the UI displays that terminal result. Keep secrets out of
DOM inspection, tool arguments and screenshots. A queued request alone does not
pass acceptance.

This initial private allowlist is for the existing owner. Team onboarding,
other providers, live synchronization, native Touch ID and unattended browser
execution are separate work. The accepted official Bitwarden desktop app is
unchanged.
