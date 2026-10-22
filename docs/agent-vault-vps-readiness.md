# Agent Vault VPS delivery readiness

22 October 2026. This is an offline delivery package, not activation permission.
The Mac engine remains the accepted runtime. This work did not read its secret
files, capture a snapshot, transfer data, contact the VPS, start an engine,
expose endpoints or change installed applications, Keychain or private config.
The latest accepted import remains 253 accounts, 506 imported fields and 519
total fields according to the integration handoff. This worker did not reread
live data to reconfirm those counts.

## Delivered behavior

The manager can stage an explicit parent-supplied consistent snapshot into a
new Linux Compose destination while preserving the database, wrapped data key,
master file and CA bytes. The old `prepare-state.py` empty-vault initializer is
removed. The restored owner and import remain in the copied database; there is
no reimport or first-owner enrollment path in this package.

The [companion guide](../deploy/agent-vault/README.md) defines the snapshot
contract, exact offline staging command, numeric ownership mapping, build steps,
activation prerequisites and rollback. The stager refuses unsafe permissions,
symlinks, hard links, missing material, SQLite sidecars, failed database integrity
or foreign keys, missing wrapped master/owner, unexpected import pairs/counts,
and existing or overlapping destinations. Copies and unchanged source files
are compared internally without exposing hashes or content. It does not prove
that the master and encrypted CA match cryptographically.

The launch wrapper refuses missing restored files and an absent/incomplete or
local-only staging gate before invoking upstream. It clears only copied PID
process markers at container launch to avoid Mac/container PID collisions.
Compose refuses an absent host data directory. The wrapper build context excludes everything except its
launch script, Dockerfile and license notices. The healthcheck explicitly uses
IPv4 loopback. Neither path imports or copies a Mac executable. The Linux image
must build from the pinned upstream source and its existing toolchain.

## Bounded verification

Run exactly one synthetic offline preservation case from the repository root:

```sh
python3 deploy/agent-vault/test-stage-snapshot.py
```

It constructs a disposable database with 253 synthetic username/password pairs,
13 older fields, a wrapped-master-shaped record, owner row and synthetic CA
bytes. It invokes the real staging CLI with `--ownership current-user`, checks
253/506/519, compares every copied file byte-for-byte, confirms source bytes,
private modes and current ownership, confirms the nonactivatable marker, then
checks that retrying the same destination refuses overwrite. It launches no
engine and makes no network requests. Synthetic bytes do not establish a real
master unlock, valid CA or full upstream-schema migration.

Static verification commands:

```sh
python3 -m py_compile deploy/agent-vault/stage-snapshot.py deploy/agent-vault/test-stage-snapshot.py
sh -n deploy/agent-vault/build.sh deploy/agent-vault/launch.sh
docker compose -f deploy/agent-vault/compose.yaml config --quiet
git diff --check
```

Verification performed for this delivery: the one synthetic case passed; Python
compilation, shell syntax, Compose configuration, whitespace checks and scoped
Gitleaks scans passed.
The pinned original upstream checkout was clean at
`d5836ec3bb2315de38043d742ae5daca11a4944a` and remained untouched.

Container build and runtime acceptance are NOT verified. Docker Compose 5.3.1
is installed, but `docker info` reports the absent Colima socket. No Docker or
Colima service was installed or started, and `build.sh` was not run. Static
configuration parsing does not prove that upstream base images are retrievable,
that the Linux build succeeds or that the image unlocks the restored state.

## Remaining activation gates

1. The parent recovery procedure must supply a matched, private, self-contained
   snapshot in the documented layout. It must include committed WAL records and
   the existing master/CA, with an independent recovery copy retained.
2. Osiris must separately approve encrypted transfer, VPS state destination,
   root ownership changes, service activation and any trusted-host cutover.
   This worker has no such authorization.
3. Review the VPS's native architecture, rootful Docker configuration, free
   loopback ports 19431/19432 and absence of `/opt/osiris-agent-vault`. Ordinary
   numeric uid/gid65532 mounts require no user-namespace remapping. Check there
   is no conflict with Vaultwarden, existing routing or other services.
4. Stage offline on Linux as root with expected 253/506/519. Retain its bounded
   receipt. Never overwrite an existing destination or use the empty-vault
   provisioner. Review an interrupted destination privately before any retry.
5. Build the pinned upstream Linux image on the intended architecture. Record
   the actual image ID and OS/architecture, then review Compose configuration
   and staged ownership before the first start. Build failure blocks activation.
6. After approved start, privately establish existing-owner access, master
   unlock, CA identity and preserved inventory. Review preserved registration,
   instance URL and other settings before exposure. Health alone is insufficient.
7. Separately review target TLS/tunnel access, the private preview handoff,
   trusted host member capability refresh and rollback. Keep the Mac engine
   accepted and unchanged until a deliberate cutover is approved and verified.

The original signed Bitwarden app, source Bitwarden checkout, protected Karen
browser-login integration and live VPS Vault are outside this package.
