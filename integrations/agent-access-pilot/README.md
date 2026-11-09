# Vault agent-access pilot

This is the disposable Mac fixture for [Vault #2](https://github.com/OsirisMedici/vault/issues/2). The owner has two ordinary Vaultwarden login items. Karen sees and uses only the one the owner grants. The only action available to Karen is a read of a fixed synthetic website after the trusted browser verifies the exact signed-in account.

## Run locally

Prerequisites: Apple Silicon macOS, a running local Colima Docker context, Bun 1.4.4, OpenSSL, Bitwarden CLI 2026.10.0, and a separate Chrome for Testing binary. The pilot does not start or reconfigure Colima. It does not use an installed Chrome profile. If needed, set `PILOT_CHROME_FOR_TESTING` to the absolute path of the executable named `Google Chrome for Testing`. Chrome for Testing 152.0.7977.42 was selected for the Mac fixture.

From this directory:

```sh
docker --context colima pull python@sha256:1e1f6334529d1fb26a2ef619d7cffb30a7c7d7cc1cc7338ebee283a58d1aeaca
docker --context colima pull vaultwarden/server:1.37.4@sha256:efb3cde962015fcc036b2ea625242248611943b27212ebf4392841fb30fad055
bun install --frozen-lockfile --ignore-scripts
bun test
bun run pilot probe
bun run pilot demo
bun run pilot console
```

The console runs in the trusted owner's terminal. Try `show`, `grant a`, `list`, `run a`, `run b`, `revoke a`, `run a`, `audit`, and `exit`. A successful run reports that the browser started signed out, used private fill, verified the exact account, and read two sample records. A denied run returns only a status and a request ID. The demo also tests a known but ungranted account ID, an arbitrary URL, a spoofed agent, and requests for raw fill, owner controls and browser controls.

Vaultwarden and the fixture bind to temporary loopback ports. CLI trust uses a temporary certificate only in the private subprocess environment. Fixture data, CLI state, grant database, and browser profiles are disposable. They are removed on normal exit. Ctrl-C attempts the same cleanup. The only persistent prerequisites added by the commands above are the two Docker image caches and the local dependencies. After a hard kill, check `docker --context colima ps --format '{{.Names}}'` for the exact `vault-pilot-store-<UUID>` or `vault-karen-<UUID>` belonging to the failed run. Stop only that container and remove only that run's temporary directory. No existing Vault, Vault 2, Keychain, T3 registration, or installed client is part of the pilot.

## Trust boundary

- The Mac owner, Docker daemon, Colima VM and trusted launcher are in scope as trusted operators. The launcher runs the fixed Karen workload in a separate Linux container as UID 65532. The worker has only loopback, a read-only filesystem, dropped capabilities, no privilege escalation, no host mounts or Docker socket, and no inherited vault variables. The probe checks these properties from inside the worker using real synthetic canaries. This is not a claim against a compromised host, Docker daemon, or kernel.
- The launcher binds the private container stdio channel to Karen. The JSON request cannot set its agent identity. The worker has no token or owner endpoint, and receives only a fixed response shape. Owner actions are local calls from the trusted console. Ordinary T3 with shell or Docker access is not this worker.
- Vaultwarden stores the two logins through the official Bitwarden CLI, with a private CLI profile and session. The disposable owner is bootstrapped using the pinned Bitwarden SDK crypto and Vaultwarden's supported legacy registration fields. Broker grant and audit records are in a separate SQLite database; they contain account and grant IDs, not credentials. The production Vault schema and existing Vaultwarden sharing are untouched.
- BetterWright uses a fresh profile and a host-owned credential adapter. The executor checks the grant generation before and after reading the cipher. The adapter checks the grant, exact account ID, and exact fixture origin at handoff. The broker rechecks permission before browser steps and before releasing the result. No arbitrary script, destination, raw browser channel, or generic fill is available to the worker.
- SQLite survives reopening the broker inside the fixture run. Revocation invalidates the current grant generation and denies future uses. It cannot undo a provider effect that already committed, or invalidate an already-issued website session. The demo revokes after the browser authenticates but before the harmless read, verifies that no read took place, and observes the previous session separately. All sessions and grants are discarded when the disposable fixture ends.

The pilot has no real providers, MFA, installed T3 connector, or distributed workers. It does not provision a long-running vault or claim support on a standalone Linux host. Before adding any real credential, re-evaluate those boundaries and obtain separate provider consent.

References: [Vaultwarden pin](../../upstream.lock.json), [Bitwarden CLI](https://bitwarden.com/help/cli/), [BetterWright 2.9.1 credentials](https://github.com/BetterWright/betterwright/blob/7aee003e7b627e292f852963b4ae40b569f41e21/docs/credentials.md), [Docker network isolation](https://docs.docker.com/engine/network/drivers/none/).

## Vault Launcher on the Mac

The launcher uses the existing signed-in session inside its **Vault Account**
window. It needs a Vault web build with the Mac copy bridge and an HTTPS origin.
Build it locally from the repository root with Bun and the macOS Command Line
Tools.

```sh
VAULT_LAUNCHER_URL=https://your-vault.example \
  bash integrations/agent-access-pilot/macos/build.sh
open ".cache/vault-launcher/Vault Launcher.app"
```

Click **Vault** in the menu bar, then **All Apps** to sign in and unlock
privately. Search for a saved login or select a recent app. The app row copies
the username and password, the key copies just the password, and the chain
copies the app link. If more than one login matches, choose the correct account.
The launcher remembers the selection. Vault enforces its lock timeout and item
reprompts. Use the account window when an item requires a reprompt.

Credentials copied through the menu are marked sensitive, stay on the Mac,
and clear after 30 seconds if you have not copied something else. Closing
the menu cancels a pending copy. Recent tiles use initials unless you provide
local PNGs you have permission to use via `VAULT_LAUNCHER_ICON_DIR`. Name the
files after the lower-case app names, such as `gmail.png`.

For Notion's **Continue with Google** flow, select the intended Google login
under Gmail first. The Notion row and key use that selection. The Notion
chain copies the site link. An optional `.local/notion-launch-url` file can
hold an approved Notion page for the browser shortcut.

The bundle is ad hoc signed for local use. The main menu's **Automatic
sign-in** entry is planned. Run the launcher with `--demo-apps` to try the
separate disposable sessions, or build without `VAULT_LAUNCHER_URL` to
use the fixture without configuring a Vault account.

Run `bun test integrations/agent-access-pilot` from the repository root
for broker and launcher checks. Run the generated executable with
`--verify-launches` to exercise manual and automatic fixture launches,
existing sessions, and expiry. This mode uses disposable data.
