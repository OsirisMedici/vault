# Authenticated agent access bridge

This Bun 1.4.4 service implements the broker in
[the web contract](agent-vault-web-contract-2026-10-23.md). An allowlisted Vault
owner can list supported imported accounts, queue one sign-in request, poll its
result and cancel queued work. A separate trusted chat executor claims that
request and reports the verified result. The bridge never retrieves credentials
or operates a provider website.

Source belongs to `integrations/agent-vault/web-bridge/`. It uses Bun built-ins,
`Bun.serve` and `bun:sqlite`. There are no package dependencies or install steps.

## Configuration and entrypoint

Set `VAULT_AGENT_WEB_CONFIG` to a fixed, absolute, canonical host configuration
filename outside this checkout. The entrypoint reads only this environment
variable for configuration. It does not search for credentials or read an active
engine configuration. The exact JSON shape is:

```json
{
  "version": 1,
  "vaultOrigin": "https://vault.example.invalid",
  "allowedUserIds": ["11111111-1111-4111-8111-111111111111"],
  "manifestPath": "/run/vault-agent-web/import-manifest.json",
  "workerTokenFile": "/run/vault-agent-web/worker-token",
  "databasePath": "/run/vault-agent-web/jobs.sqlite",
  "engineAddress": "http://engine:14321"
}
```

These values are synthetic examples. Unknown or missing configuration fields
are refused. `allowedUserIds` contains 1 to 32 unique lowercase UUIDs. Both
addresses are canonical origins, with no trailing slash, credentials, path,
query or fragment. `vaultOrigin` must use HTTPS with normal certificate
verification. `engineAddress` accepts HTTPS, loopback HTTP on `localhost`,
`127.0.0.1` or `[::1]`, or the exact `http://engine:14321` exception. Use that
exception only inside the dedicated engine Docker network. It permits only the
fixed unauthenticated `GET /health` probe. Network isolation is a deployment
requirement; the service cannot attest Docker network membership.

The worker token file contains a separately generated cryptographically random
capability with at least 32 random bytes, encoded as 43 to 128 base64url
characters. One final LF is accepted. Vault user bearers and engine owner tokens
must never be used as this capability. Rotate it by replacing the private file
and restarting the bridge. No engine owner token exists in this configuration.

Configuration, manifest and capability files must be regular, single-link files
owned by the service uid with mode exactly `0600`. Their immediate containing
directories must be owned by that uid with mode exactly `0700`. The database and
any SQLite sidecars have the same requirements. All filenames must be absolute,
canonical and outside this source checkout. Symlink files and symlinks in any
ancestor are refused. System ancestors such as `/` do not need mode `0700`;
place the complete private subtree in an owner-only directory. The entrypoint
sets umask `0077` before creating SQLite files. Use a dedicated service uid and
do not let unrelated processes modify these directories while it runs.

Start from the repository root with an already provisioned private configuration:

```sh
VAULT_AGENT_WEB_CONFIG=/run/vault-agent-web/config.json bun integrations/agent-vault/web-bridge/start.mjs
```

`start()` from `start.mjs` reads the environment, validates private files, opens
SQLite, then returns `Promise<{server, stop}>`. `server` is the `Bun.serve`
instance listening on `0.0.0.0:19433`; `await stop()` stops it and closes the
database. Running the file directly installs SIGINT/SIGTERM shutdown handlers.
Startup logs contain a fixed listening message or `bridge_unavailable`, never
raw errors. The server emits no request, header, upstream-body or credential logs.

The parent owns deployment. Publish the container port to VPS loopback only.
The public reverse proxy strips `/api/agent-vault` and forwards user routes to
the relative paths below. Keep `/worker/*` out of that public proxy and call it
through the trusted private host connection. Never forward Vault bearers to the
engine. Deployment and real UI acceptance are not part of this implementation.

## Host and fixture interface

```js
import { createBridge } from './integrations/agent-vault/web-bridge/bridge.mjs';

const bridge = await createBridge({
  config,                         // validated shape above; private files still required
  fetchImpl: globalThis.fetch,     // optional trusted-host injection
  now: Date.now,                  // optional epoch-millisecond clock
});
const response = await bridge.fetch(request); // standard Request -> Promise<Response>
bridge.close();                  // call after pending requests have finished
```

`loadConfig(filename = process.env.VAULT_AGENT_WEB_CONFIG)` is exported by
`config.mjs`. `createBridge` validates the supplied config again. The only
injections are transport and clock, so synthetic fixtures can avoid external
services without weakening production authentication. `fetchImpl` receives only
the two fixed GET URLs with `redirect: 'error'`, `credentials: 'omit'`,
`cache: 'no-store'` and an AbortSignal. There is no injected caller-identity
shortcut. `now` must return a nonnegative safe integer in the Date range.

Each user API call verifies its bearer by GETting exactly
`vaultOrigin + '/api/accounts/profile'`. Only a successful, bounded JSON response
whose `id` exactly matches the allowlist establishes ownership. The service does
not cache user authentication. Extra profile fields never leave the service.
TLS remains enabled and redirects are refused. A present browser Origin must
exactly match `vaultOrigin`; POST user calls require it. There are no CORS
headers or OPTIONS routes. User ids in request bodies are rejected.

The imported manifest uses the existing version 1
`bitwarden-import-20261022` schema. The full schema is validated, including
unsupported rows, and any unknown field such as `password` refuses startup.
Only metadata for exact ClickUp `https://app.clickup.com` and GoDial
`https://app.godial.cc` origins becomes actionable. Unsupported rows are omitted
from `/accounts`. Accounts are a shared imported catalog for the configured
allowlisted owners; the existing manifest has no per-user assignment field.
Each request belongs only to the Vault identity that created it. A shared account
can have separate requests for different allowlisted owners. The startup
metadata snapshot changes only on restart.

