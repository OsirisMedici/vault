# Vault web builds with Bun

Vault's web tooling uses Bun **1.4.4**, the reduced OSS web export at
`d2a095eb800fe80a9bc524579b974796eae51994`, and web version `2026.7.0`.
It prepares an isolated candidate, installs its frozen dependencies without
lifecycle scripts, then compiles the OSS app through Webpack's public API.
Bun owns installation and orchestration. The full Angular compiler has a
documented Node **26.12.0** runtime exception on this 8 GiB Mac.
It does not build desktop, alter auth/crypto dependencies, deploy, start services,
replace installed apps, or touch private configuration.

## Daily build path

Run from the Vault worktree that owns the build. Use a fresh candidate name each
time. `--source` may point to another owner's **clean pinned public checkout**;
it is read-only. The output must be inside this worktree's `.cache`, with no
symlinked path components.

```sh
python3 scripts/prepare-agent-web-tooling.py \
  --source /absolute/path/to/clean/upstream/web \
  --output .cache/agent-web-bun
bun scripts/build-agent-web-bun.mjs .cache/agent-web-bun
```

The first command calls the existing `prepare-agent-web.py` without modifying
that script or its UI patches. It then applies the tooling transformation to the
new copy. The second runs the equivalent of
`bun install --frozen-lockfile --ignore-scripts --prefer-offline --network-concurrency=8` in that candidate, checks
installed root versions, and builds. The Bun runner explicitly requires the
reviewed Node version for its compiler child with a 4096 MiB old-space bound.
There is no npm command or automatic fallback. Output is
`.cache/agent-web-bun/apps/web/build`. Existing source preparation owns UI patches
and branding assets; this tooling adds no new UI or asset changes.

The runner sets `ENV=selfhosted`, `NODE_ENV=production`, `LOGGING=false`, and a
stable `CACHE_TAG` derived from the preparation receipt. It uses the upstream OSS
Webpack factory and limits its existing Terser instance to one worker in memory.
It does not patch installed dependencies or persist Webpack configuration edits.
Compiler errors fail the command, and the runner closes the compiler afterward.
It prints build stages and caps registry concurrency at eight requests. A fresh
install at the previous default saturated this Mac's network during integration;
the pinned cache preference avoids downloading already available packages.
The release runner disables optional external JavaScript source maps. A measured
full build with upstream production maps reached an 8.5 GiB peak footprint on
this 8 GiB Mac during final packaging. Production minification and Angular optimization
remain enabled; this removes debug artifacts rather than changing dependency
versions or authentication code. Disabling maps alone still measured 7.5 GiB
and remained slow. The complete compiler therefore uses Node through the owned
`compile-agent-web-node.mjs` entrypoint. Bun remains the package manager, fixture
runner and runtime for the bridge and trusted host. The small Bun compiler
fixture below demonstrates the CLI fix; it does not prove that the complete
Angular graph is suitable for Bun's runtime on this host.
Repeat builds reuse the candidate's installed dependencies with another frozen
install check. This is repeatable dependency/tooling preparation, not a claim
that every emitted file is byte-identical across hosts.

## Why the previous commands failed

1. The public export contains `apps/web` and `libs`, but root manifests retain
   `apps/desktop/desktop_native/napi` as a workspace and
   `@bitwarden/desktop-napi` as a local file dependency. That directory is absent.
   Bun's npm-lock import validates the workspace and stops with
   `Workspace not found`. Switching package managers concealed this malformed
   web-only input rather than fixing it.

   Preparation removes exactly that workspace and root dependency from the
   generated `package.json` and lock root, plus the two absent NAPI package/link
   records from the generated npm lock. Other original lock records remain,
   including records from absent apps. Original source stays clean. Byte-exact
   original manifests are retained in the candidate as
   `vault-agent-web-upstream-package*.json`. The candidate declares
   `packageManager: "bun@1.4.4"` and receives the committed owned Bun lock.

