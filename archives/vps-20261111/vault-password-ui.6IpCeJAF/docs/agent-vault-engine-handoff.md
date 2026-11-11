# Agent Vault engine handoff

22 October 2026. Independent source deliverable on `work/agent-vault-engine`,
based on planning commit `b749937`. The commit containing this handoff is the
delivery SHA; obtain it with `git log -1 --format=%H` on the delivered branch.
No automatic manager callback, peer coordination, merge, push, PR, deployment,
service restart, registration change or live-import access occurred.

## What is ready

The trusted host can connect to the existing approved API address immediately,
write an explicit login pair for internal provisioning, and consume an exact
selected pair without serializing it. The separate companion package supplies
a reviewed path to a pinned full upstream engine on the VPS. Browser routes,
metadata selection and final imported-account acceptance belong to later
assembly and are not claimed by this branch.

Only these paths are delivered:

- `integrations/agent-vault/engine/client.mjs`
- `integrations/agent-vault/engine/http.mjs`
- `integrations/agent-vault/engine/private-file.mjs`
- `integrations/agent-vault/engine/provision.mjs`
- `integrations/agent-vault/engine/status.mjs`
- `integrations/agent-vault/engine/acceptance.mjs`
- `deploy/agent-vault/compose.yaml`
- `deploy/agent-vault/Dockerfile`
- `deploy/agent-vault/launch.sh`
- `deploy/agent-vault/build.sh`
- `deploy/agent-vault/prepare-state.py`
- `deploy/agent-vault/engine.example.json`
- `deploy/agent-vault/LICENSE.upstream`
- `deploy/agent-vault/NOTICE.md`
- `deploy/agent-vault/README.md`
- `docs/agent-vault-engine-handoff.md`

## Callable interface and local run

No npm dependencies or root manifest changes. Node 22+ with built-in fetch is
required; the acceptance runtime used Node 26.12.0.

```js
import { createEngineClient, loadEngineConfig, credentialRefForSourceId }
  from './integrations/agent-vault/engine/client.mjs';

const engine = createEngineClient(await loadEngineConfig(privateConfigPath));
await engine.health(); // {state: 'ready' | 'engine_unavailable'}
const ref = credentialRefForSourceId(sourceUuid);
await engine.putLogin({credentialRef: ref, username, password});
await engine.withLogin(ref, consumeInsideTrustedHost);
```

`createEngineClient({address,vaultName,tokenFile,fetchImpl?})` exactly follows the
frozen contract. `putLogin` returns `{state:'ready'}`. `withLogin` passes
`{username,password}` only to its internal async callback and returns that
callback's result. The callback must return a bounded result; this is trusted
host code, not an arbitrary agent-supplied function. Nothing here is an MCP
credential-reveal tool.

For UUID `00112233-4455-6677-8899-aabbccddeeff`, the prefix is
`VW_00112233445566778899AABBCCDDEEFF`. The only keys used are that prefix plus
`_USERNAME` and `_PASSWORD`. Reads use two single-key reveal requests scoped to
the configured vault. Missing/mismatched pairs, non-static values, invalid
refs and a proxy-only token fail before invoking the callback.

Private config example, stored outside source with mode600 in a canonical
mode700 directory:

```json
{"version":1,"address":"http://127.0.0.1:18431","vaultName":"bitwarden-import-20261022","tokenFile":"/private/path/integration-v1/member-token"}
```

The token file contains only a private account-session capability and optional
one trailing newline. Private readers reject symlinks, wrong ownership,
non-mode600 files, non-mode700 parents, hardlinks, malformed UTF-8 and oversize
input. Use canonical paths, for example `/private/tmp` rather than macOS `/tmp`
symlinks. No live configuration or capability file was read during this work.

Run bounded status on the approved runtime after assembly:

```sh
node integrations/agent-vault/engine/status.mjs \
  /private/path/integration-v1/engine.json
```

The client permits HTTP only for exact loopback hosts. Other addresses require
validated HTTPS. Redirects are denied, each HTTP request times out after five
seconds, and response bodies are capped at 64 KiB. Errors use local reason codes
only. Native failures and upstream bodies are discarded. No automatic retries
or token renewal occurs. `health()` checks `/health` and the member-gated
`GET /v1/sessions?vault=...` without revealing credentials. That endpoint is why
a proxy token reports unavailable rather than falsely ready for host reveal.

Stable error reason codes are `invalid_config`, `private_file_unavailable`,
`invalid_reference`, `invalid_login`, `engine_unavailable`, `engine_timeout`,
`capability_denied`, `credential_missing`, `invalid_response`,
`request_rejected`, and `consume_failed`.

