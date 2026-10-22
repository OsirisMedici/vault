# Vault team identity

Status: planning only, 22 October 2026. No invitation, account, permission,
credential, authentication configuration or deployment was changed.

## 1. What we are building

Give Osiris and invited colleagues a reliable identity for Vault, while keeping
Vaultwarden responsible for vault accounts, organization membership and encrypted
sharing. Better Auth can prove who a person is; it must never receive their vault
master password or plaintext keys.

**The evidence does not establish one existing shared Better Auth service.**
Feedback and Canvas each embed Better Auth with separate sessions and access
rules. Both live health endpoints pass. Their inspected source does not expose
an OIDC provider. Crayon has its own Penpot-derived authentication. Reusing the
existing identity infrastructure therefore requires a deliberate integration,
not pointing Vault at an already demonstrated central login service.

The owner's registered business identity is **not yet verified**. Raven lacks the
documented VPS SSH connection and trusted host entry. No address from dictation,
Git authorship, mail-sender settings or another account has been substituted.
The plan is complete as a proposal; identity discovery and runtime configuration
inspection remain prerequisites to implementation.

## 2. Why

People should use their individually approved business identity and receive only
the shared credentials they need. Osiris needs explicit control over invitations,
ownership, removal and recovery. A familiar email-code login can reduce account
friction, but it cannot replace the cryptographic unlock step or confer team
access by itself.

Success means the verified owner returns to the same existing Vaultwarden UUID
and encrypted data; an invitee joins only the intended organization and
collections; a wrong account cannot claim an invitation; removal prevents future
authorized server access; and supported clients still unlock and sync correctly.

## 3. Finished experience

1. Osiris opens Vault and selects business sign-in. A verified identity service
   authenticates him, then returns him to the existing Vaultwarden account.
2. The client separately asks to unlock encrypted data using its supported
   master-password or previously enrolled local unlock method. An identity login
   alone shows no decrypted secrets.
3. Osiris invites an exact address to a specific workspace, role and collection
   set. The recipient proves that address, signs into or explicitly links their
   own Vaultwarden account, and accepts the invitation.
4. Sharing remains pending until the normal Vaultwarden confirmation/key-sharing
   step completes. An authorized unlocked client supplies the encrypted
   organization key for that recipient. Only then does granted shared content
   become usable after sync and unlock.
5. Lock, sign out of Vault, and sign out of business identity have distinct
   meanings. The interface must explain whether another visit can silently
   authenticate through a still-active identity session.

This is a target journey, not current or tested Vault behavior.

## 4. Included and excluded scope

Included in this proposal: owner binding, verified-email reconciliation,
invitations, identity/account links, workspace roles, sessions, logout,
offboarding, migration and acceptance gates.

Excluded from this task: implementation, email sends, account creation/linking,
membership changes, credential rotation, VPS changes, provider/client
registration, new DNS, toolchain installation and installed-app replacement.
No browser profiles, sessions, vault data or T3 state are copied between Macs.

The current Vault product is a branding layer over Vaultwarden, with a separate
desktop source candidate. A new membership control plane would be additional
product/backend work. Do not treat a theme change or reverse-proxy login gate as
an authentication integration. Karen's protected browser-login integration stays
with its owner.

## 5. Verified starting point and evidence limits

### This workspace

- Actual cwd: `/Users/pranshisharma/Desktop/Code Project/Vault`; macOS computer
  name `raven`, shell hostname `pranshis-MacBook-Air.local`, user
  `pranshisharma`. T3 reports environment
  `be63732a-3c93-440f-972a-9bb58559daf2`, label `raven`, Darwin arm64.
- Registered project `mcp:c40d6377-2cc6-489e-8f61-e98f2c2b9b7f` resolves to this
  checkout and `OsirisMedici/vault`.
- `main` started clean at `1b7e6b14cc704c7622ce2c2edab8e86a3fb765fe`.
  `git ls-remote origin refs/heads/main` returned the same commit.
- All three initialized upstreams match `upstream.lock.json` and have no local
  changes: server `7c188967e7a467b19b2757bc3326f9cf3ccae327` (1.37.4), web
  `d2a095eb800fe80a9bc524579b974796eae51994` (2026.7.0), desktop
  `b449ac1d255784380d75ef026343198891286be7` (desktop 2026.10.0).