## HTTP interface

All responses are fixed JSON projections with `Cache-Control: no-store`. User
POSTs use `Content-Type: application/json` and a JSON object with exactly the
listed keys. Empty cancellation bodies must be `{}`. Unknown routes, methods,
query parameters, fields, mismatched providers and unsupported account ids are
refused. No endpoint reveals a credential reference, private path or owner UUID.

| Method and relative route | Authentication and body | Result |
| --- | --- | --- |
| `GET /health` | Public | `{status:'ok'}`. Process-only check. |
| `GET /status` | Vault bearer | `{state:'ready'\|'engine_unavailable',browserMode:'chat-assisted',importedAccounts,supportedAccounts}` |
| `GET /accounts` | Vault bearer | `{accounts:[{accountId,name,username,origin,provider}]}` |
| `POST /requests` | Vault bearer, matching Origin, `{accountId,provider}` | `201` with Request |
| `GET /requests/:id` | Original Vault owner bearer | Request |
| `POST /requests/:id/cancel` | Original owner bearer, matching Origin, `{}` | Request, only if queued |
| `POST /worker/claim` | Private worker bearer, Origin absent, `{requestId}` | Request plus `accountId`, atomically queued to working |
| `POST /worker/complete` | Private worker bearer, Origin absent, `{requestId,state,identityVerified}` | Request, only if working and unexpired |

`supportedAccounts` counts unique actionable account ids. An account with both
supported origins has two selectable account/provider rows in `/accounts`.
`ready` means the validated import is loaded and the engine process health probe
returned `{status:'ok'}`. It does not prove engine owner access, an active chat
browser connection, or a signed-in provider identity.

Request has exactly these fields:

```js
{ requestId, state, provider, name, username, origin,
  expiresAt, identityVerified }
```

`expiresAt` is an ISO timestamp. States are `queued`, `working`, `signed_in`,
`verification_required`, `credentials_rejected`, `failed`, `cancelled`, and
`expired`. Completion accepts only `signed_in`, `verification_required`,
`credentials_rejected` or `failed`. `signed_in` requires `identityVerified:true`;
every other completion requires `false`. Only the trusted parent may attest the
actual browser identity. Queueing and claiming do not establish sign-in proof.
The parent supplies `requestId` to the worker, which receives the exact selected
`accountId` only at claim. It must bind that id to its actual controlled chat tab.

Worker authorization hashes both capabilities and uses a constant-time comparison
of equal-length digests. It never validates worker credentials against Vault.
Any Origin header, including an empty one, refuses worker access. There is no
worker discovery endpoint or arbitrary engine/provider proxy.

Missing/invalid authentication returns `401`, a nonallowlisted Vault identity or
bad Origin returns `403`, invalid input returns `400`, and missing or another
owner's request returns the same `404`. Refused state transitions and a user's
existing active request return `409`. Full job capacity returns `429`. Internal
or private-state failures return a fixed `503`. Bodies contain only
`{error:<fixed code>}`. No upstream messages or native exceptions are serialized.

## Bounds and persistence

- Requests expire five minutes after creation, including while working. Only
  queued work is cancellable. Atomic SQLite transactions and a unique partial
  index enforce one active request per Vault owner. Claims cannot be replayed;
  cancellation, expiry and a prior completion reject later completion attempts.
- SQLite stores only job identifiers, owner UUID, selected account id,
  provider/name/username/origin, timestamps, state and the identity boolean. It
  stores no bearers, capability, credential reference, passwords or upstream
  profile. Transactions use DELETE journaling, FULL synchronization and secure
  deletion, with 4096-byte pages and a maximum 8192 pages, or 32 MiB. The database
  survives restart. It belongs in private persistent storage, outside Git.
- Capacity is 64 active jobs globally, 1024 stored jobs and 32 concurrent handler
  calls per process. Recent terminal jobs retain their slot; full capacity
  refuses new work. Expiry and removal run lazily on job operations and startup.
  Terminal metadata is removed one hour after its original expiry timestamp.
- JSON request bodies are at most 2048 bytes. Each body read or upstream request,
  including response streaming, has a five-second deadline. Upstream JSON is at
  most 64 KiB, and public response JSON at most 1 MiB. Bun's server also enforces
  the 2048-byte body limit and a ten-second idle timeout.
- Config is at most 16 KiB. The manifest is at most 16 MiB and 20,000 rows, with
  at most 256 supported account/provider rows and a 1 MiB metadata response.
  Names and usernames are at most 1024 characters, ids 256, origins 2048, and
  each manifest row has at most 128 origins. Control characters are refused.

## Focused acceptance

From the repository root, run exactly the synthetic fixture:

```sh
bun test integrations/agent-vault/web-bridge/acceptance.test.mjs
```

It creates and removes a private temporary directory, uses dummy accounts and
capabilities, and injects all upstream responses and time. It covers private-file
permission/symlink refusal, bad or nonallowlisted auth, owner and account/provider
isolation, password/extra-field rejection, queue/claim/completion, duplicate
claims, cancellation, expiry, retention and restart persistence. It verifies
that public projections and the SQLite file exclude the synthetic secret values
and that user bearers go only to the fixed HTTPS profile endpoint. It contacts no
real provider, VPS, browser, Keychain, private vault or installed app.

The parent still needs to provision the private files, restrict the container
network and public proxy, implement the trusted worker adapter, deploy the
service, and perform the real authenticated UI-to-browser identity check.
