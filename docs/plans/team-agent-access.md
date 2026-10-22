# Vault access for people and AI connections

Status: **proposal, planning only — 22 October 2026**. Implementation is held
until Osiris supplies his refined plan and approves the resulting scope.
Nothing in this document grants access, enrolls a connection, authorizes a login,
or changes the active integration.

## 1. What we are building

Give Osiris a clear way to choose **who may use which workspace and saved
account, through which connection, for which actions, and for how long**.
People have individual identities. Every T3, Codex or other AI connection has
its own identity, sponsor and revocation control. A connection never becomes
Osiris merely because it runs on his Mac or uses a browser already signed in.

Use native Vaultwarden organizations and collections for encrypted sharing with
people. Propose a separate policy and broker boundary for delegated login use.
The broker would perform a narrowly approved operation without returning the
password to the model. That enforcement is future work, not an accepted feature.

The recommendation is one understandable sign-in and local unlock experience
for each person, with separate underlying identities and keys. Do not give
people or agents Osiris's master password, account encryption key or general
CLI unlock capability.

## 2. Why

Osiris should be able to give a colleague access to a client's working accounts
without exposing personal accounts, and let an agent perform an approved task
without giving it permanent access to the business. Removing one connection
should leave other people and connections working.

Success means an account outside a grant stays unavailable; an allowed login
does not silently authorize revealing its password or performing every action
inside the target app; approval names the exact operation; and expiry or
revocation stops new broker operations. The interface must also explain the
limits: a disclosed credential cannot be recalled, and a target application's
existing session may outlive a Vault grant.

## 3. Finished experience

1. Osiris opens a workspace's access page and selects a verified person or a
   distinct connection. Invitations and owner verification follow
   [team-identity.md](team-identity.md), not a second enrollment design here.
2. He selects existing account IDs, allowed destinations, actions, approvers and
   expiry. New accounts and collections do not silently join an existing grant.
3. The page states whether access means **shared credential access** through a
   native client, or **brokered use** through a controlled connection. It never
   describes native hidden passwords as a guarantee of non-disclosure.
4. An agent requests a named operation, for example reading a report from one
   client account. Vault shows the person sponsoring it, connection, workspace,
   destination and requested action. Only the scoped request can be approved.
5. A proposed broker verifies policy and performs the supported operation in an
   isolated runtime. The model receives an allowed result or a denial, never an
   unlock key, password, cookie or reusable session token.
6. Osiris can inspect grants, pending approvals, active leases and audit records,
   then revoke one connection or suspend a person and their delegated access.
   Any target-session cleanup still pending remains visible.

All six steps describe the proposed product, not current verified UI behavior.

## 4. Scope and coordination

Included: permission semantics, workspace/account boundaries, distinct connection
identities, approvals, auditing, expiry, revocation and product decisions.
Excluded: implementation, invitations, real grants, secrets, enrollment,
authentication tests, runtime probes, deployment and installed-app changes.

| Owner or source | Authority and coordination boundary |
| --- | --- |
| Osiris | Refines the product plan; decides trust, recovery and approval policy before building. His registered business identity remains unverified. |
| Existing identity planning task | Owns [team-identity.md](team-identity.md): owner discovery, Better Auth/OIDC choices, invitations, account linking, workspace membership and session migration. This plan references it and does not edit or repeat that work. |
| Karen's `infrastructure/vaultwarden/t3-agent-browser` context | Owns the protected browser-login integration according to Vault's `AGENTS.md`. `docs/desktop.md` also refers to its separate parent integration task. Its current owner/contact/thread and runtime completion are not verified here. |
| Vault desktop work | Owns the separate source candidate and its future signing/biometric acceptance. Preserve the official signed Bitwarden app, profile and Keychain enrollment. |

Planning coordination was sent to the existing identity task on 22 October;
its authorized handoff was incorporated here. The handoff confirms the boundary
above and supplies no verified protected-integration contact. That checkout is
not present at the documented path in Raven's shared Karen checkout. Its private
data was not inspected. **Direct integration-owner review remains pending via
Osiris/the owning task before any future changes.** Do not invent a contact or
launch replacement integration work to fill this gap.

The identity plan is an uncommitted local addition in the same durable Vault
checkout. Both proposals need reconciliation with Osiris's refined plan; neither
is a production configuration or an execution grant.