2. Installed `webpack-cli@7.0.2`, `lib/webpack-cli.js:1788`, does
   `const { default: CLIPlugin } = (await import("./plugins/cli-plugin.js")).default`.
   Its CommonJS plugin ends with `exports.default = CLIPlugin`. Bun 1.4.4 exposes
   that class at the import namespace's `.default`. The extra destructuring reads
   an undefined constructor, and line 1887 fails at `new CLIPlugin(...)` before
   compilation. A tiny input reproduces the same failure without Angular.

   The owned runner calls `webpack(config)`, `compiler.run`, and `compiler.close`
   directly. This avoids the CLI import mismatch and preserves its pinned version.
   It does not claim to repair webpack-cli for every Bun command. Use the daily
   build command above instead of `bun --bun .../webpack-cli/bin/cli.js`, the
   upstream npm build scripts, or an ad hoc dependency upgrade.

## Pins and drift checks

`tooling/agent-web/pin.json` records original manifest/config hashes, Bun lock
hash, toolchain versions, and the converted dependency inventory. The committed
`tooling/agent-web/bun.lock` comes from the parent's successful Bun conversion
of these exact transformed public manifests. No fresh resolution is needed.

Every one of its **2,439 unique registry package/version/integrity records**
matches the original upstream npm lock. Bun's imported graph omits **99** unique
registry records from the larger export lock. Their sorted inventory digest is
pinned, so further omissions also fail verification. This does not assert that
the two lock formats have identical hoisting or that every upstream monorepo
record is installed. No retained registry package is upgraded or substituted.

The checks compare the entire generated npm lock against the exact permitted
transformation, root dependencies and normalized overrides against Bun's lock,
and all installed root versions before compilation. Critical pins include
Angular compiler/compiler-cli `21.2.17`, TypeScript `5.9.3`, Webpack `5.106.2`,
webpack-cli `7.0.2`, Nx Webpack `22.6.5`, and both Bitwarden SDKs
`0.2.0-main.883`. Lifecycle scripts remain disabled for this web-only workflow.
No desktop/native installation acceptance is implied.

Source/lock/runtime drift, a stale receipt, an existing output, a candidate
outside this worktree, escaping symlinks, or hardlinked candidate files stop the
command with an error. Correct the cause and prepare a fresh candidate. Do not
delete the frozen lock, run an unfrozen install, switch package managers, or
relax these guards as a recovery step. A future upstream or Bun upgrade needs a
reviewed new pin, conversion audit, and compile check; these checks cannot
guarantee compatibility with all future library changes.

## Lightweight verification and handoff

```sh
# Static candidate, original-lock, version and inventory checks only.
bun scripts/build-agent-web-bun.mjs --check-lock .cache/agent-web-bun
# Bun's frozen lock validation, without installing node_modules or compiling.
bun scripts/build-agent-web-bun.mjs --lock-check .cache/agent-web-bun
# Optional dependency installation and installed-root checks, without compiling.
bun scripts/build-agent-web-bun.mjs --install-only .cache/agent-web-bun
# One focused regression case, using public installed dependencies read-only.
VAULT_WEB_REGRESSION_DEPENDENCIES=/absolute/path/to/public/candidate \
  bun test ./scripts/check-agent-web-bun.test.mjs
python3 -m py_compile scripts/prepare-agent-web-tooling.py
git diff --check
```

On 2026-10-23 the single regression case passed under Bun 1.4.4. It asserted the
actual CLI export shape, reproduced `undefined is not a constructor` at
`new CLIPlugin`, and compiled the same tiny input through the owned API runner.
It used the parent's installed public dependencies read-only and wrote only a
temporary fixture in this worktree. Preparation and frozen lock validation
passed locally. No Angular compile was started here while the parent compiled.

The parent must cherry-pick this tooling commit, prepare a fresh candidate, and
run the daily build command when its current compile has finished. A successful
parent compile through its separate temporary API helper would support the
approach, but does not verify this wrapper's complete Angular path. Full compile,
rendered UI/authenticated acceptance, branding acceptance, and deployment remain
the parent's work. See [the UI acceptance steps](agent-vault-web-ui.md).