- Read `AGENTS.md`, `docs/desktop.md`, `docs/operations.md`, `README.md`,
  `NOTICE.md`, the lock file and relevant pinned authentication/sharing source.
  No build or app launch was necessary.

### Which identity implementations exist

| Application | Inspected implementation/configuration | Live evidence on 22 October | Conclusion |
| --- | --- | --- | --- |
| Feedback | `createFeedbackAuth` embeds Better Auth 1.7.7 in the Next app. Drizzle/PostgreSQL adapter, Feedback tables, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `feedback` cookie prefix, one trusted origin. Email OTP and a Feedback-specific desktop exchange plugin. No OAuth provider plugin in the inspected factory. | At approximately 12:22 UTC, `GET https://feedback.scaleadvertisement.com/api/auth/health` returned 200 with `healthy: true`, `provider: better-auth`, `database: true`, `emailConfigured: true`. | A live application using Better Auth; no demonstrated shared OIDC issuer. |
| Canvas Cloud | `createCanvasAuth` embeds Better Auth 1.7.7 using its own PostgreSQL auth tables, `CANVAS_AUTH_SECRET`, `CANVAS_PUBLIC_ORIGIN`, `canvas` cookie prefix and one trusted origin. Local-desktop mode excludes Cloud authentication. | `GET https://canvas.scaleadvertisement.com/api/public/health` returned 200 with `ok: true` and authentication `ok`, `configuration`, `schema`, `identities` all true. | A second application with independent Better Auth identity/session storage. |
| Crayon | `docs/technical-guide/developer/crayon-authentication.md` explicitly documents Penpot-derived Clojure/PostgreSQL authentication, password/email verification and its own sessions. `backend/src/app/auth.clj` implements Argon2id; RPC source implements password login and logout. Documentation says social/OIDC/LDAP are disabled in that deployment. | No private VPS runtime inspection or human login in this task. | Do not list Crayon as a Better Auth consumer. Current deployment flags are documentation evidence, not fresh runtime proof. |
| Vault | Branding overlay preserves upstream authentication. Pinned Vaultwarden source contains an OIDC relying party; it is not Better Auth. | No live Vault configuration or account directory was read. | OIDC capability exists in source; current enablement, issuer and account links are unknown. |

Both tested paths
`https://feedback.scaleadvertisement.com/api/auth/.well-known/openid-configuration`
and `https://canvas.scaleadvertisement.com/api/auth/.well-known/openid-configuration`
returned 404. Their route handlers also allow only selected application auth
endpoints, excluding provider discovery/authorization/token endpoints. This
corroborates the inspected design; it does not rule out an undiscovered issuer
at another origin or path.

Feedback and Canvas source both use six-digit, five-minute, hashed OTPs with
bounded attempts, disabled automatic signup/password login, database rate
limits, seven-day sessions and one-day refresh age. Both disable cookie caching
and check application eligibility. Canvas binds the eligible ID back to the
session ID. Their authorization remains application-specific. These are source
facts, not a fresh test of every runtime setting or actual email delivery.

Source snapshots inspected under sibling `Code Project` directories:

- Feedback `current`, HEAD `d516484403e0bf95ddb8385c204e324280c03ccd`;
  three local change entries existed and were preserved. Observations refer to
  inspected working files, not a claim of a pristine release snapshot.
- Canvas `current`, clean HEAD `eaebf0917bda70c7f6c4599a202433aa359779aa`.
- Crayon, clean HEAD `5fc1a0ccc1332ac661997a29b284e4baa5e84f3c`.

Relevant files are Feedback `src/lib/better-auth-factory.ts`, `better-auth.ts`,
`auth-eligibility.ts`, `src/app/api/auth/[...all]/route.ts`,
`src/app/api/auth/health/route.ts`, `src/db/schema.ts`, and
`docs/BETTER-AUTH-MIGRATION.md`; Canvas `src/lib/canvas-auth-factory.ts`,
`canvas-auth.ts`, `canvas-auth-eligibility.ts`, `canvas-auth-readiness.ts`,
`src/app/api/auth/[...all]/route.ts`, `scripts/canvas-auth-identity-seed.mjs`, and
`docs/changes/2026-10-17-canvas-better-auth-progress.md`.

The migration reports describe prior VPS deployments and owner acceptance.
They are historical evidence, not proof of today's container revision, complete
consumer inventory or the owner's current registered address. Shared Resend
delivery infrastructure does not imply shared authentication.