## 5. Inspected architecture and available capabilities

### Current Vault

Inspected checkout: `/Users/pranshisharma/Desktop/Code Project/Vault`, `main`
at `1b7e6b14cc704c7622ce2c2edab8e86a3fb765fe`.
The source and initialized submodules match `upstream.lock.json`:

- Vaultwarden server 1.37.4, `7c188967e7a467b19b2757bc3326f9cf3ccae327`.
- Compatible web client 2026.7.0, `d2a095eb800fe80a9bc524579b974796eae51994`.
- Desktop client source 2026.10.0, `b449ac1d255784380d75ef026343198891286be7`.

`README.md`, `AGENTS.md` and `docs/desktop.md` establish a display/branding
overlay on the existing password manager, plus a separate desktop source
candidate. Vault does not currently implement the proposed permission service.
The desktop candidate excludes SSO callbacks and has no separate signed/human
Touch ID acceptance. Another app's working Touch ID proves neither candidate
acceptance nor agent authorization.

The identity owner's handoff and `team-identity.md` establish these planning
constraints: Feedback and Canvas embed separate Better Auth 1.7.7 instances;
their readiness endpoints passed on 22 October, but no shared OIDC issuer is
verified. Crayon uses Penpot-derived authentication. Current private VPS
configuration, Vault SSO settings, full identity-consumer inventory and the
registered owner business identity remain unverified. This task did not repeat
that discovery or perform authentication tests.

### Native sharing: what can be reused

| Capability in pinned Vaultwarden source | Proposed use and limit |
| --- | --- |
| Organizations, memberships and invited/accepted/confirmed/revoked states | One Vault workspace maps to an explicit organization UUID, following the identity plan. Confirmation includes encrypted key delivery; identity proof alone is insufficient. |
| Collections and per-member `read_only`, `hide_passwords`, `manage` flags | Organize shared account sets and ordinary client permissions. A folder is personal organization, not an access boundary. Native account-level isolation may require a collection containing only the intended account. |
| Owner, Admin, User and Manager roles | Use User plus selected collections for ordinary members. Do not map proposed role names to native roles by label alone. Owner/Admin and `access_all` can bypass ordinary collection limits. |
| Group-based access | Optional future convenience, not the initial dependency. Pinned `org_groups_enabled` defaults off and is described as beta with known issues. Review effective direct and group grants before enabling. |
| Membership revoke/restore and server permission checks | Useful for future server access. Removal does not erase an offline client's decrypted data or target-site sessions. Restoration must require a new reviewed decision. |
| Organization event records | Useful corroborating history if enabled. Pinned `ORG_EVENTS_ENABLED` defaults false; deployed enablement/retention is unknown. Client-reported view/copy/autofill events are not complete broker evidence. |
| Custom-role compatibility mapping | Pinned source maps Custom to Manager and exposes only limited permissions. Do not promise the official Enterprise custom-role matrix or SCIM parity. |
| Secrets Manager | Pinned organization API explicitly says it is unsupported. A Password Manager API key is not a scoped machine-account replacement. |

Source anchors: `upstream/server/src/db/models/{organization,collection,cipher,group,event}.rs`,
`src/api/core/{organizations,events}.rs` and `src/config.rs` beneath the same
server root. `Membership.akey` holds encrypted membership key material; the
client confirmation flow wraps the organization key for the recipient, as
documented in `team-identity.md`.

Collection permissions are access controls, not independent cryptographic keys
for each collection. Sharing an organization key does not mean every member
receives every item from the server, but it means a collection must not be sold
as a separate cryptographic compartment. Use separate organizations where that
stronger business boundary is required; avoid duplicating credentials across
workspaces to simulate isolation.

Native hidden-password access still supplies a usable credential to the client.
Bitwarden's [collection permission guidance](https://bitwarden.com/help/collection-permissions/)
explicitly cautions that hiding values does not prevent their retrieval. Treat
such access as credential sharing, including its offboarding consequences.

### Product/identity options already available

These are alternatives for Osiris to assess, not purchases or migration plans:

