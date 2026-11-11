# Password release deployment access

On 2026-10-26 Osiris installed the reviewed `vault-ops` root-owned helper and its
sudo rule. `sudo -n /usr/local/sbin/vault-ops status` now succeeds. It reports
`osiris-vault:0.2.0-agent-web-f561d18`, image ID
`sha256:82fc407ef671cbc3477ed32a973e7bd088439726c90fa627a8e37362d867b7fb`, healthy.
This independently confirms the release base at https://vault.scaleadvertisement.com.

The helper permits status, the existing encrypted-backup service, and the existing
activation guard. It does not grant arbitrary Docker image builds or imports.
Consequently the final image-build step still requires an administrator to run a
reviewed command after the artifact is ready. This is a privilege boundary, not
another deployment permission request: Osiris has already authorized deployment.

Source integration in this worktree starts at the exact deployed `f561d18` commit.
`prepare-web-password.py` reuses that release's agent source and pinned Bun tooling,
then adds only the reviewed password patch. Its tests compare against the exact
unmodified agent candidate. Password source hashes are checked before building.
The locale cache tag incorporates the password receipt to invalidate stale copy.
Bun installs use `--backend=copyfile` to satisfy the existing candidate isolation
checks without hardlinks into dependency caches. Versions and lock bytes stay pinned.
The existing Node 26.12.0 compiler exception is retained. Release source maps remain off. Repeated builds received SIGTERM during asset
processing; the VPS candidate now runs Terser in the compiler process rather than
spawning a worker, to avoid duplicating the module graph in memory. Production
minification, source pins and dependency versions remain enabled and unchanged.

A backup command can briefly pause the Vault service as part of its established
consistent-snapshot routine. No backup, activation or production write has been
performed by this source/preparation step. Backup verification and rollback
configuration remain mandatory before final activation. Existing official client
restrictions on very short passwords remain outside this web-only release.

## Current execution blocker

The automation session repeatedly returned exit 143 / SIGTERM before emitting a
complete web build. This also occurred with Terser in-process and a direct call
to the documented Node compiler. No compiler success receipt or accepted artifact
was produced. The cause of the termination has not been established; it is not
being represented as a source compilation error or a successful release.

Combined-source validation passed: 61 authentication tests, 96 policy/master-key
service tests, nine real SDK/lock checks, three preparation cases, three packaging
cases, one packaging CI safeguard case and the synthetic agent UI contract fixture.
Both upstream checkouts remain clean. No production backup, image build or
activation has run. The live `f561d18` image remains healthy.

The build-only handoff is `.cache/build-and-package-password.sh`, to be run as
`t3worker` from an administrator terminal using `runuser`. It uses Bun's frozen
installer and reviewed Node compiler exception, requires a successful compiler
receipt before packaging, and prints only public artifact metadata. The generated
administrator deployment script is not executable as a valid release until this
step completes. Its final privileged image build remains an administrator step.


## Administrator build failure identified

The administrator terminal reproduced a definitive V8 heap exhaustion at about
4,096 MiB during asset processing. This establishes a compiler heap limitation;
it does not establish the cause of every earlier automation SIGTERM.
The Linux build runner now supplies `--max-old-space-size=6144` to the actual Node
compiler command and refuses to start unless `/proc/meminfo` reports at least
8,192 MiB available. The extra 2 GiB budget covers native/compiler and system
headroom; other applications are not stopped or reconfigured. Terser stays in-process.
The non-Linux original budget remains unchanged. New budget boundary/failure
checks pass. No source pin, dependency, authentication code or running image changed.
Rerun the existing build-only handoff to produce the still-required success receipt
and deployment artifact; production is not changed by that handoff.
