# Vault web CI and source build

Osiris can prepare, install, compile and package the pinned Agent access client
with one Bun command, then inspect a bounded public build receipt. The purpose
is a repeatable source handoff: a successful build produces web files and their
provenance for the original manager's review. Deployment, runtime configuration,
credentials, installed apps and live acceptance remain manager-owned.

Before this change, the accepted daily commands existed separately; there was
no Linux workflow or combined artifact receipt. CI now runs source hygiene and
one synthetic tooling case without installing app dependencies. A separate
explicit production job reuses those commands and verifies package identity.

## Frozen toolchain and boundaries

- Bun **1.4.4** handles package installation, scripts, fixtures and orchestration.
  Locally use `~/.bun/bin/bun` if the app PATH is stale. Python 3.9+ handles the
  existing source and release preparation; CI uses Ubuntu 24.04's Python.
- Node **26.12.0** is required only for the existing full Angular compiler child,
  launched by Bun with `--max-old-space-size=4096`. The workflow's setup actions
  also use GitHub's own action runtime. There is no npm install/build command,
  Bun-only full Angular experiment or automatic compiler fallback.
- Public upstream web remains exactly
  `d2a095eb800fe80a9bc524579b974796eae51994`, web **2026.7.0**, at the origin
  already recorded in `upstream.lock.json`. Preparation verifies its clean Git
  checkout, copies tracked public files into this worktree's ignored `.cache`,
  and applies existing owned patches there. Upstream is never patched in place.
- `tooling/agent-web/pin.json` and `bun.lock` remain unchanged. Every retained
  registry version/integrity and the audited omitted inventory are checked by
  the existing verifier. Lifecycle scripts remain disabled. Registry concurrency
  stays at eight, with frozen lockfile and cache preference; no resolution or
  upgrade is introduced.
- Existing Webpack production optimization, one Terser worker, disabled optional
  source maps and the Node compiler exception remain intact. Source/component
  drift since preparation now fails verification. The daily Bun runner also
  checks the compiler version before starting its heavy install.

## Lightweight commands

Run from this repository, with no app dependencies or initialized submodules:

```sh
~/.bun/bin/bun scripts/run-agent-web-ci.mjs hygiene
~/.bun/bin/bun test ./scripts/check-agent-web-ci.test.mjs
```

Hygiene checks the frozen lock digest/upstream pin, parses owned JavaScript and
Python without executing their build paths, checks current/staged/latest-commit
whitespace, and rejects common private-key/GitHub-token markers in the owned
tooling. This bounded marker scan is not a comprehensive secret audit. Syntax
and diff checks are hygiene, not additional acceptance cases.

The **one aggregate fixture** creates a clearly synthetic compiled directory
inside `.cache`, invokes the actual release packager, and checks JavaScript and
license byte identity, unchanged input, display packaging, overwrite rejection,
symlink rejection and detection of modified packaged JS/attribution. It removes
only its own generated fixture. It does not load Angular, use real accounts,
read configuration, open a browser or prove a sign-in. Do not run the older
compiler interop fixture as an additional phase-two acceptance case.

## Explicit Linux production job

`.github/workflows/vault-web.yml` runs lightweight checks for relevant pushes
and pull requests. `production-build` runs only on `workflow_dispatch` with
`production_confirm=true`, selecting an explicit branch. It depends on hygiene,
has a 45-minute timeout and a repository-wide production concurrency group with
`cancel-in-progress: false`. Ordinary pushes, PRs and an unchecked manual dispatch
cannot run the dependency installation or compiler. The workflow must first be
available on the repository's default branch for GitHub's manual-dispatch UI;
the original manager owns integration. This worker does not trigger it.

The workflow pins checkout/setup/upload actions to commit SHAs, gives the
automatic GitHub token only `contents: read`, and disables checkout credential
persistence. Only the public `upstream/web` submodule is initialized; desktop
and server are not fetched. No production secret, custom GitHub secret, SSH,
private configuration, Docker, deployment, restart or activation is required.
Dependency caches are not shared between unrelated runs. The single hosted job
installs once and compiles once, without competing matrix builds.

