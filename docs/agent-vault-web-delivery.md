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

## Live acceptance on 23 October 2026

- Source/build tooling revision: `d6070d4` on `work/agent-vault-integrated`.
- Full optimized OSS compile passed in 178,672 ms through the Bun-managed,
  Node 26.12.0 compiler exception. No dependency versions were changed.
- Image: `osiris-vault:0.2.0-agent-web-d6070d4`.
- Image ID: `sha256:62e774610b5b2efdc0f4be172a2e618c12b3ebab429a0ac1e49c3ea5cf2ea990`.
- Release/context: `/opt/osiris-vault-web-release-d6070d4/web-context`.
- Private rollback Compose: `/opt/vaultwarden/compose.pre-agent-web-d6070d4.yaml`.
- Public index matched the packaged index SHA-256
  `61d54be6779748255bb079316a926a7f424fa8024620582bdfefcfc50584212c`.

Activation verified the accepted server layers and configuration were inherited,
and the parsed Compose configuration differed only in the Vault image. The new
container became healthy. The existing data volume, server version and schema
were preserved. The engine's read-only SQLite recheck passed, with 506 imported
fields and 519 total fields unchanged.

The owner privately unlocked the deployed client. Authenticated metadata and
status requests returned 200, and the page displayed 253 imported accounts and
two supported choices. The initial unselected sign-in control was disabled.
Selecting the GoDial account and submitting once produced a queued request.
The first request failed safely when its provider tab was unavailable, with no
credential fill. Its failed state appeared in the UI. An explicit retry using a
fresh owned tab completed in 55 supported browser tool calls. The trusted helper
verified the exact selected account identity and completed the same web request
as `signed_in`. The Vault page then displayed its verified terminal result.
The helper exited, and a presence-only clipboard check confirmed it was empty.

HTTPS `/alive` remained 200. Unauthenticated account metadata was 401, public
worker claim was 404, `/admin` remained 404, and empty registration remained 403.
The desktop Agent access screenshot showed the intended charcoal UI, matching
Vault navigation and controls, with no framework overlay or relevant console
errors. Final terminal-state evidence used scoped DOM inspection: a further
saved snapshot returned `Preview automation snapshot timed out after 15000ms.`
A requested narrow preset did not change the reported CSS width, so mobile
layout acceptance is not claimed. Neither limitation blocked the verified
desktop request flow.

This is an accepted owner workflow in the existing web app, with the approved
chat-assisted browser route. Team access, other providers, live synchronization,
unattended external transport and a new signed desktop release remain excluded.
