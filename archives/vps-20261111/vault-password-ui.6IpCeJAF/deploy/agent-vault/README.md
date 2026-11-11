# Agent Vault companion

The manager subsequently built and activated this companion with the existing
snapshot and verified the first VPS-backed login. See
[the actual deployment record](../../docs/agent-vault-vps-deployment-2026-10-22.md).
The preparation text below records the original package scope. Repeating
staging against the live state is forbidden; use the deployment record's
status/restart/rollback commands.

Prepared delivery for manager review. Nothing here authorizes activation. This
service has not been built as a container or deployed. The accepted Mac engine
and its 253 imported accounts remain authoritative until a separately approved
cutover. Keep its 506 imported credential fields and 519 total fields intact.

This package is independent of `osiris-vaultwarden`. Do not edit Vaultwarden's
Compose file, image, domains, proxy routes, gates, volumes or other containers.
Do not replace installed Bitwarden, T3, their data or Keychain enrollment.

## Existing-state restoration

`stage-snapshot.py` replaces the old empty-state initializer. There is no fresh
password generation, enrollment, key generation, provisioning or live snapshot
capture in this package. The input must be an explicit consistent snapshot
produced by the parent's recovery procedure. Never pass the live engine root.
Never run the new-vault provisioner against this imported instance.

Pass the `snapshot/` directory produced by
[the recovery helper](../../docs/agent-vault-recovery.md) directly. The stager
accepts its full layout, validates the known Mac helper files, and excludes
`bin/`, `runtime.json`, `runtime/control.json` and `runtime/owner-login.json`
from the Linux destination. No manual normalization or extra secret copy is
required. The same input may be used for recovery and Linux staging.

It also accepts the following minimal snapshot layout:

```text
snapshot/                         mode700, one private owner
  runtime/                        mode700
    .agent-vault/                 mode700, complete snapshot of this directory
      agent-vault.db              mode600, closed self-contained SQLite backup
      ca/                         mode700
        ca.crt.pem                mode600, existing CA certificate
        ca.key.enc                mode600, existing encrypted CA private key
      ...                         preserve other existing private runtime files
  keys/                           mode700
    master-password               mode600, existing nonempty single-line file
```

For the minimal layout, require exactly `runtime` and `keys` at the root, exactly `.agent-vault` under
`runtime`, and exactly `master-password` under `keys`. All descendants must be
private directories or regular files with the same owner. Reject symbolic links
including path ancestors, hard-linked files, special files and SQLite
`-wal`, `-shm` or `-journal` sidecars. Existing pre-install backups may have a
different layout and are not accepted directly. Use the recovery helper to
include committed WAL records using SQLite's backup API. Copying only the live `.db`, or removing sidecars from a live copy,
is not a consistent snapshot. The stager never repairs or checkpoints its input.

Exclude Mac binaries, LaunchAgents, keys outside this contract, host client
configuration, browser profiles and account-index files outside `.agent-vault`.
They are not container inputs. The database preserves its existing encrypted
credentials, metadata, owner enrollment, sessions, settings and wrapped data
key. Existing private state inside `.agent-vault` is copied byte-for-byte.

Before creating the destination, the stager performs SQLite `integrity_check`
and `foreign_key_check`, requires one password-wrapped master record and an
existing owner, and checks the expected imported pairs and total fields. It
reads only opaque imported credential key names for pair checks, never field
values. It reads the private master file only to check single-line formatting
and copy it. It compares hashes internally without printing them. No password,
key, ciphertext, account names, emails, token or database rows enter its receipt.

These checks do not prove that the supplied master password unwraps the data
key or that the CA decrypts. The parent must supply a matched recovery snapshot.
A later approved container unlock and private owner check remain mandatory.

## Offline staging commands

No transfer is implemented or authorized here. The manager must separately
approve the snapshot custody, encrypted transfer and Linux activation scope.
On Linux use a root-owned source checkout and a private, trusted, non-symlink
snapshot path. Files must belong to root or to the `sudo` caller with mode600,
and directories must have mode700. Use a new destination whose existing parent
belongs to the invoking user and is not group/world writable. The destination
must not exist, even as an empty directory. Do not loosen permissions to make
a rejected snapshot pass without understanding its custody.

After transfer approval, the following is an OFFLINE Linux root step. It does
not build, start, contact or stop any engine:

```sh
sudo -n python3 deploy/agent-vault/stage-snapshot.py \
  --snapshot /private/approved-recovery-snapshot \
  --destination /opt/osiris-agent-vault \
  --import-vault bitwarden-import-20261022 \
  --expected-accounts 253 \
  --expected-import-fields 506 \
  --expected-total-fields 519
```

Successful output is a bounded JSON receipt. The resulting layout is:

```text
/opt/osiris-agent-vault/           root:root, mode700
  data/                           65532:65532, mode700, bind to /data
    .agent-vault/                 original database and CA, private modes
    .vault-companion-staged       65532:65532, mode600, completion gate
  private/                        root:root, mode700
    master-password               65532:65532, mode600, bind as Compose secret
  staging-receipt.json            root:root, mode600, aggregate checks only
```

Compose local bind secrets retain host ownership. Docker mounts the individual
master file as root, so uid65532 does not need to traverse the host's root-owned
`private` directory. Data and the master file are explicitly remapped to numeric
uid/gid65532. Mac uid/gid values are never treated as container identities.
Rootless Docker or user-namespace remapping needs a separately reviewed host-ID
mapping. This recipe requires ordinary rootful Docker without remapping.

