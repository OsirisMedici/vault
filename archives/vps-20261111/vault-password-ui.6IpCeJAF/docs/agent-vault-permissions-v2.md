# Agent access: private opt-in team permissions

This source change lets the release manager stage explicit account/provider
access for individual Vault identities. Existing config version 1 retains the
accepted owner behavior: every allowlisted identity sees the existing imported
snapshot and supported account choices. Version 2 requires a separate private
policy; an empty grant list grants nobody access, including the import owner.
This work does not activate any policy, onboard real users, access credentials,
deploy, restart a service, or replace the accepted web/desktop installations.

## Private configuration and ownership

Version 2 has exactly the existing configuration keys plus `permissionsPath`:

```js
{
  version: 2,
  vaultOrigin: 'https://vault.example.invalid',
  allowedUserIds: ['11111111-1111-4111-8111-111111111111'],
  manifestPath: '/private/synthetic/manifest.json',
  workerTokenFile: '/private/synthetic/worker-token',
  databasePath: '/private/synthetic/jobs.sqlite',
  engineAddress: 'http://127.0.0.1:18431',
  permissionsPath: '/private/synthetic/permissions.json'
}
```

These are illustrative synthetic paths/IDs, not an active configuration. Keep
all private files outside source, owned by the service uid, mode 0600, with a
canonical mode-0700 containing directory. Symlinks, hardlinked files, nonprivate
files, duplicate paths, unknown fields and oversize documents fail closed.
No policy is created automatically and version 2 never falls back to version 1.

The separate policy has exactly this shape (policy version 1 is distinct from
bridge config version 2):

```json
{
  "version": 1,
  "revision": 0,
  "owners": [
    {
      "ownerId": "11111111-1111-4111-8111-111111111111",
      "accountIds": ["synthetic-account"]
    }
  ],
  "grants": [
    {
      "ownerId": "11111111-1111-4111-8111-111111111111",
      "userId": "11111111-1111-4111-8111-111111111111",
      "accountId": "synthetic-account",
      "provider": "clickup"
    }
  ]
}
```

The release manager must establish each import's actual owner before assigning
its nonsecret account ID. The manifest does not prove ownership itself. An
account can belong to one policy owner only. Every owner and grantee must already
be in the private allowlist. Grants must name an existing imported account and
one of its existing supported provider/origin pairs. Only `clickup` and `godial`
are supported. Assigning ownership alone confers neither account access nor
authority over somebody else's imports. No wildcard or provider-wide grants,
implicit owner access, additional providers, or ownership/allowlist editing API
is introduced. Unsupported imports may be assigned an owner but cannot be granted
an actionable provider. Unassigned imports stay inaccessible in version 2.

Policies are capped at 1 MiB, 32 owners, 20,000 uniquely assigned imported account
IDs and 4,096 unique user/account/provider grants. The existing metadata limit
of 256 supported provider rows remains. Unknown/duplicate/malformed ownership or
grant records make the whole policy unavailable, rather than dropping bad rows.

## Authorization and unchanged HTTP projections

Every recognized user endpoint authenticates by GETting the fixed configured
Vault HTTPS `/api/accounts/profile`, with redirects forbidden. It checks the
returned UUID against the private allowlist; a request body never supplies the
authenticated user. Existing exact Origin checks, required mutation Origin,
bounded UTF-8 JSON parsing, no CORS, no token forwarding to the engine, fixed
public errors and constant-time private worker capability checks remain.
`GET /health` is still only a public process check.

Version 2 reloads and validates the private policy on every authenticated user
operation, again after asynchronous mutation-body reads and status health
checks, and immediately before each atomic worker transition. Missing, malformed
or unsafe policy yields only `503 {"error":"unavailable"}`. It never grants
access from a stale cached policy. Config/manifest/allowlist changes require a
manager-controlled service restart; policy grant changes do not.

- `/accounts` enumerates only explicitly granted account/provider pairs.
- `/status` keeps its exact fields. In version 2 both counts describe unique
  granted actionable imported accounts, so unsupported or ungranted imports do
  not reveal the global inventory. Version 1 retains its full imported count.
- `POST /requests` requires a grant for the exact account and provider. An
  existing supported but ungranted pair is `403 forbidden`. Existing malformed
  or unsupported requests remain `400 invalid_request`.
- Reads and cancellation require both the original request user and a current
  grant. Cross-user or revoked reads/cancels are `404 not_found`; sharing an
  account does not share another user's requests.
- Authenticated `GET /requests` (public prefix `/api/agent-vault/requests`)
  returns exactly `{"requests":[...]}`. It selects only the current user's
  currently authorized requests, newest first, maximum 25. Creation order breaks
  equal timestamp ties. Each entry is the unchanged public AgentRequest shape:
  `requestId,state,provider,name,username,origin,expiresAt,identityVerified`.
  History never claims, resumes or executes work. Retention/expiry cleanup still
  occurs; no credential refs, account IDs, owners or private paths are projected.
- Immediately before claim, a revoked queued request becomes `cancelled` with
  `identityVerified:false`, and claim returns `403 forbidden`. Further claims
  are refused. If a grant is revoked during work, completion becomes `failed`
  with false identity verification and also returns 403. It cannot publish a
  successful stale completion. This cannot undo browser activity that occurred
  before revocation; trusted executors must still honor their existing guards.

