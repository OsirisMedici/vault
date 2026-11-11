# Pranshi's Vault coordinator: executable task brief

Osiris explicitly requested one coordinator chat on Pranshi's Mac that creates
three independent chats for the work below. Start that work now. Do not create
another Osiris manager or move these tasks onto Osiris's Mac. This coordinator
is authorized to create exactly three top-level T3 implementation conversations
in separate T3-bound worktrees. Do not let workers create further agents/chats.

## Verify the actual machine and repository first

Read the applicable `AGENTS.md` and the installed JavaScript tooling policy.
Use `t3_environment_read`, `orchestrator_capabilities`, and the project catalog.
Verify the physical host is Pranshi's Mac, known on Tailscale as `raven`, rather
than `osiris`. Report the current environment ID, hostname and provider state.
An online tailnet peer is not proof that T3 or Codex can run.

Reuse an existing registered `OsirisMedici/vault` repository/project if present.
Preserve all dirty checkouts and other projects. If it is absent, clone the
existing `https://github.com/OsirisMedici/vault.git` using T3's supported clone
and project registration tools into a fresh project directory. Use normal
GitHub authentication if needed; never request or print a token in chat.
Fetch only `work/agent-vault-integrated` and verify that the shared code base
`9598603d763dd2e092da7da78a4f346e2d3aca98` exists and is an ancestor of that
published branch. No root checkout reset, force push or destructive cleanup.

Read `docs/agent-vault-phase2-coordination-2026-10-23.md` at that base fully.
That document is the frozen ownership/API/data/test contract. Also read the
web contract, delivered acceptance, and Bun build documentation it references.
The deployed owner flow already passed a real GoDial login. No live Vault,
engine, exports, keys, cookies, SSH credentials or personal browser profiles
are needed on this Mac. Use synthetic fixtures only.

## Create exactly these three implementation chats

Use `t3_thread_launch`, with the verified Vault projectId explicitly supplied.
Every launch uses `workspaceStrategy` of type `worktree`, baseRef equal to
`9598603d763dd2e092da7da78a4f346e2d3aca98`, `startFromOrigin:false`, and the
assigned branch below. Never use `create_threads` for these isolated tasks and
never tell an agent to create a worktree after a root-bound launch. Discover
the current Codex model/options; preserve the environment's authenticated
selection and do not elevate permissions beyond this coordinator. Retain the
returned thread IDs before making another launch. If a launch is uncertain,
list threads before retrying so no duplicate is created.

Each worker's prompt must include the frozen contract, exact base, its owned
paths, user outcome, implementation requirements below, exclusions, test budget,
source-only push rule, clean handoff requirements, and `over and out` completion
signal. Workers work independently and ask this coordinator about conflicts.
Do not share worker transcripts with one another.

### Chat 4: Agent access UI

Title `Vault v2 · Agent access UI · Pranshi`, branch `work/vault-v2-ui`.
Own only `branding/agent-web/app/`, `branding/agent-web/check-contract.ts`, and
`docs/agent-vault-ui-v2.md`.

Build local search and provider filters over the existing bounded account
metadata, plus recent request history through authenticated `GET /requests`.
The response is exactly `{requests:[AgentRequest,...]}`, maximum 25 newest-first
entries owned by the current Vault user. Existing AgentRequest fields/states
remain unchanged. No automatic login, default account selection, new provider
enum, secrets, admin controls or direct engine calls. Preserve explicit-user
ApiService use, unlocked-account gating, stale response rejection on lock/user
change, bounded polling, selected account identity validation, failure recovery
and duplicate-submission protection. Give meaningful loading, empty, filtered,
failed and verified states using native Vault components and the charcoal theme.
History is informational and must never execute a request or fabricate success.
Validate with one aggregate synthetic service/interaction contract fixture.
Document the exact rendered desktop/mobile acceptance still for the manager.
Do not change build scripts, source patches, route enums or backend files.

### Chat 5: Team permissions

Title `Vault v2 · Team permissions · Pranshi`, branch `work/vault-v2-permissions`.
Own only `integrations/agent-vault/web-bridge/` and
`docs/agent-vault-permissions-v2.md`.

Implement opt-in versioned private account/provider grants while retaining the
existing version-one owner config behavior. Authenticate through the fixed
Vault profile endpoint on every user call. Filter enumeration/counts and
creation by grants, default deny, keep ownership isolation, and recheck grants
before claiming queued work so revocation takes effect. Preserve exact origin
checks, private worker capability handling, atomic claim/completion, expiry,
bounded storage, constant-time comparison, fixed public errors and no raw logs.
Add the frozen `GET /requests` history endpoint, returning only the current
user's newest 25 existing public request shapes. No extra fields on existing
responses. Provide trusted-local fixture administration and metadata-only audit
records; no live allowlist/grant/config activation, new public worker route,
browser token handling or production access. One aggregate synthetic acceptance
case must prove allow/deny, cross-user enumeration/read/create/cancel isolation,
revocation before claim, unchanged owner-v1 compatibility and bounded history.
Document the configuration migration and rollback without deploying it.

### Chat 6: Build and CI

Title `Vault v2 · Build and CI · Pranshi`, branch `work/vault-v2-ci`.
Own only `scripts/*agent-web*`, `tooling/agent-web/`,
`.github/workflows/vault-web.yml`, and `docs/agent-vault-ci-v2.md`.

Make the verified source preparation, frozen install, compile and packaging
repeatable in CI. Preserve Bun 1.4.4 as manager/orchestrator and the reviewed
Node 26.12.0 compiler-only exception. Keep the upstream checkout pinned/clean,
generated candidates isolated, original license files intact, all retained
registry versions/integrities fixed, lifecycle scripts disabled and registry
concurrency bounded. Preserve compiled JavaScript byte identity in packaging.
Record source/tool versions and bounded artifact receipts without private data.
Add one appropriate explicit Linux production-build job and source hygiene
checks without auto-deploying or needing production/GitHub secrets. Do not
upgrade dependencies, alter features, change deployment recipes or duplicate
the separate Bun-only reliability investigation already active on Osiris's Mac.
One aggregate lightweight tooling fixture maximum. Coordinate any heavy install
or build through this coordinator, with resource checks first; only one heavy
operation on this Mac at a time. Clearly distinguish local checks from CI runs
that were actually executed.

## Verify startup and finish the handoff

Follow each launch until the durable thread is running in its assigned worktree
and has verified its host/base. If provider auth, repository access, T3 write
permissions or worktree setup block startup, name the exact blocker; do not
report a queued/created thread as an executing engineer.

Workers may commit and push only their explicit source branches to the existing
remote, then verify the remote SHA. No PR, merge, VPS change, engine operation,
installed app replacement or message to anyone else is authorized. The release
manager on Osiris's Mac is the only assembler/deployer. The combined phase-two
acceptance budget is ten cases; each worker owns at most one fixture case.

Return a coordinator receipt with the actual machine/environment/project IDs,
all three thread links, branches, worktree paths, startup status and any blocker.
Collect final commits and check results in this coordinator chat. Write a
source-only handoff at `docs/agent-vault-pranshi-results.md` on a dedicated
coordinator branch when complete, and push that branch explicitly so the Osiris
manager can collect it without remote credential access. End with `over and out`.
