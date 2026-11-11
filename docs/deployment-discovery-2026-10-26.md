# Deployment discovery — 2026-10-26

Osiris authorized deployment of the password-length change. Read-only inspection
identified the prior deployment as https://vault.scaleadvertisement.com.
Its DNS resolves to 187.126.114.42, matching this VPS (`vps-1`).

Public checks returned `/alive` 200, `/api/config` 200, `/admin` 404 and
`/identity/accounts/register` 403. The public configuration identifies Vaultwarden
with server revision `7c188967`, consistent with the pinned server. Its advertised
API/identity/notification URLs use the same hostname. The landing page title is
Vault. These observations establish the target; they do not establish owner
login, decryption, backup integrity or deployment acceptance.

The historical release receipt at
`/opt/osiris-vault-web-release-f561d18/receipts/build.json` records source revision
`f561d1862dc95d86689585f080acedf12e6fc3a7`, web source
`d2a095eb800fe80a9bc524579b974796eae51994`, and web version 2026.7.0.
Its web image derives from `osiris-vault:0.1.1-f9a2511` and includes the agent-access
web layer. This is evidence of the recorded release, not privileged confirmation
of the current running image/container ID.

The initial password patch was prepared against main revision `40cd48c`. The
recorded release includes additional agent UI and build/release tooling. A release
must retain those layers rather than replace the live web client with the simpler
main-based candidate. An isolated source worktree is now available at
`/home/t3worker/projects/vault-password-release`, branch
`dev/master-password-release`, starting at the exact recorded release revision.
The tested password patch remains intact in `vault-password-dev`. It has not yet
been integrated into the release worktree or accepted as a deployment artifact.

The prior full web build was terminated by SIGTERM before producing an accepted
artifact. The recorded release already includes a Bun-managed compiler wrapper
that caps Terser parallelism, omits release source maps and requires its reviewed
Node 26.12.0 compiler runtime. Reuse and validate that build route when integrating
the password patch; do not deploy the display-only Docker overlay.

Access is currently blocked. `/opt/vaultwarden` is root-owned with mode 0700.
The Docker socket is owned by root:docker with mode 0660; `t3worker` belongs only
to its own group and Docker reports permission denied. No SSH deployment config
is present. The existing release activation helper requires root. Per the session
instructions no sudo was attempted. No permissions, service, proxy, account,
container, database or backup were changed.

Before deployment, an authorized administrator/deployment route must be available
to inspect the running image/configuration, verify a fresh encrypted backup and
retain rollback configuration. No credentials or session material were read or
printed during discovery. Original account and encrypted-data protections remain
required. Do not alter independent Feedback or Crayon deployments.