The policy snapshot immediately preceding the synchronous SQLite transaction
defines transition authorization. A later policy replacement cannot undo an
already committed claim. Cancellation, five-minute expiry, single-active-user
uniqueness, immediate SQLite transactions, active/storage limits and fixed
worker response projections remain. Worker routes have no new public exposure;
the release manager must preserve the existing reverse-proxy block.

## Trusted-local administration and audit

Trusted host code may call the bridge instance's `replaceOwnerGrants` method:

```js
await bridge.replaceOwnerGrants({
  ownerId: '11111111-1111-4111-8111-111111111111',
  expectedRevision: 0,
  grants: [{
    userId: '11111111-1111-4111-8111-111111111111',
    accountId: 'synthetic-account',
    provider: 'clickup'
  }]
}); // { revision: 1 }
```

This replaces the complete grant set issued by that owner, preserving other
owners' grants and all ownership records. An empty list revokes that owner's
grants. It refuses accounts outside that owner's assigned import set, unknown
grantees, unsupported pairs and stale revisions. A cooperative exclusive lock,
mode-0600 staged file, file fsync, atomic rename and directory fsync protect
against partial writes and concurrent helper updates. Readers see a complete
old or new policy. A stale `.lock` stops writes for manual operator review; the
helper never removes another writer's lock. Do not manually overwrite policy
while a helper write is active.

The helper **does not authenticate the human**. `ownerId` is an assertion from
trusted local host code, not a caller-supplied HTTP identity. Its caller must
authenticate the owner and bind that identity before invoking it. Neither a
Vault bearer nor the worker capability grants access to this method; there is
no HTTP/MCP admin route, CLI accepting credentials, browser admin UI, or live
activation command. Same-uid unrestricted code can modify private files and
cannot be contained by this helper. Only the release manager provisions
ownership/allowlist changes after the appropriate real authorization review.

The same private SQLite file adds an `audit` table and a history index without
changing jobs columns or existing response shapes. Audit retains at most 1,024
records for one hour, pruned on writes/startup/request cleanup. Its only columns
are sequence, timestamp, actor UUID, fixed action, optional request/account IDs
and provider. It records request transitions, denied creates and grant update
attempts/applies; it is not an exhaustive read/access log or tamper-proof ledger.
It stores no names, usernames, credentials, hashes of credentials, tokens, raw
errors, upstream bodies or private paths, and has no public read endpoint.
An update attempt is committed before the file update. If a filesystem fsync or
the applied-audit write fails after rename, a generic failure can accompany an
already changed policy. Trusted code must privately re-read the policy revision
and audit attempt before retrying; it must not blindly reapply a stale edit.

## Manager migration, rollback and pending acceptance

No live migration has been performed. Before activation the manager must review
ownership against its private import source, preserve the working version-1
config and private SQLite snapshot, stage a separate mode-0600 policy, and
confirm exact intended grants with the owner. Start with no new users or grants
unless separately authorized. Build/review the combined candidate on Osiris's
Mac, validate the existing proxy's public worker block, and activate only under
the manager's release scope. Keep original manifests, imported credentials,
Vault data, accepted images and signed apps unchanged.

Rollback must restore the original owner-only allowlist as well as config
version 1, removing the version-2-only `permissionsPath` key. Merely changing the
version while retaining team members would give those allowlisted identities
the broad version-1 catalog. The old config loader rejects extra fields. Drain
or cancel active jobs under the appropriate trusted manager scope before
rollback; never reauthorize stale team requests by accident. The additive audit
table/index can remain when using the old bridge; it ignores them. Preserve the
private policy/audit for review. Do not restore/delete vault data or credentials
to roll back permissions. Actual deployment/restart commands remain the release
manager's responsibility under the existing operations/delivery documents.

## One aggregate synthetic acceptance case

From this repository, with Bun 1.4.4 and no dependency install:

```sh
~/.bun/bin/bun test ./integrations/agent-vault/web-bridge/acceptance.test.mjs
```

Verified on Raven with Bun 1.4.4 on 23 October 2026: **1 pass, 0 fail**
(one aggregate case, 1.49 seconds). Static parsing of all six bridge `.mjs`
modules and `git diff --check` also passed. No install or Angular build ran.

The existing single case is extended, rather than adding a suite. It covers
unchanged version-1 owner behavior; auth/origin/strict schema/private-file
guards; explicit allow/default-deny and provider grants; two-user enumeration,
create/read/cancel/history isolation; owner-scoped revisioned grant updates;
revocation before claim and completion; malformed/missing/unsafe policy refusal;
atomic claims, completion, expiry and retained metadata; newest-25 history;
bounded audit/retention; and no private/secret projection. All files, identities,
profile replies and worker capability in this case are synthetic and temporary.
The injected fetch never contacts Vault, a provider or the engine.

This is non-UI bridge evidence. No frontend runtime was started, so there are no
rendered baseline/result screenshots or real-session evidence. The manager's
combined build, desktop/mobile rendering, real authenticated team identity and
ownership/grant review, live revocation timing, proxy isolation and original
owner/provider regression acceptance remain pending. Fixture success establishes
neither deployment nor real browser identity acceptance.