## Acceptance C01 and C02

Only the two allocated cases ran, once each. No historical upstream suite,
provider sign-in, import case or broad matrix ran.

```sh
node integrations/agent-vault/engine/acceptance.mjs \
  /tmp/vault-agent-vault-eval.rIoisH/agent-vault-preview
```

- C01 passed. A disposable engine started on a dynamically selected loopback
  port, with its own random dummy master/owner/password values and mode700
  temporary state. Provisioning created an empty vault, invite-only gate,
  unmatched deny and a separate proxy capability. The client reported ready,
  wrote the dummy pair, stopped only its own child, restarted with the same
  private state, and matched both values through `withLogin`.
- C02 passed. The minted proxy-only capability could not reveal the dummy
  pair. The client returned `capability_denied`, never invoked the consuming
  callback, and did not report host readiness for that capability.

The binary SHA-256 was
`346465d4cc8526100c1bc859199aeaa36aea386b20a51b0ac67346b01f0902c6`.
It is the already-built evaluation binary, whose only documented deviation
from upstream is isolated filesystem paths through `AGENT_VAULT_EVAL_HOME`.
The clean upstream checkout was verified at
`d5836ec3bb2315de38043d742ae5daca11a4944a`, with no Git changes. The runner
did not inherit live Agent Vault, provider, database or SMTP environment, used
no proxy listener, printed only bounded case receipts and binary hash, and
removed its temporary state. It never contacted ports 18431/18432.

After these passes, only malformed-input guards, error normalization and status
exit-code handling were tightened. Their syntax checks passed; the allocated
runtime cases were not expanded or repeated. C01 establishes dummy local
restart persistence, not real-data restore or VPS container acceptance.

Final narrow checks passed: Node syntax for all six engine modules, shell
syntax for both launch/build scripts, Python AST parsing for state preparation,
`docker compose ... config --quiet`, exact comparison of the upstream license,
and Gitleaks on the three owned locations with no findings. Compose validation
does not require a running Docker daemon and is not container acceptance.

## Deployment and rollback

The concrete commands, first-owner capability prerequisite, private tunnel,
status, stop, rollback and notices are in `deploy/agent-vault/README.md`.
The build source is pinned to upstream v0.40.1 commit
`d5836ec3bb2315de38043d742ae5daca11a4944a`. A private-file wrapper uses the
inspected supported `--password-stdin` mechanism. API/UI and proxy publish only
on VPS loopback ports 19431/19432. New data is outside source and separate from
Vaultwarden. No public route or database mount is added.

Manager-reviewed start on the VPS, from the assembled source:

```sh
sudo -n sh deploy/agent-vault/build.sh
sudo -n python3 deploy/agent-vault/prepare-state.py
sudo -n docker compose -f deploy/agent-vault/compose.yaml up -d --no-deps engine
```

These commands were **not run**. The narrow build prerequisite is a working
Docker Engine/Compose v2 and availability of the exact digest-pinned upstream
base images and build registries. `docker info` here failed because the local
Colima Docker socket was missing. No alternate image or unreviewed `latest`
was substituted. The exact-source container build remains unverified.

Rollback after a reviewed first activation:

```sh
sudo -n docker compose -f deploy/agent-vault/compose.yaml down
```

This removes only the companion container/network and preserves its data and
master file. It does not affect Vaultwarden. No VPS command ran in this turn.

## Remaining activation and limitations

For the shortest local path, assemble the independently delivered modules and
point this client at the already-running engine with its approved private
member/admin capability and imported manifest. Do not provision or restart
that trial. The manager owns C08-C10 and real exact-account website acceptance.

For a new VPS companion, review/build the image, prepare new private state,
start the service, privately enroll the first owner, save the host's normal
authenticated session, and explicitly run the new-vault provisioner. That
provisioner refuses existing vaults and never refreshes/imports real passwords.
`POST /v1/sessions` only mints proxy tokens; those are not host capabilities.
Real snapshot migration needs a separate reviewed step. No VPS readiness,
provider account identity or assembled application success is claimed here.

The imported passwords remain a snapshot. Live Bitwarden sync, Touch ID,
native enrollment and signed desktop replacement are deferred. Upstream writes
the two keys without a transaction; a failed write can be partial. Do not use
concurrent imports/refreshes while a login is consuming its pair. Errors do
not trigger a silent retry. JS strings and trusted callbacks cannot promise
secure memory erasure. Same-user unrestricted host access can reach private
files; this is a practical workflow boundary, not host isolation.
