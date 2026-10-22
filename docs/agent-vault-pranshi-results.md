# Pranshi Vault v2 source handoff

Prepared on 23 October 2026, Asia/Kolkata, for the original Osiris integration
and deployment manager. This coordinator created exactly three independent
implementation chats. It did not assemble their branches or deploy anything.

## Verified environment and startup

- Physical hostname: `pranshis-MacBook-Air.local`; macOS ComputerName: `raven`;
  architecture: arm64. Tailscale Self is `raven`, DNS
  `raven.tailf4bdfc.ts.net`, address `100.123.92.16`, backend Running.
  `osiris` is a separate tailnet peer, not the execution host.
- Live T3 environment: `be63732a-3c93-440f-972a-9bb58559daf2`, label `raven`,
  darwin arm64, server `0.1.2-nightly.20261022.3512`.
- Provider: `codex_native` / `gpt-6.1-sol`, reasoningEffort `high`, serviceTier
  `default`, full-access/default. Native CLI reported `Logged in using ChatGPT`.
  All three providers actually started and produced durable running states.
  The disabled legacy provider was preserved.
- Reused project: `mcp:c40d6377-2cc6-489e-8f61-e98f2c2b9b7f`, title `Vault`,
  root `/Users/pranshisharma/Desktop/Code Project/Vault`, existing origin
  `https://github.com/OsirisMedici/vault`.
- Fetched only `work/agent-vault-integrated`. Published tip at verification:
  `98f6e77d1f3a85300b0792877c9cf49bbaed6f24`. Verified shared base
  `9598603d763dd2e092da7da78a4f346e2d3aca98` is an ancestor.
- Read the published AGENTS, coordinator brief, phase-two coordination, web
  contract, web delivery and Bun documentation completely. Workers used the
  frozen phase-two/web contracts and read the later brief with `git show`.
- Every implementation launch explicitly supplied the verified project ID,
  `workspaceStrategy.type=worktree`, exact shared base above, assigned branch,
  and `startFromOrigin=false`. All threads have `parentThreadId=null` and the
  assigned T3 worktree binding. No root-bound implementation thread or extra
  agent/chat was created. Each worker independently reported host, exact clean
  starting HEAD and branch before editing; coordinator inspected Git worktrees
  and durable running state as well as the receipts.
- Bun `1.4.4` was verified. No heavyweight install/build slot was requested,
  granted or used. No full Angular compilation ran on Raven.

## Source receipts

All three source branches start directly from the exact shared base. Worker
checks below are synthetic fixture evidence; remote commit, parent, ownership
and clean worktree checks were independently verified by this coordinator.

### Agent access UI