For a synthetic/local offline check only, add `--ownership current-user` and use
a disposable destination. That option retains the current uid/gid and writes an
`offline-check-only` marker. The launch wrapper rejects that marker. For actual
Linux staging use the default `linux-container`, which requires Linux root.
Do not manually edit a marker or recursively chown an existing live runtime.

The command reserves its new destination exclusively. Validation failures before
reservation write nothing. A copy/interruption failure can leave an incomplete
private destination without a completion gate. Preserve it for review, use a
NEW destination for a reviewed retry, and do not point Compose at it. Success
never changes the input snapshot. Keep the snapshot separately for recovery.

## Build and activation prerequisites

Read [the readiness record](../../docs/agent-vault-vps-readiness.md). All of these
steps require separate manager approval before execution on a VPS.

`build.sh` fetches only upstream commit
`d5836ec3bb2315de38043d742ae5daca11a4944a`, verifies HEAD and builds its full engine
and web UI with its Dockerfile and lockfiles. It initializes no submodules and
never reads the installed Mac binary or live runtime. The wrapper context is
allowlisted by `.dockerignore` to its Dockerfile, launch script and notices.
Build on the intended Linux host/architecture, using Docker Engine and Compose
v2 or newer. No Mac arm64 executable may be copied into a VPS image.

Upstream pins its Node, Go and Alpine base-image digests. Its Dockerfile requires
`npm ci` and `npm run build` for the pinned frontend and its Go toolchain for the
engine. This is the upstream toolchain exception to the owned Bun default.
Do not convert upstream lockfiles. Outbound GitHub, module, npm and image
registry access is required. The local tag names the exact source revision,
and Compose never pulls it. Record the printed wrapper image ID and inspect
its Linux OS/architecture. Alpine package mirrors remain mutable, so the recipe
does not claim byte-identical builds.

The pinned upstream entrypoint only executes the binary. It does not implement
`AGENT_VAULT_MASTER_PASSWORD_FILE`. `launch.sh` validates the staged files and
passes the private file to `server --password-stdin`. It clears copied
`agent-vault.pid` and `agent-vault.pid.tmp` process markers because Mac PIDs have
no identity inside the container. The staged copy preserves those bytes until
launch. It clears competing master-password/database/path/detached overrides
and fixes HOME to `/data`. No master password is in argv,
environment or logs. Upstream can log verification codes without SMTP, so
container logging is disabled. A failed launch therefore needs bounded private
inspection rather than enabling raw logs.

After offline staging and explicit activation review, the proposed commands are:

```sh
sudo -n sh deploy/agent-vault/build.sh
sudo -n docker compose -f deploy/agent-vault/compose.yaml config --quiet
sudo -n docker compose -f deploy/agent-vault/compose.yaml up -d --no-deps engine
sudo -n docker compose -f deploy/agent-vault/compose.yaml ps engine
curl --fail --silent --output /dev/null http://127.0.0.1:19431/health
```

API/UI binds only `127.0.0.1:19431`, proxy only `127.0.0.1:19432`, on a dedicated
Compose network. Missing host data paths fail instead of being auto-created.
The healthcheck uses explicit IPv4 loopback to match the listener. No public
route or host CA trust is added. Keep the existing Mac API/proxy ports and
Tailscale mapping unchanged. A manager-approved API base-URL/tunnel review is
still needed because existing metadata and instance settings are preserved.

A later private management tunnel can use:

```sh
ssh -N -L 19431:127.0.0.1:19431 hostinger-osiris
```

A tunnel is not a private preview handoff. Read the T3 private-preview rules
before browser delivery. Remote API access requires validated HTTPS or this
loopback tunnel. Do not disable TLS verification or use remote plain HTTP.

## Acceptance and trusted-host capability

Health proves process readiness only. After approved activation, the manager
must privately verify existing-owner sign-in, database inventory 253/506/519,
existing CA identity and a known imported credential through a bounded trusted
check. No new enrollment, import or password/key change should occur. Do not
run actual website-login checks as part of this delivery package. Do not stop
or remove the accepted Mac engine until cutover and rollback are approved.

Host configuration and member capability files stay in a canonical mode700
private directory outside checkouts, with files mode600. Start from
`engine.example.json` and use the preserved imported vault. A normal existing
member/admin capability with access to that vault is required. Pinned upstream
`POST /v1/sessions` mints proxy-only capabilities and cannot mint a member/admin
capability. Never expose the authenticated owner/member response to an agent.
A separate parent-owned refresh procedure must privately establish the trusted
host capability and target address after cutover review.

The owned status client uses Bun:

```sh
bun integrations/agent-vault/engine/status.mjs \
  /private/path/integration-v1/engine.json
```

It returns only `ready` or `engine_unavailable`. It proves neither imported
credential equality nor browser login. Do not run the new-vault provisioner.

## Status and rollback after a separately approved activation

These commands affect only the companion Compose project:

```sh
sudo -n docker compose -f deploy/agent-vault/compose.yaml ps engine
sudo -n docker inspect --format '{{.State.Health.Status}}' osiris-agent-vault-engine-1
sudo -n docker compose -f deploy/agent-vault/compose.yaml restart engine
sudo -n docker compose -f deploy/agent-vault/compose.yaml stop engine
sudo -n docker compose -f deploy/agent-vault/compose.yaml down
```

Restart preserves the data bind and master file. Stop/down are the additive
companion rollback; preserve its staged state and return the trusted host to
its previously accepted Mac configuration under reviewed scope. Never use
`--volumes`, Docker prune, remove `/opt/osiris-agent-vault`, restore Vaultwarden,
or delete its database. Future upgrades need their own schema rollback plan.
