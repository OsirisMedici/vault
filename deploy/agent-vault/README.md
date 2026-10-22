# Agent Vault companion

Prepared for manager review. This service has not been built as a container or
deployed. It is independent of the existing `osiris-vaultwarden` service. Do not
edit the Vaultwarden Compose file, image, domains, proxy routes, admin or
registration gates, volumes or other containers to activate this package.

The image uses the full upstream engine, including its web UI. `build.sh`
fetches only commit `d5836ec3bb2315de38043d742ae5daca11a4944a`, verifies HEAD,
and uses that commit's Dockerfile and lockfiles. No upstream submodules are
initialized. Its Node, Go and Alpine base images are digest-pinned upstream.
The wrapper image has a commit-named local tag, and Compose never pulls it.
Record the image ID printed by the build. This is an exact-source recipe,
not a claim of byte-identical output across mutable Alpine package mirrors.

The inspected upstream entrypoint only execs the binary. It does not implement
`AGENT_VAULT_MASTER_PASSWORD_FILE`. `launch.sh` instead passes the private file
as stdin to the actual supported `server --password-stdin` flag. The master
password is absent from argv, Compose environment and logs. Use a single-line
file, uid/gid 65532, mode600. Compose local secret mounts retain host ownership.
The wrapper checks the mounted file before launch. Stdout/stderr logging is
disabled because upstream can otherwise log verification codes without SMTP.

API/UI is published only at `127.0.0.1:19431`; MITM proxy only at
`127.0.0.1:19432`. Both are on a new, dedicated Compose network. The browser
login connector uses the management API, not the cookie-stripping proxy.
No CA is installed on the host. No public HTTPS or reverse-proxy route is added.
Data lives at `/opt/osiris-agent-vault/data`, separate from every source checkout
and Vaultwarden data. Never mount the Vaultwarden database into this service.

## Reviewed activation commands

Run these on the VPS from the assembled Vault source checkout only after review.
Docker Engine with Compose v2, outbound access to GitHub/module/npm/image
registries, and the exact upstream base-image digests must be available.
No container build ran here: `docker info` failed because the local Colima
Docker socket was absent. Neither the VPS nor its running containers were
mutated during implementation.

```sh
sudo -n sh deploy/agent-vault/build.sh
sudo -n python3 deploy/agent-vault/prepare-state.py
sudo -n docker compose -f deploy/agent-vault/compose.yaml config --quiet
sudo -n docker compose -f deploy/agent-vault/compose.yaml up -d --no-deps engine
sudo -n docker compose -f deploy/agent-vault/compose.yaml ps engine
curl --fail --silent http://127.0.0.1:19431/health
```

`prepare-state.py` generates a random master password internally. It prints
only a bounded receipt, refuses nonempty state, and must never be rerun for a
restart. Retain the private master file with the encrypted database in a
separately approved backup procedure. No existing trial data is migrated by
these commands. A fresh engine has no imported passwords.

Before calling the companion usable, the manager must enroll its first owner
through the private UI, provision the target vault and decide how to import
the approved snapshot. First-owner enrollment is separate from the master
encryption password. Expose the new service only through a private tunnel:

```sh
ssh -N -L 19431:127.0.0.1:19431 hostinger-osiris
```

Use the T3 private-preview rules for any browser handoff. The SSH tunnel is a
management transport, not a public preview deliverable. Remote API access must
use validated HTTPS or this documented loopback tunnel. Never disable TLS
validation or point the client at remote plain HTTP.

## Host capability and new vault

Create a mode700 canonical private directory outside all checkouts and place
`engine.json` plus `member-token` inside with mode600. Start from
`engine.example.json`. The host token must come from a normal authenticated
member/admin account with access to the chosen vault. On a new companion,
initial provisioning requires its owner's authenticated capability.

`POST /v1/sessions` in the pinned release mints **proxy only**, even for an
owner. It cannot mint a member/admin token. The manager must privately save a
normal account session for the trusted host. Never supply that session to the
agent/MCP, expose it in command arguments, or print a login API response.

For a NEW EMPTY companion vault only, run on the trusted host:

```sh
node integrations/agent-vault/engine/provision.mjs \
  /private/path/integration-v1/engine.json \
  /private/path/integration-v1/proxy-token
node integrations/agent-vault/engine/status.mjs \
  /private/path/integration-v1/engine.json
```

The provisioner refuses an existing vault and an existing proxy file. It closes
the new companion's registrations to invite-only, creates the specified vault,
sets and reads back `unmatched_host_policy=deny`, confirms there are no service
rules, and saves a separate one-hour proxy capability privately. It neither
imports credentials nor adds proxy injection rules. It never modifies
Vaultwarden. If provisioning fails midway, inspect the new companion privately;
the empty output file and partial vault deliberately prevent a blind retry.

The existing real-import runtime is a different activation path. Point the host
client at its approved private config and use its existing imported vault.
**Do not run this provisioner, prepare-state, build/start commands or migrations
against the live trial.** No live import capability was read here.

## Status, restart, stop and rollback

These commands affect this Compose project only:

```sh
sudo -n docker compose -f deploy/agent-vault/compose.yaml ps engine
sudo -n docker inspect --format '{{.State.Health.Status}}' osiris-agent-vault-engine-1
sudo -n docker compose -f deploy/agent-vault/compose.yaml restart engine
sudo -n docker compose -f deploy/agent-vault/compose.yaml stop engine
```

`/health` and container health prove process readiness only. The Node status
command also checks the configured vault and a member-gated endpoint, returning
only `ready` or `engine_unavailable`. Neither proves an imported account or
browser login. Restart preserves the data bind and private master file.

For this first additive deployment, rollback is removal of only the companion:

```sh
sudo -n docker compose -f deploy/agent-vault/compose.yaml down
```

Do not pass `--volumes`, prune Docker, remove `/opt/osiris-agent-vault`, restore
Vaultwarden, or delete its database. Preserve the companion's private state for
review. Future image upgrades need a separate reviewed database/schema rollback;
replacing an image alone is not a safe downgrade guarantee.
