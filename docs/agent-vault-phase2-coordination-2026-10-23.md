# Vault phase two: two Macs and independent worktrees

Osiris authorized this work on 23 October 2026. This original chat is the
integration/release manager. Two implementation chats run on Osiris's Mac.
One coordinator on Pranshi's Mac creates three independent implementation chats
there. Workers communicate with their coordinator only, not with one another.
The coordinator is an additional management chat, not a sixth implementation
assignment. Do not create another local integration manager.

## Starting point and outcome

The accepted implementation checkpoint is `1493b661a6843a7c97d04f0b2929a2dc1e26a836`.
The shared phase-two base is the commit adding this document to
`work/agent-vault-integrated`. Every worker must start from that exact published
base and report its actual branch/worktree/host. Preserve dirty originals.

The owner can already open `/#/agent-vault` in the existing Vault web app,
select one of two supported imported accounts, queue a request, and have this
chat verify a real GoDial sign-in through the VPS engine. All 253 imported
accounts remain preserved. The next outcome is a maintainable app with safer
team access, useful account discovery/history, incremental credential updates,
broader supported browser access and repeatable releases.

Read `AGENTS.md`, the JavaScript tooling policy, `integrations/agent-vault/CONTRACT.md`,
`docs/agent-vault-web-contract-2026-10-23.md`, `docs/agent-vault-web-delivery.md`,
and the documentation for the assigned area before implementation.

## Ownership

1. Original manager, Osiris Mac: integration, deployments, activation, real
   acceptance, private data custody and final rollback. Owns deployment/runtime
   configuration and shared contract decisions. Only this manager assembles
   other workers' commits or deploys to the VPS.
2. Credential sync, Osiris Mac, `work/vault-v2-sync`: owns only new
   `integrations/agent-vault/sync/` and `docs/agent-vault-sync.md`.
3. Browser access, Osiris Mac, `work/vault-v2-browser`: owns
   `integrations/agent-vault/browser/` and `docs/agent-vault-browser-v2.md`.
4. Product UI, Pranshi Mac, `work/vault-v2-ui`: owns
   `branding/agent-web/app/`, `branding/agent-web/check-contract.ts`, and
   `docs/agent-vault-ui-v2.md`. Does not edit source preparation or tooling.
5. Team permissions, Pranshi Mac, `work/vault-v2-permissions`: owns
   `integrations/agent-vault/web-bridge/` and `docs/agent-vault-permissions-v2.md`.
6. Build/CI, Pranshi Mac, `work/vault-v2-ci`: owns
   `scripts/*agent-web*`, `tooling/agent-web/`, `.github/workflows/vault-web.yml`,
   and `docs/agent-vault-ci-v2.md`. Does not edit feature components or deployment.

If a necessary change crosses ownership, report the exact proposed patch to
the coordinator. Do not edit another worker's files, cherry-pick its work,
merge branches wholesale, spawn additional workers, or push all refs.

## Frozen interfaces

Existing endpoint paths, response fields and request states remain unchanged.
The strict frontend validators intentionally reject unexpected fields. Preserve
the owner-only version-one config and allowlist behavior by default.

The only new frontend/backend interface is authenticated `GET /requests`, beneath
the existing `/api/agent-vault` prefix. It returns `{ "requests": [...] }` with
at most 25 of the current user's requests, newest first. Each entry is the
existing public AgentRequest shape, with no additional fields, account IDs,
tokens or credentials. It is read-only and does not resume or execute a job.
The UI must not infer a successful login from history, queueing or timers.

UI account search and provider filtering operate over the existing bounded
metadata response in memory. No query API, new provider enum, automatic account
selection, automatic login or new admin panel is part of this UI worker's task.

Permissions are an explicit opt-in private configuration version. Default-deny
per-user account/provider grants must filter both account enumeration and
request creation; revocation must be rechecked before a worker claims a queued
request. Status counts must describe the authorized view. Owners may manage
only grants for their own imported account set. Do not expand the live allowlist
or grant any real user access. Permission administration can use a trusted local
helper and fixture config; a new UI management contract needs manager approval.
Audit records contain bounded metadata only. Existing v1 owner behavior remains
compatible. The public worker route stays blocked, and trusted worker tokens
never reach the web client.

The sync worker exports a trusted-host API with a private source adapter, not
an MCP tool accepting secrets. Source acquisition must use a documented normal
Vault/Bitwarden authorization path. Do not scrape browser storage, process
memory, Electron internals, Keychain or the official Bitwarden application.
If a supported source adapter is not configured, return a concrete prerequisite
and implement the incremental planner/adapter seam with synthetic data. Do not
claim live sync from fixtures or an unchanged imported snapshot. Plan changes
first, preserve stable IDs/keys, update only changed owned items after explicit
apply, and never delete missing items automatically. Stage receipt/manifest
updates atomically; expose no secret values or secret-derived hashes publicly.

The browser worker preserves the demonstrated chat relay and exact origin,
thread, tab-control and identity guards. First check supported T3 transport
readiness. Missing ACP capabilities are an external dependency, not permission
to copy T3 tokens, patch installed Electron or switch to personal Chrome.
Implement readiness/failure recovery and improve the supported provider adapter
interface. Propose additional providers against non-secret imported metadata;
coordinate route-enum changes with the manager rather than changing the bridge
or UI contract independently. No real provider logins in a worker without a
manager-assigned acceptance case. Stop at MFA, CAPTCHA and recovery screens.

The CI worker preserves frozen dependency versions, Bun 1.4.4 installation and
orchestration, and the documented Node 26.12.0 full Angular compiler exception.
The production build passed in 178672 ms. Do not repeat the completed blind
Bun-only heavyweight build. A separate existing Bun-reliability chat is active
on Osiris's Mac; CI must not duplicate or replace its work. Prefer Linux CI
syntax/fixture checks and one gated production-build job, preserving upstream
pins, OSS licensing, generated candidates and low resource concurrency.

## Data, execution and acceptance boundaries

Real credentials, exports, sessions, backups, keys and runtime state stay on
Osiris's Mac/VPS. Pranshi's workers use synthetic fixtures only, with no live
Vault login, SSH to production, credential import, permission activation or
service restart. Do not replace the signed Bitwarden or T3 applications.

Workers may implement, make focused checks, and commit owned source to their
assigned branches. Explicit source-only branch pushes to the existing
`OsirisMedici/vault` remote are authorized for this cross-Mac handoff; verify
the remote SHA after pushing. No PRs are required. No team/customer messages.

The combined release has at most ten acceptance cases, including meaningful
fixture cases and manager-run real flows. Each implementation worker owns at
most one aggregate fixture case. Static syntax, whitespace and secret scans
are build hygiene, not a reason to add broad test suites. Only the coordinator
may schedule a heavy build on each Mac; avoid competing full builds/installs.
No claim of acceptance from a checkout, queued run, catalog, mock or sign-in
screen. Report source, fixture proof, deployment and live acceptance separately.

Every completion handoff includes host, base/head SHA, clean status, exact
owned files, one focused check/result, blockers and untested live behavior.
Pranshi's coordinator returns all three thread IDs, workspace paths and commits
to its own conversation for this manager to collect. End final replies with
`over and out`.