### Exact access gap

Purpose-built tool discovery found no available VPS shell/configuration tool.
The documented read-only SSH route is `hostinger-osiris` to the shared VPS,
using a credential on the other Mac. On Raven:

- The alias attempt returned `Could not resolve hostname hostinger-osiris:
  nodename nor servname provided, or not known`.
- A bounded canonical-host attempt with `BatchMode=yes`,
  `StrictHostKeyChecking=yes` and `IdentitiesOnly=yes` returned
  `No ED25519 host key is known for srv2000533.hstgr.cloud and you have requested
  strict checking.` followed by `Host key verification failed.`
- Neither resolved IP had an existing trust entry. No trust entry, credential,
  SSH configuration or access policy was added or copied. Authentication to the
  VPS was not reached; this does not prove the local credential would work.

Consequently, actual Compose/proxy/environment configuration, running source and
package versions, identity database records, registered clients, other consumers,
Vault's current SSO settings and the owner's registered business identity remain
unverified. Public health is useful corroboration, not a substitute for those
reads. Resume this bounded inspection through an already authorized trusted
operator/tool; do not weaken host verification to finish it.

## 6. Integration options and recommendation

| Option | How Vault would use Better Auth | Implications |
| --- | --- | --- |
| A. Make an existing app instance an OIDC issuer | After selecting the actual authoritative instance, add a compatible provider implementation and register Vaultwarden as a confidential OIDC client. Vaultwarden uses discovery, authorization code/PKCE, token and UserInfo endpoints. | Most direct reuse of a running instance, but changes that application's security boundary. Feedback eligibility currently depends on Feedback memberships/invites; Canvas eligibility depends on Canvas owners/members. Neither policy should automatically grant or deny business identity for every product. Requires that app owner's coordination and regression acceptance. |
| B. Dedicated shared Better Auth issuer | Reuse the existing OTP, delivery and operational pattern in an isolated identity service, then connect Vaultwarden by OIDC. Migrate other apps separately if approved. | Cleaner ownership, lifecycle and consumer isolation; this would be a new shared service, not an existing verified one. Requires separate deployment approval, identity reconciliation and operations ownership. Existing Feedback/Canvas sessions remain separate until an explicit migration. |
| C. Vault-only identity/control layer | A separate Better Auth instance authenticates a future Vault team/settings portal; the vault keeps its existing account login. | Lower coupling, but two sign-ins and a new portal/backend. Portal login cannot be exchanged for a Vaultwarden vault session or unlock key. A second roster creates reconciliation work. Useful only if Osiris wants that portal independently of SSO. |
| D. Keep current vault login | Use native Vaultwarden account invitations, organizations and collections while deferring Better Auth integration. | Fastest route to encrypted team sharing. No shared business login. This is a valid staged product decision, not completion of Better Auth SSO. |

**Recommendation:** choose OIDC as the integration boundary, retain native
Vaultwarden sharing, and defer any production choice until the issuer/owner
inventory is verified. Use A only if Osiris explicitly chooses an existing app
as the business identity authority and accepts the impact on its users. For a
long-lived identity spanning products, prefer B over silently promoting Feedback
or Canvas to that role. Do not change Canvas's prior separate-session product
decision as a side effect of Vault work.

Better Auth's current [OAuth provider documentation](https://better-auth.com/docs/plugins/oauth-provider)
describes an optional provider plugin, OIDC discovery, ID tokens, UserInfo and
refresh support. That is a possible implementation route, not a capability
installed in these factories. Select and audit a version compatible with the
actual running package; review its schema additions and discovery routing.

For A or B, the contract must include a stable HTTPS issuer, stable nonrecycled
subject, verified email, discoverable signing keys, code flow with PKCE, exact
redirect allowlists, supported confidential-client authentication and explicit
Vault eligibility. Disable public/dynamic client registration unless separately
needed. Use a Vaultwarden-specific client and narrowly scoped credentials;
never share app cookie secrets, session tables or a parent-domain cookie.

Pinned Vaultwarden `src/sso_client.rs` supports `client_secret_basic` or
`client_secret_post` and requires token and UserInfo URLs. `openid` is implicit;
request `email profile` and decide whether `offline_access` is required. Test
the exact provider/client combination rather than assuming generic OAuth means
compatible OIDC. Callback is derived from Vault's configured domain as
`/identity/connect/oidc-signin`. Do not invent a production domain in this plan.