The production entrypoint is:

```sh
# Manager/coordinator-approved heavy slot only. Requires a clean worktree,
# the initialized clean pinned public upstream/web and exact compiler Node.
# Keep failed output for diagnosis; choose a fresh worktree/run for a retry.
~/.bun/bin/bun scripts/run-agent-web-ci.mjs production
```

It refuses an existing `.cache/agent-web-ci`, a dirty source tree, missing Bun
or compiler prerequisites, source/pin drift or failed stages. It invokes the
existing tooling preparer, the Bun frozen installer/compiler runner and release
packager in sequence. The candidate is `.cache/agent-web-ci/source`; compiled
files stay in `source/apps/web/build`. The release is `.cache/agent-web-ci/web`.
No source checkout or existing candidate is reset or deleted.

The packager now rejects build/output paths outside this worktree's `.cache`,
symlinked parents, source links/special files and hardlinked files. Compiled
attribution is required and preserved. The production orchestrator independently
hashes compiled/package JS and license inventories, then rechecks upstream
cleanliness, candidate pins/source and this repository's clean state.

## Artifacts and receipts

Only successful production runs upload two public artifacts, retained **3 days**:

- `vault-web-<source SHA>`: packaged `web/` contents only, including verified
  hidden public files. No candidate, node_modules, Git data or failed output.
- `vault-web-receipt-<source SHA>`: `build.json`, repository `LICENSE`/`NOTICE.md`
  and original upstream root attribution files prefixed `upstream-`.

`build.json` is capped at 16 KiB. It records the source revision, exact upstream
and tool versions, platform/architecture, preparation/lock/pin hashes, upstream
license hashes, stage outcomes, byte-identity result and artifact inventory
digests/counts/size. File inventories are sorted by relative path and hash
`[path,size,sha256]` records. Receipt inventory limits are 100,000 files, 2 GiB
total and 256 MiB per file. There are no absolute host paths, credentials,
environment dumps, raw dependency trees or private state in the receipt.
`sourcePreparation` describes the earlier unbuilt preparation stage; top-level
`compiled`/`packaged` describe the final successful pipeline.

Artifact digests describe this run; they do not promise identical compilation
across operating systems or timestamps. The stronger packaging claim is exact:
compiled JavaScript and license files are byte-identical before/after packaging.
`deployed`, `renderedAcceptance` and `authenticatedAcceptance` remain **false**.
An artifact upload is neither deployment nor owner acceptance.

## Setup/failure handling and pending acceptance

Missing pinned Bun/Node or unavailable pinned action/downloads are prerequisites,
not permission to change versions. A frozen install failure must be diagnosed
without deleting the committed lock, enabling lifecycle scripts, installing
unfrozen dependencies or switching managers. Source drift needs a reviewed new
candidate, not a reset of dirty originals. Compiler failure preserves its output;
do not retry blind Bun-only full builds or increase concurrency. A timeout/OOM
needs a coordinator-approved resource slot or hosted-runner adjustment, not a
dependency upgrade. Missing attribution or byte mismatch stops packaging.

On Pranshi's `raven` at the exact phase-two base, local Bun 1.4.4 hygiene passed
and the one aggregate fixture passed (**1 pass, 0 fail**). Workflow YAML parsed
locally; the pinned action tags were checked against their public Git remotes.
No upstream initialization, dependency install, full compile, GitHub CI dispatch,
artifact upload, browser runtime, rendered screenshot or live acceptance was
executed by this worker. This worktree's upstream web submodule is uninitialized;
the worker has no heavy-operation slot. No permitted rendered runtime was
available or needed for these non-UI tooling changes.

The original manager must run the explicit Linux production job after source
integration and inspect its receipt/artifacts, then perform desktop/mobile
rendered and authenticated request acceptance on the assembled app. Existing
accepted GoDial behavior and all imported data were not accessed or changed.
No deployment is part of this handoff.