- Chat: [Vault v2 · Agent access UI · Pranshi](t3-thread://v1/mcp:4145059d-abd9-4fa0-b557-94f3dd4396a0)
- Thread: `mcp:4145059d-abd9-4fa0-b557-94f3dd4396a0`.
- Branch: `work/vault-v2-ui`.
- Worktree: `/Users/pranshisharma/.t3/worktrees/Vault/work-vault-v2-ui`.
- Head and independently verified remote SHA:
  `49815d6261a5ffba2cf61206a51b0086627eaf7d`.
- Parent: `9598603d763dd2e092da7da78a4f346e2d3aca98`.
- Startup reached running; final worker turn completed; final worktree clean.
- Exact owned files: `branding/agent-web/app/agent-vault.component.html`,
  `branding/agent-web/app/agent-vault.component.ts`,
  `branding/agent-web/app/agent-vault.service.ts`,
  `branding/agent-web/check-contract.ts`, `docs/agent-vault-ui-v2.md`.

Before: one complete account selector and only the request from the current page
visit. Changed: local account search/provider filters, explicit selection
clearing and hidden-selection rejection, bounded read-only history with distinct
loading/empty/error/queued/failed/verified states, and stale-history reconciliation.
Existing unlocked-session, explicit-user API, duplicate/uncertain submission,
selected identity, cancellation, bounded polling and session-generation guards
remain. Existing native Vault components and charcoal classes are used.

One aggregate case: `~/.bun/bin/bun --no-install branding/agent-web/check-contract.ts`
passed under Bun 1.4.4. It executes actual service/component logic with explicit
Angular/RxJS/layout substitutes and a tiny in-memory Bun bundle. It covers
strict projections/max25, explicit-user API, discovery/selection, read-only
history/retry/active gating, duplicate/uncertain submissions, cancellation,
queued-to-verified polling and stale metadata/history/create clearing on
lock/user change. Static TypeScript parsing, whitespace and bounded marker
hygiene passed separately.

Limit: framework substitutes do not prove Angular template compilation or native
rendering. No populated upstream/web, generated candidate or installed dependency
tree was available in this worktree; preview_status had no attached tab. No
baseline/result screenshots were captured or fabricated. Desktop/mobile compiled
rendering, real authenticated history isolation and provider acceptance are
pending, with detailed steps in `docs/agent-vault-ui-v2.md`.

### Team permissions

- Chat: [Vault v2 · Team permissions · Pranshi](t3-thread://v1/mcp:806280f7-21e8-4799-8948-1633edb1908a)
- Thread: `mcp:806280f7-21e8-4799-8948-1633edb1908a`.
- Branch: `work/vault-v2-permissions`.
- Worktree: `/Users/pranshisharma/.t3/worktrees/Vault/work-vault-v2-permissions`.
- Head and independently verified remote SHA:
  `d205249b50c96c65a0240b0e3821e98223068ae5`.
- Parent: `9598603d763dd2e092da7da78a4f346e2d3aca98`.
- Startup reached running; final worker turn completed; final worktree clean.
- Exact owned files: `integrations/agent-vault/web-bridge/acceptance.test.mjs`,
  `integrations/agent-vault/web-bridge/bridge.mjs`,
  `integrations/agent-vault/web-bridge/config.mjs`,
  `integrations/agent-vault/web-bridge/metadata.mjs`,
  `integrations/agent-vault/web-bridge/permissions.mjs`,
  `docs/agent-vault-permissions-v2.md`.

Before: all allowlisted users shared the supported catalog under config v1.
Changed: opt-in config v2 with a separate private explicit account/provider grant
policy, default deny, authorized counts/enumeration, request ownership/isolation,
policy reloads, revocation checks before atomic claim/completion, frozen request
history and bounded metadata-only audit. Existing config v1 behavior and strict
public shapes remain. No grants, users or live configuration were activated.

The trusted-local grant helper does not authenticate the human. Trusted host
code must authenticate and bind ownerId separately; the helper enforces owned
imports, revision and preservation of other owners' grants. This is not a
security boundary against unrestricted same-uid code. See the permissions doc
for policy migration, fail-closed behavior, revocation timing and rollback.
Rollback must restore the original owner-only allowlist, not merely change the
configuration version while retaining team identities.

One aggregate case:
`~/.bun/bin/bun test ./integrations/agent-vault/web-bridge/acceptance.test.mjs`
passed under Bun 1.4.4: 1 pass, 0 fail, 1 file, 1.49 seconds. It proves v1
compatibility, explicit allow/default-deny/provider scoping, cross-user
enumeration/create/read/cancel/history isolation, owner-scoped edits,
malformed/missing/unsafe policy refusal, stale revision/lock handling, revocation
before claim/completion, atomic claim/expiry, newest-25 history, bounded
audit/retention and no secret projection. All files, identities, profile replies
and worker capabilities are synthetic; injected fetch makes no real network
calls. Six bridge modules parsed with Bun.Transpiler; whitespace and limited
high-confidence credential marker hygiene passed. gitleaks was unavailable;
no comprehensive scanner result is claimed.

Limit: no real authenticated identities, import ownership/grant review, live
revocation timing, proxy worker-block acceptance or original provider regression
was exercised. No UI runtime or screenshots were captured by this non-UI worker.

### Build and CI

- Chat: [Vault v2 · Build and CI · Pranshi](t3-thread://v1/mcp:79f30cdf-dd24-4188-87f9-924b30931c08)
- Thread: `mcp:79f30cdf-dd24-4188-87f9-924b30931c08`.
- Branch: `work/vault-v2-ci`.
- Worktree: `/Users/pranshisharma/.t3/worktrees/Vault/work-vault-v2-ci`.
- Head and independently verified remote SHA:
  `b8db55afed879936ac6c0717080101c633e4bdff`.
- Parent: `9598603d763dd2e092da7da78a4f346e2d3aca98`.
- Startup reached running; final worker turn completed; final worktree clean.
- Exact owned files: `.github/workflows/vault-web.yml`,
  `docs/agent-vault-ci-v2.md`, `scripts/build-agent-web-bun.mjs`,
  `scripts/check-agent-web-ci.test.mjs`, `scripts/prepare-agent-web-release.py`,
  `scripts/run-agent-web-ci.mjs`, `tooling/agent-web/ci.mjs`.

Before: separate preparation/build/package commands, no Linux workflow or combined
receipt, incomplete source-drift/output-link guards. Changed: lightweight hygiene,
one synthetic tooling case and an explicit manually confirmed, serialized Linux
production-build job reusing the pinned preparation/frozen installation/Node
compiler/packaging path. Public bounded receipts retain provenance and attribution;
packaging independently verifies JavaScript/license byte identity. Bun 1.4.4 and
the Node 26.12.0 compiler-only exception remain. Dependencies, pins, lock and
deployment recipes are unchanged.

One aggregate case: `~/.bun/bin/bun test ./scripts/check-agent-web-ci.test.mjs`
passed: 1 pass, 0 fail, 16 expectations. Actual packager/synthetic inputs verify
JavaScript/license identity, unchanged input, display packaging, and rejection of
drift/overwrite/links. `~/.bun/bin/bun scripts/run-agent-web-ci.mjs hygiene`
passed, including after commit. Worker also parsed workflow YAML/dispatch with
system Ruby and verified pinned action SHAs against public Git remote tags.
The coordinator verified unchanged pin.json, bun.lock, upstream.lock.json and
.gitmodules against the shared base.

Limit: no dependency installation, upstream initialization, Angular compile,
workflow dispatch, artifact upload or rendered/live acceptance occurred locally.
GitHub CI execution/results remain unverified. The production job needs manager
integration and explicit manual confirmation; no heavy job was triggered here.

## Frozen interface and integration handoff

The shared new endpoint is authenticated `GET /api/agent-vault/requests` (bridge
relative `/requests`), exactly `{"requests":[...]}`, maximum 25 newest-first,
current-user entries using existing AgentRequest fields. UI strict projections
and bridge public projections retain that shape. No new provider enum, credential
field, account ID, browser token or direct engine call is introduced into it.

Only the original Osiris manager should fetch/review these exact commits and
assemble them with its independently owned sync/browser source. This coordinator
did not merge, cherry-pick or open PRs. The handoff branch contains documentation
only, based on the published coordinator brief; it is not an assembled release.

Local acceptance allocation is three distinct aggregate fixture cases, one per
worker. Static hygiene and re-running the same aggregate case do not create new
cases. The combined release remains capped at ten; original Osiris workers and
manager must reconcile their remaining allocation without adding broad suites.

Pending manager work belongs inside that existing allocation: combined source
and Angular template/type compilation, explicit Linux production build and
receipt/artifact inspection, real desktop/mobile screenshots and interactions,
integrated authenticated history/grant isolation and revocation, and preservation
of the accepted owner/GoDial flow under the manager's authorized live scope.
Live grant activation, provider execution and deployment remain manager-owned.

The 253 imported accounts and successful GoDial flow are the user-supplied and
published accepted baseline, not a new live verification performed on Raven.
There were no real passwords, exports, keys, sessions, production logins, SSH,
live allowlist/grant changes, service restarts, installed-app replacements,
preview services or Tailscale Serve changes in this work.

Existing Vault root stayed on main at
`1b7e6b14cc704c7622ce2c2edab8e86a3fb765fe`; its pre-existing untracked
`docs/plans/` was preserved. Existing feat/team-agent-access and all other
projects/apps were preserved; its observed dirty upstream/desktop was not
cleaned or reset. Root upstream/web remained clean and pinned at
`d2a095eb800fe80a9bc524579b974796eae51994`.

All three final worker turns are durably completed, all final implementation
worktrees are clean, and all three exact remote SHAs were rechecked together.
There is no source-handoff startup or implementation blocker. The remaining
checks above are manager-owned integration and acceptance gates.

over and out