## 7. Identity, invitations and workspace design

### Establish the owner before granting anything

The owner is an immutable, explicitly approved person binding, not whoever first
signs in, whoever has a matching display name, or whoever controls a domain.

A trusted read-only inventory must resolve:

1. The running identity instance(s), configured owner IDs and application owner
   records. In Canvas, follow `CANVAS_CLOUD_OWNER_USER_IDS` through
   `canvas_auth_owners` to `canvas_auth_users`; verify enabled status and
   `emailVerified`. In Feedback, follow the intended `workspaces.owner_id` to
   `users`, checking `email_verified`, login-disabled state and membership.
2. The exact registered primary address and whether it is the business identity
   Osiris intends. If apps disagree, retain each ID and report the conflict;
   matching names or email history are insufficient to merge people.
3. The existing Vaultwarden user UUID, verified address/status, existing
   organization owner memberships and any `sso_users` binding. Never select
   password hashes, tokens, verification codes, encrypted key fields or items.
4. A private comparison of normalized addresses and owner bindings. Return only
   agreement/conflict/verification results to the public plan; keep addresses,
   IDs and any minimal reconciliation record in protected operator storage.

Do not run seed/migration scripts for discovery: the Canvas seed script writes
accounts and marks some imported identities verified. Instead use read-only
transactions and allowlisted columns. Inspect Compose/container configuration
with an allowlist too: do not dump full environments, `docker inspect`, database
URLs, Caddy credentials or private files into output. A minimal runtime report
should show image/source, package version, auth mode, issuer, enabled plugins,
consumer count, cookie scope and secret-present booleans only. Compare registered
clients with routes and each application's consumer configuration before claiming
the inventory is exhaustive.

Owner bootstrap then binds the verified identity subject to the existing Vault
workspace owner and Vaultwarden UUID through a separately approved action.
Business owner, identity-service administrator, VPS administrator and
Vaultwarden organization owner are distinct roles. Preserve at least one
confirmed organization owner; choose an independent emergency recovery owner
only with Osiris's approval. Do not promote a mailbox or domain automatically.

### Verified-email matching and account linking

Use `(issuer, subject)` as the durable identity link; email is a verified
reconciliation attribute and invitation destination. Normalize with the same
trim/lowercase policy as the selected implementation, check normalized duplicates,
and do not strip plus tags or Gmail dots, expand aliases, or infer equivalence
between business and personal mailboxes.

Require an explicit verified-email claim from a trusted issuer. Missing, false,
duplicate, disabled, conflicting or reassigned identities require review. Email
proof does not prove permission or legal ownership of a business. Reassignment
of a business mailbox must not inherit the previous person's vault identity.

There are two different linking operations:

