# Team and agent access: first source slice

Implemented on 22 October 2026 in `feat/team-agent-access`, based on local
`main` at `1b7e6b14cc704c7622ce2c2edab8e86a3fb765fe`.

## What this builds and why

`vault_access/policy.py` is a Vault-owned, dependency-free Python policy state
machine. It gives the future control service a concrete, tested foundation for
different people and distinct connections to have different workspace/account
access. Previously this repository had branding and desktop preparation, with
the permissions feature described only in proposals.

Osiris can run the source rehearsal and inspect denials, approval consumption,
lease boundaries, revocation and attributable audit without accessing a vault.
This completes a bounded source slice. It does not complete the planned product.

The byte-preserved briefs in [plans/team-agent-access.md](plans/team-agent-access.md)
and [plans/team-identity.md](plans/team-identity.md) retain their original
planning-only wording. The implementation launch explicitly superseded that hold
for isolated source work only. Their unresolved identity, custody, runtime and
live-access decisions remain unresolved. Originals in the durable root checkout
were not edited.

## Finished experience in this slice

From this worktree, with Python 3.10+ (verified here using Python 3.14.6):

```sh
python3 -m vault_access.fixtures
python3 -W error::ResourceWarning -m unittest discover -s tests -v
```

The first command uses an in-memory database, synthetic UUIDs and an `.invalid`
origin. It prints `FIXTURE ONLY`, then shows:

1. Real authorization is denied as `integration_unavailable`.
2. A write without approval is denied; the exact fixture approval reserves one
   simulated operation with a bounded lease.
3. Replaying it is denied. Another connection/workspace and password reveal are
   denied independently of the approval.
4. Revoking one connection stops its in-flight fixture at its next check, while
   the unrelated connection still passes its own fixture policy.
5. External cleanup remains `unverified` for the broker, authentication material,
   native access, target sessions and credential rotation review.

No operation is sent to any application. The random operation UUID in the output
is a local correlation reference, not a bearer token, session or credential.
There is no existing permissions UI in this checkout and no UI is changed by
this slice; no browser, preview server or screenshots were needed.

## Included and excluded scope

Included: immutable scoped policy records, human delegation authority separate
from native sharing, exact connection binding, version checks, concrete approval
binding, transactional approval consumption/reservation/audit, replay prevention,
expiry, monotonic policy revocation, sensitive-boundary rechecks and outcome
records. All executable positive-path tests are explicitly fixtures.

Excluded: issuer selection, owner discovery, invitations/account linking,
enrollment, authentication/credential rotation, native membership provisioning,
unlock/key custody, Touch ID, broker implementation, target app/browser actions,
management UI, actual session cleanup, background timers, deployment and app
replacement. No live grants or permissions were created or changed. The existing
Docker image and desktop preparation/build paths do not import this library.

## Implementation contract

- Each workspace maps to one explicit organization UUID. A resource binds one
  cipher, exact HTTPS origin, destination, tenant, target account and version.
  Requests carry opaque destination IDs, never URLs with credentials or queries.
  New resources receive no grant by name, tag, folder or collection wildcard.
- Connections have distinct immutable IDs, sponsor, device, runtime, issuer and
  audience bindings, workspace eligibility and expiry. Runs do not identify a
  connection and child runs do not inherit grants. No authentication material is
  accepted or stored by this library.
- Operator **and** sponsor need explicit human broker-delegation scope for the
  same account/action. These records confer no native vault access or keys.
  Connection and task grants further narrow that scope. Native sharing remains
  with Vaultwarden and the identity owner; hidden passwords remain credential
  sharing, not cryptographic use-only access.
- `account.discover`, `login.use` and `app.read` are separate exact actions.
  Writes, sends, deletion, billing and security require a designated human's
  fresh approval. `secret.reveal/edit/rotate`, export and access management are
  unsupported. A caller cannot register or enlarge policy through a request.
- Approval binds the entire validated request and authenticated caller: request,
  run, grant, workspace/resource/destination/tenant/account, action, operation,
  opaque payload reference, all versions and deadline. Approval lasts at most
  120 seconds and cannot outlive the task/grant. It is consumed atomically with
  the reservation and decision audit. Passing an approval for another action
  does not confer that action. The approver is an explicit workspace-configured
  human authority; an operator/sponsor cannot approve by claiming that role.
- `payload_ref` must eventually resolve to immutable, broker-held reviewed
  content. This slice never stores/resolves payloads. Reference binding alone
  does **not** prove payload integrity or approval of a real mutation. Future
  integration must protect the mapping, use keyed integrity where appropriate,
  and execute exactly those bytes/target through a narrow reviewed adapter.
- Server time controls validity. Leases last at most 300 seconds and are capped
  by request, grant, connection and contributing human scope expiry. Rechecks
  consult current revocations; leases never authorize bypassing a boundary.
  A backwards/invalid clock fails closed. The proposed lifetime caps are
  conservative fixture semantics, not approved live operational defaults.
- SQLite `BEGIN IMMEDIATE` serializes approval consumption, operation recording,
  revocation and audit updates across store instances. A request ID is unique;
  changed material under the same ID is a conflict. Retried requests never yield
  a second execution permission, including after an unknown outcome. Outcomes
  are `completed_fixture`, `failed_fixture` or `unknown_fixture`; unknown stays
  closed pending reconciliation. No external exactly-once execution is claimed.