| Option | Relevance |
| --- | --- |
| Existing Vaultwarden | Reuse organizations/collections for people; add proposed agent policy only after owner coordination. Its implemented features/configuration govern behavior, not official Bitwarden subscription labels. |
| Official Bitwarden Password Manager Teams | Published price is USD 4/user/month, billed annually; includes collection sharing, groups and audit features. |
| Official Bitwarden Password Manager Enterprise | Published price is USD 6/user/month, billed annually; adds SSO, policies and custom roles. This is a different server/product route, not an upgrade flag on Vaultwarden. |
| Official Bitwarden Secrets Manager | Separate product with machine identities and scoped project access; useful for programmatic secrets. It does not by itself enforce actions in a logged-in website or provide password-free browser delegation. |
| Future Better Auth issuer | Identity plan options: promote a chosen existing instance, create a dedicated issuer, use a Vault-only portal, or retain current login. No chosen shared issuer or paid identity subscription is verified. |

Prices/features checked against the [official business comparison](https://bitwarden.com/pricing/business/)
on 22 October 2026; taxes/terms may vary. [Machine-account documentation](https://bitwarden.com/help/machine-accounts/)
describes project permissions and access tokens. That is a design reference,
not a capability available in this Vaultwarden deployment. The
[Vaultwarden capability list](https://github.com/dani-garcia/vaultwarden/wiki)
also distinguishes supported sharing from configuration-dependent groups/logs.

Recommendation: retain Vaultwarden's native sharing as the current foundation.
Do not select a vendor migration just to obtain an agent identity, and do not
assume buying SSO solves unlock, approval or action enforcement.

## 6. What “one master key everywhere” can mean

| Meaning | Plain explanation | Recommendation |
| --- | --- | --- |
| One sign-in | A person proves the same business identity to each application through a future trusted issuer. Each app still decides access. | Reasonable goal. Keep stable subject links and separate app sessions; issuer selection remains in the identity plan. |
| One unlock experience | A person uses a familiar local gesture, such as Touch ID, to unlock their enrolled client or approved broker on that device. Distinct keys can sit behind that experience. | Reasonable UX goal, subject to platform and signing acceptance. Unlock is not approval for every task. Enrollment is separate on each device/runtime. |
| One shared encryption key | Every person or agent receives the same key capable of decrypting Osiris's data. A copied key cannot be selectively recalled. | Reject as the default. Separate identities, per-person keys and explicitly shared organization key material provide a better boundary. |

Proposed wording: **“Use your business sign-in; unlock locally when needed;
share only the approved workspace accounts.”** Avoid calling this one universal
master key. Osiris's personal master password and account key stay private.
People unlock their own accounts and receive only the supported encrypted
sharing material. A business sign-in token is not a vault decryption key.

Two broker custody options must remain explicit:

1. **Owner-device broker:** Osiris privately unlocks an enrolled local broker.
   It can act only while its permitted key access and policy are valid. It
   remains a trusted component with access to whatever that underlying account
   can decrypt. A sealed CLI unlock key is not the master password, but still
   carries substantial authority and must never be handed to agents.
2. **Dedicated broker account per isolated boundary:** an independently enrolled
   broker account receives selected organization/collection access with its own
   key custody. This reduces dependence on Osiris's personal account, while
   adding enrollment, recovery and operations work. Native collections remain
   server access controls; separate organizations may be needed for stronger
   separation. This is not an accepted implementation in the current repo.

Neither option assumes the AI receives a decryption key. The broker decrypts
only inside its trusted execution boundary; the vault server continues storing
encrypted data. A cloud broker would become an additional trusted key holder
and needs a separate explicit decision. No silent key escrow or claim that
Better Auth can recover keys is allowed.

## 7. Proposed identities and resources

**Person:** stable verified subject linked to their Vaultwarden UUID through the
identity plan. Display name/email may change without replacing the subject.
Business owner, identity administrator, VPS administrator and organization owner
are distinct authorities.

**Connection:** immutable connection ID plus sponsor person, installation/runtime,
host/device binding, permitted workspace set, issuer/audience and lifecycle.
Examples are `t3-raven-client-reporting` and `codex-osiris-vault-maintenance`;
these are illustrative labels, not real registered identities. Two installations
or separate trust boundaries get different IDs and authentication material even
if both display “Codex.” A thread/run is an execution ID under that connection,
not the credential identifying the connection.

Every connection must have separately rotatable authentication material stored
outside source, model context and transcripts. Prefer non-exportable device keys
and proof-of-possession where the actual connector supports them. Any bearer
fallback needs short lifetimes, audience binding and explicit risk review.
Reinstalling/replacing a connection creates a new identity; names cannot claim
old grants. No shared “AI user” token, cloned browser profile or shared mailbox
serves as connection identity.

**Resources:** explicit workspace UUID → organization UUID; account reference →
cipher UUID; collection set and membership version; exact approved HTTPS origin
and target-app tenant/account ID; controlled runtime/profile ID. Friendly names
are presentation only. The broker privately checks the actual signed-in target
account before acting; uncertainty or an account switch stops execution.

**Grant:** principal, sponsor/delegator, connection where applicable, resource
IDs, actions, allowed destinations, constraints, approver, reason, start/end,
policy version and status. No wildcard workspace/account access by default.
Adding an item, moving it to another workspace or changing destination requires
review rather than expanding a grant by name or tag.

Human native sharing grants and broker grants are different records. A
broker-only user need not receive the native cipher or organization key at all.
Do not enroll that user into a collection and then promise non-disclosure.
Deactivation of a sponsor suspends their connections unless Osiris explicitly
assigns a new responsible sponsor through review.

## 8. Proposed permission rules

### Actions and approval

| Permission | Allows | Default approval requirement |
| --- | --- | --- |
| `account.discover` | Approved nonsecret labels and availability for selected resources. No bulk vault inventory, private notes or hidden fields. | Explicit initial scoped grant. |
| `login.use` | Broker signs into the exact approved destination/account and returns an opaque run-bound handle or allowed task result. | Owner-issued task grant; human presence/unlock as required by broker policy. It does not authorize general app actions. |
| `app.read` | Named, enforceable read operations with bounded output. | Within the approved task scope and lifetime. App-side read role or constrained execution must make the claim enforceable. |
| `app.write` | Exact supported mutation, such as saving one draft. | Fresh approval of the concrete target and payload unless Osiris explicitly preapproves a narrowly bounded routine. |
| `app.send`, `app.delete`, `app.billing`, `app.security` | Sending/publishing, destructive actions, spending or account/security changes. | Separate fresh approval by the designated human authority; denied by default. Security changes may require Osiris specifically. |
| `secret.reveal` | Disclose a selected password/field to a specifically authorized human channel. | Separate fresh authentication and explicit owner approval. Denied to AI connections by default. Approval to use never implies reveal. |
| `secret.edit` / `secret.rotate` | Change the saved credential and, where supported, the target credential. | Exact operation approval and coordinated recovery/rollback plan; never implicit from app write. |
| `access.manage` | Propose or change scoped grants under an explicit administrative delegation. | Owner approval for enlargement, delegation or new connections. No self-approval. |
| Export, MFA seeds/recovery codes, key custody, ownership transfer | High-impact access outside normal login use. | Denied to agents; separately reviewed human workflow. No bulk export capability in an agent grant. |

Native clients do not enforce this proposed action matrix. Their collection
permissions control vault access/editing; target-app permissions control what a
logged-in account can do. A read-only vault collection does **not** make the
website account read-only. Prefer a distinct target-app user/service account
with the minimum target role, and narrow official APIs when available.

### Effective authorization

For each request the future policy service evaluates:

`active person/sponsor AND active connection AND current workspace/account grant
AND permitted action/destination AND valid approval AND valid time/runtime`

If acting on behalf of a person, access is the intersection of that person's
delegable authority, the connection's grant and the task's narrower scope.
An owner may explicitly delegate broker use without giving the operator direct
native credential access. That delegation is a separate grant, not a role
inheritance. Membership alone supplies no agent grant.

Rules:

- Deny by default. Explicit suspension/denial overrides allow; broader native
  group permissions must not defeat a broker restriction. Show actual native
  access separately if it is broader and warn that it permits another route.
- Agents cannot approve, extend or mint their own privileges, enroll another
  agent, impersonate their sponsor or change trusted destinations.
- A T3 child agent, new Codex session, scheduled job or remote Mac does not
  inherit credentials. A separately authorized child identity/task can receive
  an attenuated grant only; never pass a parent's reusable credential.
- Validate identity, membership and revocation at each sensitive boundary,
  including just before a side effect. Do not trust client-supplied roles,
  workspace paths, a claimed model name or a screenshot of an approval.
- Bind approval to request ID, principal, connection/run, resource and tenant,
  action, payload digest, policy/resource version and deadline. Changing any
  material field invalidates it. Consume a single-use approval atomically;
  retries use an idempotency key and do not repeat a completed side effect.
- Approval occurs in a trusted human surface. Page text, tool output, email or
  prompt instructions cannot create authority. A local biometric gesture proves
  presence only as supported by the integration; it does not define the scope.
- Owner rights in Vault do not automatically authorize billing, publication or
  private-data disclosure in a client's application. Identify the relevant
  human approver explicitly; without one, deny that operation.

Suggested product roles are Owner, Scoped access administrator, Member,
Temporary guest and Connection sponsor/operator. They are policy templates,
not new Vaultwarden roles. A scoped access administrator should not receive
native Admin if that grants all credentials. A separate control layer would
need to enforce such a narrower role. Sponsor/operator status supplies no
credentials by itself; AI connections get action grants rather than admin roles.

### Broker enforcement boundary

The broker must keep CLI unlock material, decrypted values, cookies and session
tokens inside a protected process/runtime; no generic `get password`, arbitrary
shell, browser storage, network capture or unrestricted JavaScript escape hatch
may be exposed to a use-only agent. Match exact destinations, block unapproved
redirects/frames, validate account/tenant and filter results before release.
Treat page content as untrusted instructions and protect approval surfaces from
the page and model. Error messages, traces, screenshots and recordings must also
exclude credential fields and sensitive login steps.

**Autofilling into an agent-controlled browser is not enough.** If the agent can
inspect input values, run arbitrary JavaScript, read cookies, access the browser
profile, debug the process or run as an equally privileged local user, it may
recover the credential/session or bypass the broker. Use-only enforcement needs
a genuinely restricted execution boundary with narrow operations. Likewise,
if an agent controls a full website session backed by an administrator login,
the broker cannot claim to restrict it to reading merely by withholding the
password. If the runtime or target app cannot enforce a requested restriction,
deny that mode or explicitly redesign it as supervised, broader access before
any grant. A policy description alone is not enforcement.

## 9. Expiry, lock and revocation

Suggested defaults for Osiris to refine, not configured values:

| Record | Proposed lifetime |
| --- | --- |
| Normal human membership | No automatic expiry for permanent staff; review every 90 days and immediately on role change. |
| Guest access | Explicit end, at most seven days initially; renewal is a new review. Native expiry needs an orchestrator, not an assumed Vaultwarden timer. |
| Connection eligibility | Explicit end, at most 30 days before review/renewal. Possessing a connection identity gives no task access. |
| Agent task grant | 30 minutes, capped at the approved task end; longer jobs need a specific reviewed duration. |
| Broker operation lease | At most five minutes, bounded by task, membership and connection expiry; revalidate for each action. |
| Single-action approval | Two minutes to begin; one use, bound to the approved request. |
| Elevated write window | Exact operation preferred; any approved batch has explicit limits and a maximum 15-minute window. |

Use server time and fail closed on expired/unknown state, clock uncertainty or
unavailable policy service. No silent offline renewal. A vault lock ends new
broker decryption/use when required by that custody mode; a previous unlock must
not become a permanent background grant. Explicit unattended jobs are a separate
product choice, not a relaxation of human-presence requirements by the agent.

Revocation has several independent targets:

1. Mark the person/connection/grant suspended in the authoritative policy store;
   invalidate outstanding approvals and prevent new leases immediately.
2. Cancel queued/in-flight broker work before its next sensitive step, destroy
   handles and controlled runtime sessions, and revoke/rotate connection
   authentication material. Revoking one connection does not rotate everyone's
   identity or Osiris's personal master password.
3. For a departing person, revoke/remove applicable Vaultwarden memberships and
   collection access; invalidate the relevant Vaultwarden devices/tokens and
   issuer/application sessions. Do not rely on SSO logout alone. See the identity
   plan's distinct native versus coupled SSO-session modes and limits.
4. Revoke target-app sessions, OAuth grants, API tokens and refresh tokens where
   the app supports it; clear broker-controlled cookies. A lease expiry does
   not automatically expire a target site's independently issued session.
5. Assess disclosed/copied credentials, native-client caches and compromised
   broker key material. Rotate affected target credentials when required and
   review organization/item key rotation using supported owner-approved flows.
   Removing a member does not cryptographically recall keys/ciphertexts already
   copied. Changing a master password alone is not a universal rekey/offboarding
   solution.

Show per-target results: blocked at policy, broker stopped, native access
revoked, target session revoked, cleanup pending/failed, rotation required.
Do not show “revoked everywhere” until the required confirmations arrive.
Suspension is immediate at the policy service; propose a maximum 60-second
broker propagation target and verify it later. Offline native clients, copied
values and completed side effects cannot be recalled. A lost/compromised
connection calls for containment and target-session/credential review even if
the registry has already revoked its identity.

## 10. Audit records

The proposed broker/control service owns an append-only authorization trail.
Record durable request/decision/approval events before sensitive execution;
if the required audit sink cannot acknowledge them, fail closed. Record outcome
afterward, with pending/unknown status when a network failure prevents confirming
whether a target mutation happened. Reconcile by operation ID before retrying.

Minimum fields: event/request/operation IDs; server time; actor person and sponsor
IDs; connection, device/runtime and run IDs; workspace/account references;
requested action/destination identifier; grant/policy versions; allow/deny reason;
approver and approval ID; lease start/end; execution outcome; revocation cause
and propagation/cleanup results. Store an opaque payload reference or keyed
integrity digest where needed, not the secret-bearing payload itself.

Never log master passwords, saved passwords, MFA codes/seeds, recovery material,
decryption/unlock keys, authorization headers, cookies, session/access/refresh
tokens, secret URLs or raw browser/network dumps. Account labels and usernames
can also be private: use opaque IDs and restrict audit-reader access. Sanitize
screenshots, traces and errors before storage; do not record login entry frames.

Osiris may inspect all workspace access records. A scoped reviewer sees only
assigned workspaces; a person can see their own relevant history without other
people's secrets or unrelated inventory. Connections cannot delete or rewrite
records. Separate audit administration from grant approval; protect an external
copy so the same compromised broker cannot silently erase its evidence.
Suggested retention is 90 days searchable and one year in protected archive,
subject to Osiris's privacy/client requirements and deletion policy.

Join broker events to native Vaultwarden organization events using resource and
operation references where possible. Native event enablement, client coverage,
retention and export paths still need verification by their owner. Native logs
alone do not prove every reveal/copy, model action or target-app side effect.

## 11. Concrete examples

All names below describe hypothetical grants, not existing account inventory.

| Situation | Proposed grant and expected behavior |
| --- | --- |
| Colleague needs client work accounts | Osiris invites a verified colleague to workspace Client A, mapped to organization A, with User access to its Operations collection. No access to Client B or Osiris Personal. The colleague unlocks their own vault; native shared credentials are considered disclosed to that client even if hidden in the UI. |
| T3 on Raven prepares a report | Connection `t3-raven-client-reporting`, sponsored by the approved person, gets `login.use` plus an enforceable report-read operation on one Client A account for 30 minutes. No reveal/export/send. An app-side read-only identity or narrow adapter is required; an unrestricted admin browser cannot satisfy this grant. |
| Codex on Osiris saves one draft | A different connection, `codex-osiris-client-drafts`, has its own identity and one account. Saving the reviewed draft requires approval bound to the exact target and draft digest. Publishing needs a separate send/publish approval. Revoking T3 on Raven leaves this Codex identity intact. |
| Contractor needs one saved account for two days | Native sharing uses a dedicated collection if ordinary credential access is acceptable, with explicit scheduled offboarding proposed. If disclosure is unacceptable, use a future restricted broker-only grant and do not share the cipher/key with the contractor. No automatic access to newly added accounts. |
| Agent asks to show a password “to debug login” | Deny `secret.reveal`; `login.use` cannot be escalated by that explanation. A designated human may request the separate approved reveal flow. Failed login does not authorize an enrollment or password/MFA test loop. |
| Report page tells an agent to use another account | Treat it as untrusted content. The new workspace/account/origin is outside the grant; deny and record the attempt. A browser already logged into the wrong tenant is not usable authority. |
| Lost Raven connection or a departing colleague | Suspend that connection or person and their sponsored grants, cancel pending work, revoke controlled/target sessions and native access as applicable, then assess rotation. Show incomplete external cleanup explicitly; do not claim offline data was erased. |

## 12. Open product questions for Osiris's refined plan

1. Does “one master key everywhere” mean business SSO, a familiar per-device
   unlock, or actual shared cryptographic custody? Recommended: the first two,
   with independent keys and no distribution of Osiris's decryption secret.
2. Confirm the owner binding and authoritative issuer decision from the identity
   plan. Who is allowed to approve grants for each client workspace, reveal,
   spending, publishing, ownership changes and emergency recovery?
3. Which boundaries need separate Vaultwarden organizations? Are workspaces
   business/client boundaries, and which accounts must never be shared across
   them? Is direct native sharing acceptable for each class of credential?
4. Who owns the protected integration, what does it actually enforce today, and
   which narrow broker interface can it support without changing active login
   behavior? Obtain that owner's review before designing an implementation.
5. Which T3/Codex runtime can prove a distinct connection identity and prevent
   arbitrary profile, process, filesystem and browser-secret access? Which
   application actions have real enforceable read/write boundaries? Unsupported
   restrictions must remain unavailable.
6. Should the broker use owner-device custody or a separately enrolled scoped
   account? Is an additional trusted cloud decryptor acceptable? Who controls
   recovery and can recover when Osiris or the identity service is unavailable?
7. Must every normal agent unlock require Osiris's local fingerprint? If
   unattended work is wanted, what explicit alternative custody, task limits
   and approval model would be acceptable? Do not silently relax the existing
   integration's stated human-presence goal.
8. Approve or revise the suggested lifetimes, review cadence, revocation target,
   audit retention and allowed routine preapprovals. How should active work be
   handled when approval expires or the sponsor leaves?
9. What should happen after external session revocation fails, a credential was
   disclosed, or a target app offers no per-session revoke? Who owns rotation,
   incident decisions and the independent recovery route?
10. Is current Vaultwarden sufficient, or is an explicitly scoped vendor/server
    migration worth evaluating later? No subscription selection or feature
    parity should be inferred from this planning comparison.

## 13. Future implementation and acceptance gates

**Wait for Osiris's refined plan.** Then reconcile it with the identity owner
and protected-integration owner, select custody/runtime boundaries and prepare a
separately reviewed implementation brief. Do not create parallel identity,
invitation or login implementations. Preserve pinned upstreams; any future
candidate changes follow Vault's repository and license boundaries.

Once implementation is separately authorized, recognition of success requires
isolated nonproduction acceptance with purpose-created harmless accounts:

- Two people and two distinct connections receive different workspaces/accounts;
  cross-workspace requests, stale memberships and wrong target tenants fail.
- Use succeeds without password/key/token exposure through tool results,
  DOM/JavaScript, process/profile access, logs, screenshots or error paths. If
  this boundary cannot be enforced, the product does not claim use-only access.
- Login permission alone cannot reveal, publish, spend, delete, change security
  settings, edit credentials or mint a child connection's access.
- Wrong approver, altered payload, replay, expiry and concurrent consumption
  fail; safe idempotent retry does not duplicate an external write.
- Lock, denied/cancelled local presence, policy/audit outage and revoked sponsor
  stop sensitive work. Distinct connection revocation leaves unrelated access
  intact and measures the chosen propagation target.
- Native and target-app session revocation results are recorded separately;
  offline/disclosed data limits and credential/key rotation paths are reviewed.
- Audit records attribute the person, connection, approver and operation without
  secret material. Unknown external outcomes stay unknown until reconciled.
- Existing login integration and the accepted signed Bitwarden app retain their
  own owner's regression and human acceptance. Source inspection or a fixture
  cannot substitute for those results.

None of these acceptance checks was run in this planning task. Verification
here consists of reading current repository/pinned source, the available
identity plan and authorized handoff, checking primary capability references,
and reviewing this document's scope and consistency. No real grants, secrets,
enrollment, authentication tests or active-login changes were performed.