- Linking login methods inside Better Auth: initially avoid optional social or
  password methods. Any later link requires a fresh authenticated session and
  proof of the additional identity; no implicit merge of existing people merely
  because email strings match. Review the selected version's account-linking
  settings against [Better Auth's account model](https://better-auth.com/docs/concepts/users-accounts).
- Linking the issuer to Vaultwarden: pinned source stores the issuer/subject
  identifier in `sso_users` against the existing Vaultwarden UUID. Its first-login
  path can associate an existing account by email; this is controlled by
  `SSO_SIGNUPS_MATCH_EMAIL` and verified-email checks. It is separate from
  Better Auth's own account-linking feature.

Use `SSO_ALLOW_UNKNOWN_EMAIL_VERIFICATION=false` and `SSO_DEBUG_TOKENS=false`.
Keep broad SSO signup disabled. Do not assume closed ordinary registration
closes SSO: pinned `SSO_SIGNUPS_ALLOWED` defaults to true, and invitation/domain
exceptions require rehearsal. `SSO_SIGNUPS_MATCH_EMAIL` also defaults to true.

Preferred existing-account path: private reconciliation plus the user's fresh
proof of their existing Vaultwarden account and issuer identity. Stock source
does not demonstrate a dual-proof account-linking screen. If relying on stock
email association, Osiris must explicitly accept that trust model, restrict the
issuer's rollout audience to reconciled identities, rehearse matching/conflict
cases, and verify the resulting UUID/link before expanding access. Setting the
flag false blocks association to initialized non-SSO accounts; it is not an
alternative manual linking UI. Do not directly edit production SSO rows as an
unreviewed shortcut.

After binding, preserve the subject and Vaultwarden UUID across email changes.
Vaultwarden's account email participates in its key handling; use its supported
account email-change flow, not a background database update from the IdP.
Changing issuer URL or subject format is another account-link migration.

### Invitations and membership

Default workspace model: one Vault workspace maps to one explicit Vaultwarden
organization UUID; collections hold the approved shared credential sets.
Vaultwarden remains the authority for organization roles and collection grants.
Better Auth proves identity; it does not silently copy Feedback/Canvas/Crayon
roles or grant access based on a business domain.

Use native Vaultwarden membership as the first implementation. Map owner/admin/
member to explicitly reviewed Vaultwarden roles; do not equate a portal admin
with an organization owner. A directory-level role can be a desired assignment,
but effective access is the current confirmed Vaultwarden membership and its
collection permissions. New collections, personal vaults and other organizations
are outside an invitation's grant.

If a later portal coordinates both systems, model these states separately:

`invited -> identity proven -> account linked -> organization accepted -> key confirmed -> active`

Also represent expired, revoked, failed and removed states. A pending invitation
must not become active during migration or because a code was delivered. Bind it
to the exact email, workspace UUID, role, grants, inviter and expiry. Use an
opaque high-entropy, hashed, single-use token for any new portal invite and a
transactional acceptance check. Preserve the native Vaultwarden invitation
protocol; do not replace its signed token with an incompatible portal token.
Opening a link with GET must not accept it.

At acceptance, recheck inviter authority, invitation expiry/revocation, verified
recipient identity and workspace scope. Reject the wrong signed-in address and
conflicting links; allow account switching without claiming the invite. Handle
concurrent acceptance once. A staged provisioning action must be idempotent,
reconcilable and show a partial failure instead of claiming active membership.
Do not silently reissue or grant permissions after a retry.

Before confirmation, the authorized client must validate the intended recipient
and use the supported recipient-key verification flow where available. A service
must not auto-confirm by decrypting or escrowing the organization key.

## 8. Vaultwarden accounts and encrypted sharing

Identity authentication establishes a server session. Vault unlock derives or
retrieves the local key material that decrypts the account's encrypted keys and
items. An email code, OIDC ID/access token or Better Auth session cannot do that.
SSO also does not implement fingerprint-only agent unlock.

Keep each person's existing Vaultwarden account and encrypted key hierarchy.
For a new person, native account initialization still creates their cryptographic
identity and requires its own approved enrollment. Do not reuse an OTP, business
password, session secret or machine credential as a vault master password.

Encrypted sharing uses the organization key and per-recipient encrypted key
material. In the pinned client,
`libs/admin-console/src/common/organization-user/services/default-organization-user.service.ts`
encapsulates the organization key with the recipient public key when building a
confirmation request. The pinned server's
`src/api/core/organizations.rs` validates invitation ownership and transitions
an accepted member to confirmed with the encrypted `key`/membership `akey`.
Better Auth neither supplies that key nor substitutes for confirmation.

Use organizations/collections for team credentials. Moving a personal item into
an organization changes ownership and must be a separately approved user action.
Never migrate by exporting plaintext, copying a profile or sharing the owner's
master password. Ordinary encrypted backups also remain outside this repository.

Revoking membership stops future authorized access; it cannot erase secrets
already decrypted, copied or held by an offline client. Offboarding may require
rotation of shared credentials and review of key-rotation/reconfirmation options.
An IdP password reset or new email code cannot recover a forgotten vault master
password. Recovery/escrow policies alter security and need an explicit decision;
keep an independent recovery path that does not depend on a secret locked inside
the same unavailable vault.

## 9. Sessions, logout and migration

### Session policy

| Action | Required result | Limit |
| --- | --- | --- |
| Lock vault | Client removes/guards decrypted keys and content according to supported client behavior. | Identity and server sessions may remain. |
| Sign out of Vault | Native client clears its account session and local sensitive state; verify server/device token behavior. A future portal clears only its own session too. | Does not imply Feedback, Canvas or issuer logout. |
| Sign out of business identity | Issuer invalidates the intended identity session and cookie; revoke refresh grants as designed. | Does not itself clear decrypted data in open or offline vault clients. |
| Sign out everywhere / suspend | Explicit orchestration revokes applicable issuer sessions/grants, Vaultwarden devices/sessions and membership access; records failures for reconciliation. | Cannot retract previously disclosed secrets or guarantee immediate offline erasure. |

Keep cookies host-scoped, Secure and HttpOnly with explicit SameSite/CSRF/origin
checks. Preserve separate client sessions and validated same-origin return
destinations. Never place identity tokens in redirect query strings to a portal
or accept a browser-provided role as authority. Require recent authentication
for owner transfer, linking and sensitive membership administration; decide
whether owner identity needs phishing-resistant MFA beyond mailbox OTP.

Pinned Vaultwarden `src/sso.rs` supports two lifecycles:
`SSO_AUTH_ONLY_NOT_SESSION=false` uses upstream access/refresh behavior;
`true` issues native sessions after SSO authentication. Prefer evaluating the
coupled mode for offboarding, but measure actual revocation latency and provider
refresh behavior. Native mode needs separate revocation orchestration. Neither
mode proves immediate global logout. No end-to-end provider logout/back-channel
integration was demonstrated in this inspection.

Do not silently sign the user back in after a deliberate sign-out: offer account
selection/re-authentication where the accepted provider/client supports it, and
explain any issuer session that remains. Protected writes must fail closed after
access loss. A future portal may retain account-scoped unsent nonsecret drafts;
another account must never adopt them. Keep decrypted vault state within the
existing clients' security model.

### Migration implications

1. Finish the trusted runtime and owner inventory. Record actual image/source,
   issuer/clients, effective configuration overrides, current Vaultwarden users,
   SSO mappings and organization/collection grants using private minimal reads.
   Resolve duplicate emails, aliases, disabled accounts and conflicting owners.
2. Choose option, authoritative issuer, owner binding, workspace mapping and
   emergency-access policy. Review permissions/licenses: Vault original work is
   GPL-3.0-only, Vaultwarden AGPLv3, clients have their license map. Keep separately
   licensed `bitwarden_license` modules outside an assumed OSS implementation.
3. Prepare a reviewed candidate outside pinned clean upstreams. Keep identities
   stable. Additive provider/link schema must not accept invitations, mark
   unverified addresses verified or create synthetic activations. Any migration
   of Feedback/Canvas identity authority is a separate coordinated project.
4. In an isolated approved rehearsal, preserve and fingerprint account UUIDs,
   encrypted data, memberships, roles and grants. Rehearse encrypted backup
   restore and image/config rollback without overwriting later user writes.
   Do not transfer real vault data to Raven for this planning task.
5. Introduce SSO as optional initially, retaining the reviewed existing login
   and independent recovery route. `SSO_ONLY` is a later owner decision after
   acceptance. Check all signup gates rather than enabling public registration.
6. Validate clients before rollout. The current Vault desktop candidate
   deliberately excludes URL/SSO callbacks (`docs/desktop.md`); enabling them
   needs separate signed packaging/security and human acceptance. Do not infer
   support from server source or alter the accepted official Bitwarden install.
   Test each official client version independently too.
7. Roll out only to explicitly reconciled people after approval. Monitor
   authentication, mail budget, claim failures, partial provisioning and
   revocation lag without recording tokens or secrets. Keep other apps and
   shared-VPS services untouched.

Rollback includes provider configuration and identity links, not just the web
theme. A new SSO-only account may not have the previous login/recovery path;
document its enrollment before rollback. Preserve issuer keys, stable subjects
and session secrets through ordinary releases. Do not truncate all `sso_users`
or roll back a whole database to undo one failed association.

## 10. Decisions Osiris must make

| Decision | Proposed starting point | Required before implementation |
| --- | --- | --- |
| Existing instance or shared issuer? | OIDC boundary; A only with explicit app-owner agreement, B for durable cross-product identity. | Trusted runtime inventory and identified operator/maintenance owner. |
| Who is the owner? | Preserve the existing person, Vaultwarden UUID and organization ownership. | Privately discover the registered business address/verified subject, resolve app disagreements, then obtain Osiris's confirmation of the binding. No guessed address. |
| How broad is business identity? | Independent identity eligibility and explicit per-app grants. | Decide whether signing into one app should provide SSO elsewhere; existing Canvas/Feedback sessions currently remain separate. |
| How are existing accounts linked? | Fresh proof of both identities where supported. | Accept stock verified-email association with a restricted rollout, or approve the additional dual-proof linking work. |
| What is a workspace? | One explicit Vaultwarden organization, least-privilege collection grants. | Identify existing organization(s), intended team boundary and who may invite/confirm. |
| How strong is owner authentication? | Recent authentication for sensitive actions; consider phishing-resistant MFA. | Choose OTP-only versus stronger identity assurance and an independent emergency owner/recovery route. |
| What does logout/removal promise? | Separate lock, Vault sign-out and issuer sign-out; coordinated offboarding. | Choose session lifetimes, revocation target/latency, offline limits and rotation responsibility. |
| Which clients ship first? | Preserve accepted official app; web/client SSO must pass rehearsal. | Name supported clients; separately scope Vault desktop callbacks, signing and Touch ID acceptance. |
| Is a new team portal needed? | Native organization UI first. | Approve any extra backend/roster and its ongoing reconciliation work. |

These are product/security choices to review, not permission to execute them.

## 11. Testing and handoff

### Checks performed for this plan

Verified local host/project/Git identity, current remote SHA, clean pinned
upstreams, relevant auth and encryption-sharing source, sibling package/config
structure, two live public readiness endpoints and two 404 discovery paths.
Preserved existing local changes. SSH failed before trusted connection; no
private owner/account/session data, credentials or vault contents were read.
No login, OTP delivery, invitation, enrollment, unlock or deployment test ran.

### Exact acceptance steps for a later authorized implementation

1. On isolated approved test data, read discovery and confirm exact issuer,
   JWKS, signing algorithm, token/UserInfo endpoints, confidential-client auth,
   exact callback and code/PKCE validation. Reject wrong issuer/audience,
   expired/replayed codes, wrong state/nonce/verifier and hostile redirects.
2. Reconcile the owner privately, authenticate and link with the accepted proof
   policy. Verify the same Vaultwarden UUID and unchanged encrypted records,
   organization ownership and grants. Reject missing/false verified email,
   collisions, reused mailboxes and a second subject claiming the same account.
3. Confirm an identity login leaves the vault locked. Privately unlock using
   the supported client method and view only an approved harmless test item.
   A cancelled unlock must reveal nothing. Never put values or keys in logs.
4. Use synthetic members to test exact-address invitation, wrong account,
   expired/revoked/replayed/concurrent acceptance and partial failure. Before
   confirmation there must be no usable organization key; after approved client
   confirmation and unlock, only intended collections should sync.
5. Test owner/admin/member boundaries, cross-workspace denial, hidden items and
   collection read/write permissions through supported human and agent paths.
   Do not implement an agent-only privilege bypass or auto-confirmation path.
6. Test lock, Vault logout, identity logout, account switching, expiry, token
   refresh, all-session revocation and membership removal in an already-open
   client. Measure the actual revocation delay and record offline limitations.
7. Test mailbox change through supported flows, issuer outage, mail delivery
   failure, lost master password and emergency access. A successful identity
   reset must not be reported as vault-key recovery.
8. Verify each named browser/official client version and the exact signed Vault
   desktop candidate if included. Recheck official-app data/signature/Touch ID
   independently. Complete backup-restore and configuration/link rollback tests.
9. Only after separate authorization, have Osiris and one approved representative
   member perform private live sign-in, unlock, limited sharing, sync and logout.
   Record actual image/source, observed result and pending human acceptance.

Osiris can now review the integration boundary and decisions here. Implementation
is not authorized by this document. The first unresolved evidence gate is a
trusted read-only VPS/configuration and registered-owner inspection; the first
acceptance gate after implementation is unchanged account identity plus separate
successful authentication and cryptographic unlock.

### Primary references

- Local pinned source: `upstream/server/src/config.rs`, `src/api/identity.rs`,
  `src/sso.rs`, `src/sso_client.rs`, `src/db/models/user.rs` and
  `src/api/core/organizations.rs`; client organization confirmation source cited
  above. Paths following the first server path are relative to `upstream/server`.
- [Vaultwarden OIDC guide](https://github.com/dani-garcia/vaultwarden/wiki/Enabling-SSO-support-using-OpenId-Connect)
  corroborates the master-password boundary and stable identity linkage; pinned
  local source is the version-specific authority for this plan.
- [Better Auth OAuth provider](https://better-auth.com/docs/plugins/oauth-provider)
  and [users/accounts](https://better-auth.com/docs/concepts/users-accounts)
  are current design references, not proof of installed provider features.