- A workspace owner can revoke local policy targets. Global person/connection
  revocation spanning workspaces requires the same owner across affected scopes;
  otherwise it fails closed pending a reviewed multi-owner workflow. There is
  no restore API. A revoked approver also blocks affected grants.
- Policy is immutable and fingerprinted into the store. A changed configuration
  cannot open the same store and silently retain approvals. Future policy
  migration needs a reviewed path preserving revocation/audit and invalidating
  approvals. Starting a new store must never be used to bypass revocation.
- Audit contains fixed event/reason enums, opaque IDs, versions, times, local
  outcomes and cleanup status. Unknown action text is replaced with
  `unsupported`; arbitrary labels, URLs and payloads are not logged. Required
  audit failure rolls back the transaction and yields no reservation.
  Application SQL triggers prevent updates/deletes to audit rows. This is **not**
  tamper resistance against the database/process owner or an external durable
  audit sink. Reader authorization, protected copies and retention remain future
  work; `audit_records()` is trusted-host diagnostics only.

`PolicyStore.authorize()` always returns `denied/integration_unavailable`, even
with a fixture approval/capability. `approve_fixture`, `reserve_fixture`,
`recheck_fixture` and `finish_fixture` rehearse policy; they are not broker
interfaces and must never be used to unlock or execute. A declared
`FixtureCapability` is never accepted as proof of a real runtime restriction.

These Python methods are a trusted-host library, not an authenticated endpoint.
`Caller`, human approver IDs and immutable policy must eventually come from
verified host-side identity/authorization, not model input or browser content.
Merely constructing a `Caller` or supplying an owner's UUID proves nothing.
Do not expose these methods as agent tools. A compromised same-privilege host can
alter the policy/database; a separate restricted execution boundary is required.
No production store or service is created in this implementation.

## Architecture and ownership evidence

T3 binding and shell both verified this selected worktree/branch and the existing
`OsirisMedici/vault` origin. Computer name was `raven`; shell hostname was
`pranshis-MacBook-Air.local`. No alternative checkout was created.

The actual worktree started with server/web submodules uninitialized, and
`upstream/desktop` at pre-existing `18d6d9f10c32ee8b76ee60355afcbd53ab2677a6`
with local modifications rather than its lock pin. That state was preserved;
this is not a clean-upstream or desktop-build acceptance claim. The durable
root's server checkout was clean at the lock's
`7c188967e7a467b19b2757bc3326f9cf3ccae327` and was read only to confirm
collection checks require confirmed membership, while owner/admin/access-all can
broaden native sharing (`src/db/models/collection.rs`, `organization.rs`).
README, project instructions, desktop contract, lock, licenses and Dockerfile
confirm a branding overlay, not an existing permissions service. The added
original Python source remains GPL-3.0-only; no upstream code was copied/edited.

The identity owner's existing proposal remains authoritative for issuer,
invitation and account-link decisions. No identity work was duplicated.
Karen's protected integration and private data were not inspected or changed.
This library defines no live adapter contract for that integration. Owner
coordination through Osiris/the owning task is required before such work.
The signed official Bitwarden app, profiles and Keychain were not accessed.

## Verification and pending acceptance

28 isolated tests passed, including eight concurrent attempts producing exactly
one reservation; altered request/caller/payload/version denial; action separation;
exact approver and expiry checks; independent connection access; each revocation
layer and in-flight rechecks; sponsor/operator intersection; restart persistence;
clock failure; unsupported runtimes; unknown outcome/replay; append-only SQL
guards; and injected audit failure rolling back approval and operation state.
Resource warnings are treated as errors. The fixture runner separately produced
the behavior listed above. These checks exercise the real local policy code,
not a real vault, authentication flow or browser broker.

Pending before any live connection:

1. Osiris resolves owner/approver authority, identity issuer, workspace boundary,
   custody/recovery and operational lifetime decisions with the existing owners.
2. Identity integration proves persons/connections and fresh human approval;
   imports current eligibility/revocation from authoritative sources; protects
   the store; and supplies reviewed policy migration, audit access and retention.
3. The protected integration owner reviews a narrow execution boundary that
   validates actual target tenant/account, presence/unlock and immutable payload,
   prevents arbitrary browser/process/profile access, filters results/errors, and
   supports independently verified action restrictions. Unsupported modes deny.
4. Execution couples pre-side-effect revalidation to the actual target adapter,
   external audit acknowledgement, idempotency and outcome reconciliation.
   Measure revocation latency; separately confirm broker stop, native access,
   target sessions and credential/key rotation requirements. No local test proves
   a 60-second propagation target or recalls previously disclosed credentials.
5. Separately authorize isolated connected rehearsal and human/product acceptance.
   Any future UI needs real screenshots; a private preview must follow the shared
   Tailscale rule. No preview/deployment authorization follows from source work.

Original brief SHA-256 receipts (unchanged after implementation):

```text
48ad9b0c5498e97ee40b0be0a143080af85734f67051e4a94eafe191b8e9d722  team-agent-access.md
e6229dd685de7398b1e31447167b8bb19f7dd12c2fca8bd6d4ef6192bff31043  team-identity.md
```
