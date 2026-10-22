# Team and workspaces

Status: planning only. Await Osiris's refined plan before implementation.

Inspected on 22 October 2026. This document proposes product behavior and data
relationships. It does not authorize invitations, item transfers, configuration
changes, deployment or membership changes.

## What we are building

One Osiris-owned business with a central People page. Osiris invites a person
once, selects their workspaces and permitted accounts, and manages later changes
from that person's record. A teammate sees the workspaces and accounts granted
to them. Workspace membership alone does not expose every account in it.

Osiris confirmed during planning that normal encrypted sharing is acceptable,
including a teammate's ability to reveal a shared password. He also confirmed
that the workspaces belong to one business. Separate workspace owners and
separate encryption boundaries are outside this proposal.

Success means adding a teammate to two workspaces with one business invitation,
confirming their encrypted access, and later changing one workspace without
resetting their other memberships or account grants. Osiris remains the
protected business owner.

## Why this matters

Repeated workspace invitations make access hard to understand. Broad workspace
roles also fail the requirement when someone needs only two of a workspace's
accounts. Vault needs a person-level view of both membership and effective
account access, with a clear explanation of where each permission comes from.

The implementation should preserve Vaultwarden's encryption and compatible
clients. Crayon supplies useful interaction and scope-preservation patterns,
but its design-sharing permissions cannot become password permissions by
renaming objects.

## The finished experience

### Invite and activate

1. Osiris opens Business, then People, and chooses Invite person. He enters one
   email address. Existing people resolve to their business record instead of
   creating another identity.
2. He selects workspaces. Each selected workspace expands to show its accounts.
   Accounts start unchecked. Selecting a workspace grants its membership only.
3. He selects individual accounts and chooses View or Edit and delete. View
   includes revealing and copying the shared credentials. Editing an item does
   not grant permission to share it with someone else.
4. A review shows the selected workspaces, account permissions and any access
   already available through another source. One business invitation covers the
   selected workspaces. Saving a draft does not send it.
5. The recipient signs in or creates their own vault identity and accepts the
   business invitation. People shows Awaiting confirmation until Osiris confirms
   the identity and his unlocked client provides the protected organization key.
   Invitation acceptance alone is not usable encrypted access.
6. After confirmation and sync, the teammate can open only the permitted shared
   accounts. Their personal vault remains separate. Compatible clients show the
   underlying organization and account collections; the workspace navigation is
   a Vault experience.

### Change access later

Osiris opens the same person, changes only the affected workspace or account
rows, reviews the before/after result and saves. Already confirmed members do not
need another invitation for ordinary additions. The page rereads authoritative
permissions before reporting success.

For example, a teammate belongs to Workspace A and Workspace B. An account is
granted through both. Removing A removes only A's membership and grants. B stays
active, and the account remains available through B. The review says why it will
remain available. Removing a grant and removing all effective access are
different operations.

Removing the last workspace should, by default, leave the person's business
record with no workspace grants. A separate Remove from business action revokes
that business membership and all of its workspace grants, while preserving the
person's personal vault and memberships in other businesses. Re-entry after full
offboarding should require fresh acceptance and confirmation. This default
awaits Osiris's refined plan.

Removing access prevents future authorized retrieval. It cannot erase a password
already learned, an exported copy, an offline decrypted copy or a website session.
Provider session revocation and credential rotation are separate offboarding
actions, not effects of a Vault membership update.

## Included and excluded

The proposed first implementation includes one business owner, business People,
workspace membership, explicit per-account grants, invitation and confirmation
states, scoped changes, effective-access explanations and an audit history.
Future workspaces and future accounts receive no automatic teammate grants.

Osiris alone manages people and permissions initially. Delegated business admins,
workspace admins, account-sharing managers, automatic future access, groups,
external guests and public credential links are deferred. These require separate
product decisions and server enforcement. Ordinary teammates use the native User
role with no organization-wide access flag.

This task delivers this plan only. It excludes product code, live organization
creation, real invitations, moving the existing personal items, deployments,
desktop replacement and changes to protected agent browser integration. The
working official desktop app, Keychain enrollment, Crayon and all live access
remain intact.

## What inspection established

### Source and evidence boundaries

Vault is `/Users/osirismedici/Desktop/code projects/Vault`, at
`1b7e6b14cc704c7622ce2c2edab8e86a3fb765fe` before this document. Its working tree
was clean. Its server is Vaultwarden 1.37.4 at
`7c188967e7a467b19b2757bc3326f9cf3ccae327`; its compatible web source is
v2026.7.0+0 at `d2a095eb800fe80a9bc524579b974796eae51994`. The shipped Vault
changes are branding and CSS, not a new authorization system. See [V1] and [V2].

Crayon source is available at `/Users/osirismedici/Desktop/code projects/Crayon`,
with HEAD `5fc1a0ccc1332ac661997a29b284e4baa5e84f3c`. Its checkout is dirty.
The People backend, UI, data events, migration and tests include untracked local
files. The findings below describe those real working files, not proof that this
exact tree is committed or deployed. Crayon's repository instructions and its
frontend, backend, common and permission guidance were read before inspection.
No Crayon files or live memberships were changed.

A read-only live inventory found zero organizations, organization memberships,
collections, collection-user grants, collection-item links, groups, group members
and collection-group grants. Existing items were personal rather than
organization-owned. The check used SQLite `mode=ro` with
`PRAGMA query_only=ON` and aggregate counts only. No item values, keys, account
catalogs or session material were read into the transcript.

A separate read-only configuration check found invitations explicitly disabled,
public registration explicitly disabled, no SMTP host, sendmail disabled and
groups disabled by default. The running image was `osiris-vault:0.1.1-f9a2511`.
These are observations during this inspection, not permanent assumptions.
The checked-in deployment agrees on the closed invitation/registration settings
at [O1], lines 16-26. Existing capability and configured live sharing are therefore
distinct: the implementation exists upstream, but no team sharing is configured.

### Crayon's central People page

People is reachable outside a particular workspace's Members screen. It lists
people with workspace, role and pending/active information, search and retry
states. One editor selects workspaces, roles and a before/after review. Owner
rows and self-management are disabled. Its data layer submits changed rows only
and refetches after a successful save. See [C1], lines 32-157, [C2], lines 7-35,
and [C3], lines 532-545.

The backend aggregates live non-default teams where the caller is Owner or
Admin. A workspace is a `team`; membership is a `team_profile_rel`. Implemented
roles are Owner, Admin, Editor and Viewer. Owner and Admin imply editing, and
any team membership grants reading. This is an aggregate of administered teams,
not a durable business-wide membership layer. See [C4], lines 24-66, [C5],
lines 42-67, and [C6], lines 12-22.

Invitation contacts are unique per inviter and email. A new collaborator gets
one versioned, seven-day invitation listing the still-pending workspaces.
Resend is throttled. Acceptance checks identity, version, expiry, unconsumed
state, current grants and the inviter's authority over each workspace. Existing
accepted collaborators, or active collaborators sharing an administered
workspace, can receive later grants immediately. See [C4], lines 90-134 and
136-248, [C7], lines 1-18, and [C8], lines 198-239.

People saves in a transaction, locks and rechecks affected workspace authority,
rejects duplicate targets and protects owners. Team removal cleans only that
team's related file/project permissions, pins and membership. It does not reset
unrelated team membership. The frontend also has a regression case for leaving
an unrelated currently open workspace alone. See [C4], lines 71-88 and 136-226,
[C5], lines 740-820 and 907-1023, and [C12], lines 13-69.

Crayon's proposed Super Admin, Internal Admin and Workspace Admin system is a
draft, not observed behavior. Its plan explicitly describes future work at [C13],
lines 3-26. Vault should not claim to inherit those roles.

### Crayon's individual sharing permissions

Crayon has distinct access paths that People does not combine:

- Team, project and file role rows contribute additive permissions. Project/file
  roles require live team membership and team removal cleans those scoped rows.
  They do not subtract access already granted by a broader team role. See [C9],
  lines 31-64, [C10], lines 371-427, and [C5], lines 740-768.
- Board invitations name an email and Viewer, Commenter or Editor role. They
  permit a scoped board without adding team membership. The board gateway checks
  current role and page scope. An invitation and a public link can both grant
  access; the resolver selects the stronger role. Removing a named invitation
  can therefore leave link access. See [C11], lines 45-182 and 272-330.
- Legacy file links have their own page, commenting and inspection settings and
  removal rules. See [C14], lines 24-82.

People does not centrally list or edit those individual grants. Team removal
does not delete separate board invitations. Reuse the scope checks and the
effective-access lesson; do not present Crayon's People page as an existing
complete per-resource permission manager or reuse its public-link model for
credentials.

### Vaultwarden's existing model

An organization owns shared items. `users_organizations` already stores stable
membership IDs, user and organization IDs, role, status, `access_all` and the
member's protected organization key. States include Invited, Accepted, Confirmed
and Revoked. Roles are Owner, Admin, User and Manager. Custom roles are currently
mapped to Manager with partial compatibility behavior, not arbitrary permission
definitions. See [V3], lines 32-125 and 445-455.

Collections belong to one organization. `ciphers_collections` allows an item in
multiple collections. `users_collections` supplies direct user permissions,
including `read_only`, `hide_passwords` and `manage`; groups supply another access
path when enabled. Collection names use existing client-side organization-key
encryption. See [V4], lines 24-53 and 99-162, [V5], lines 18-63, and [V11],
lines 238-252 and 259-273. Nested collection names are navigation organization;
they do not inherit access. See [About collections][E1].

The existing client already invites a member with selected collections/groups,
edits their role/access, and supports confirmation, revocation and restoration.
These are organization-scoped flows rather than Vault workspaces. See [V6],
lines 496-585, [V7], lines 421-499, and [V8], lines 989-1140, 1240-1430 and
2196-2285. Vault needs to extend these flows, not recreate account identity,
login, MFA or invitation cryptography.

The unlocked confirming client's existing service protects the organization key
for the recipient's public key. The server stores that protected value on the
membership. Personal-to-organization sharing also goes through existing
client-side encryption and the share endpoint. A SQL ownership edit would skip
this necessary work. See [V9], lines 33-67, [V8], lines 1366-1428, and [V10],
lines 887-932. The [security whitepaper][E2] describes the key-sharing model;
the pinned source remains the authority for this Vault candidate.

Collection permissions control server delivery and editing; collections within
one organization are not separate encryption-key domains. A shared item's
recipient can decrypt its contents. `hide_passwords` becomes a client permission
flag, not a promise that a recipient cannot recover the password. Organization
Owner/Admin or `access_all` membership bypasses ordinary collection restrictions.
See [V12], lines 375-391 and 584-656, and [V3], lines 776-785.

Several accessible collections can broaden an item's permissions. The pinned
implementation combines read-only/hide-password restrictions with boolean AND
and manage with OR, with direct-user/group precedence that must be tested on
both sync and individual retrieval paths. A denied-looking row is not a global
deny. See [V12], lines 605-656. The UI must explain effective access rather than
infer it from one collection checkbox.

Native owner protection already rejects leaving, demoting, deleting or revoking
the last confirmed owner and restricts management of owners. It does not make
Osiris an immutable business root if other owners are appointed. See [V8],
lines 237-246, 1517-1535, 1655-1663 and 2255-2265.

## Licensing and reuse decision

Crayon is a Penpot-derived MPL-2.0 repository. Existing derived files retain MPL
and Kaleidos notices. Newly added People files inspected have no per-file license
header, so repository context alone does not settle the provenance of every new
contribution. Check exact-file rights before copying. Crayon's MPL text requires
source availability and preservation of notices for covered distributions. See
[C15], lines 160-204, [C6], lines 1-5, and [C14], lines 1-5.

MPL section 3.3 has a conditional route for combining with GPL-family works;
Mozilla's [FAQ, question 14][E3] explains its secondary-license conditions. That
is not permission to relabel arbitrary Crayon code as Vault-owned GPL code.
Any literal reuse needs an exact-file provenance/license review, dependency
review, retained notices and a corresponding-source plan before distribution.

Vault's original files are GPL-3.0-only, its server is AGPLv3, and the compatible
web client's default is GPLv3. `bitwarden_license` has separate terms and is not
included in the reduced web checkout. Those terms allow internal development
and testing in a non-production environment, not general production reuse.
Use the OSS target and audit every imported module. A modified network-served
Vaultwarden also needs the applicable AGPL source offer. See [V13],
[V14], lines 1-15, [V15], lines 25-42, and [V16], section 13.

Recommendation: reuse Crayon's interaction rules and acceptance scenarios, then
implement them in Vault's Angular/TypeScript client and Rust server. No Crayon
code is copied by this plan. Its Clojure/Rumext/RPC/SQL implementation is not a
drop-in module for this app.

Reusable patterns are the person-level access review, explicit scope deltas,
authoritative refetch, identity-bound invitation state, authority rechecks,
transactional changes, protected owners and negative permission tests. Existing
Vaultwarden identity, organization membership, encryption, native confirmation,
collection storage and synchronization are the implementation foundations.

## Proposed data relationships and implementation

All new relationships below are proposals, not existing Vault tables.

### Business, people and workspaces

- Business maps to one native organization. A small business-settings extension
  references its organization ID and protected owner user ID. Do not create a
  second user directory or independent business encryption system.
- A person is the native user. Business membership is the existing
  `users_organizations` record. Keep its stable membership ID after acceptance;
  email is an invitation address, not the sole permanent authorization identity.
- Workspace has a stable ID, business organization ID, encrypted display name,
  lifecycle state and revision. Workspace names follow the existing client-side
  collection-name encryption pattern. No decrypted account labels or secrets
  belong in the new server metadata.
- Workspace membership relates a business membership to a workspace, with a
  lifecycle state and revision. A business member can have many workspace
  memberships. Removing one does not delete the business membership or others.
- Account refers to one native organization-owned login item, using its cipher
  ID. Account labels and secret fields remain in the encrypted item. Initially,
  sharing an account shares the whole item, including its associated fields.
- Workspace-account placement relates a workspace to an account. One account
  can appear in several workspaces without copying the credential. Enforce that
  the workspace, item and business all reference the same organization.
- Workspace-account grant relates a workspace membership to one of that
  workspace's account placements and a permission. Composite foreign keys and
  server validation must reject grants across businesses or unrelated workspace
  memberships. Granting a workspace creates no account grants automatically.

Require a confirmed business membership, active workspace membership, active
placement and an explicit account grant before projecting access from that
workspace. Pending selections can be stored, but must not become usable access
before native confirmation.

### Enforce selected accounts with native collections

Prefer one managed collection per shared account initially. Its collection-item
relationship contains that one cipher. Workspace grants compile into direct
collection-user permissions. Several workspace grants for the same person and
account combine into one effective native collection grant. Keep each source
grant so removing A cannot erase B's contribution.

Do not place all workspace accounts in a collection granted to every workspace
member; that would expose unchecked accounts. Do not rely on a filtered Vault UI
while the API still supplies broader items. Workspace names alone are not an
access boundary.

Initial account permissions map as follows:

- View uses `read_only=true`, `hide_passwords=false`, `manage=false`.
- Edit and delete uses `read_only=false`, `hide_passwords=false`, `manage=false`.
- Sharing management stays with Osiris. Do not infer it from item editing.

Keep ordinary members as native User with `access_all=false`. Do not label a
native organization Admin as a restricted workspace admin: Admin has broader
access in this server. An edit-only permission without deletion would require
additional enforcement and is not promised by these existing flags.

One collection per account increases native-client list size, but matches the
required account-level selection without custom encryption. One collection per
workspace is simpler only if every selected member should receive every item.
Collections for repeated identical account bundles could reduce the count later,
but add reconciliation complexity. Start with exact account grants.

Vault must enforce the managed collection's single-account contents and track
all other access paths. Native collection reassignment, group grants, role
changes and bulk edits can otherwise broaden or remove access outside People.
Route writes to managed resources through the same revision/permission service,
or reject incompatible writes. Show external native grants separately and never
silently adopt or overwrite them. Owner access remains an explicit broad source.

### Invitations and owner protection

Use one native organization invitation rather than Crayon's multi-team token
bundle, because this proposal has one organization. Attach pending workspace and
account selections to the invitation's membership ID and versioned access draft.
Normalize invitation email, bind acceptance to the authenticated recipient and
native token checks, and apply current selections at confirmation. Revoked or
superseded selections must not return when an old link is opened.

Preserve native client-side key confirmation and fingerprint review. Later
workspace grants use the confirmed membership without another key exchange.
Full offboarding clears active grants; restoration must not revive stale desired
access without a new explicit review. Account deletion/recreation with the same
email must not inherit the former user's accepted identity.

Protect Osiris at the server as well as in the UI. Generic People actions must
not demote, revoke, remove or replace the protected owner, even if another Owner
is later introduced. Keep native last-owner checks. Ownership transfer and
recovery need a separate explicit workflow; they are outside routine workspace
management. Do not implement Crayon's draft Internal Admin roles as assumed
requirements.

### Preserve unrelated access in every save

This is the critical API constraint. The pinned native member-edit endpoint
deletes all of the person's direct collection assignments in that organization,
then recreates the submitted list. It also deletes and recreates group
assignments, including when the optional input is omitted. Collection-edit and
bulk-access endpoints similarly replace collection user/group lists. A payload
containing only one workspace's rows would revoke unrelated access. See [V8],
lines 1474-1591, 534-601 and 604-668.

Propose a server-owned delta operation with business/member IDs, expected
revision, an idempotency key and explicit changed workspace/account grant IDs.
An omitted workspace is unchanged; a filtered or unloaded row is never a revoke.

Within one transaction, authorize the current owner, lock affected rows in a
stable order, validate all relationships and revisions, update source grants,
and recompute only the affected effective native collection-user rows. Preserve
other workspace grants, external native grants, group assignments and other
organizations. Reject stale revisions and reload for review instead of silently
overwriting a concurrent edit. Include audit records in the same transaction;
notify clients only after commit. Retry with the same idempotency key returns
the stored outcome.

Maintain projection records identifying which native rows Vault produced, the
source grant IDs and their last applied revision. Native delivery remains the
authorization result. The new workspace ledger must not become a UI-only policy
disconnected from that result. External changes require detection and an
explicit reconciliation review. Do not use repeated existing full-replacement
API calls as if they were an atomic delta transaction.

At completion, refetch the person and effective account access. Return retained
access reasons, changed grants and the authoritative revision. An ordinary
change must not navigate a teammate out of an unrelated open workspace. If their
current workspace is revoked, refresh permissions and offer a permitted
destination without discarding unrelated work.

### Prerequisites and delivery boundary

The current release uses an unmodified server binary. New workspace data and
transactional deltas require a reviewed server candidate and an OSS client build,
not a theme or display-string patch. Preserve pinned upstream checkouts and apply
changes to generated candidates, with reproducible patches and updated source
receipts. Follow Vault's [AGENTS.md](../../AGENTS.md) and [operations guide][V2].

Before any real invite, separately review invitation enablement, mail delivery
and invite-only registration routing. The existing proxy helper is specifically
for initial owner enrollment and refuses that flow after the owner is registered.
It is not a teammate onboarding system. Keep public registration and `/admin`
closed; design and test a narrowly authorized invite enrollment path instead of
reopening the old owner window. See [O2], lines 65-101.

Create the organization through the unlocked owner client only after approval.
Review which personal items belong to the business, then use the existing
client-side sharing operation for those selected items. Keep unrelated personal
items private. Do not bulk-transfer the 256 items or change database ownership
columns directly. Verify IDs, attachments, existing references and decryption
after any approved transfer. No transfer occurs in this planning task.

## Tradeoffs and unresolved product questions

The confirmed choices are one business and normal encrypted sharing. Remaining
questions for Osiris's refined plan are:

1. What are the initial workspaces, and which existing personal items actually
   belong to each? Should the same credential appear in several workspaces?
2. Is owner-only people management enough initially? If someone needs workspace
   administration, can they invite others, delegate accounts or see all workspace
   credentials? This changes backend authorization and cannot map casually to
   the native Admin role.
3. Should account permissions default to View, with Edit and delete as an
   explicit escalation? Does sharing the entire vault item, including any TOTP,
   notes and attachments, match the intended meaning of an account?
4. Should removal of the last workspace retain the business relationship, while
   full business removal requires fresh acceptance on re-entry, as proposed?
5. Who provides recovery if Osiris is unavailable? An additional native Owner
   receives broad business access; a protected primary owner and recovery role
   need explicit rules. No second owner is appointed by this plan.
6. Is native-client visibility as per-account collections acceptable, with richer
   workspace navigation only in Vault? Exact native workspace navigation would
   require changes across desktop, extension and mobile clients.
7. Should existing direct/native grants remain separately managed, or should
   Osiris explicitly import selected grants into the central ledger? Default to
   preserving and displaying them until reviewed.

One organization means simpler invitations and no cross-organization copying,
but it is one encryption domain with broad owner access. A future demand for
separate client ownership or separate encryption boundaries needs a different
organization design. Neither collection nesting nor workspace labels provide it.

Normal sharing also means revocation is prospective. Hiding password controls
would not turn this into protected sign-in-only access. That separate integration
remains outside Vault's human team-sharing implementation.

## Testing and handoff

This planning task inspected source, existing test definitions, licenses and
non-secret live aggregates/configuration. It did not run application tests,
exercise an invitation, unlock a vault, transfer an item or validate new UI.
The plan's permission model is proposed, not accepted runtime behavior.

Document verification resolved all 38 source references and checked every local
target exists. Crayon's Git status fingerprint and the three People source
hashes below were unchanged at completion. Vault's upstream checkouts remained
clean and pinned. A second read-only live inventory returned the same sharing
counts and 256 personal items. The only Vault working-tree addition was this
planning document.

After Osiris refines the plan, validate an implementation in an isolated
candidate with dummy accounts and an isolated database:

1. Invite one new person to two workspaces and two selected accounts. Confirm
   there is one business invitation and that Invited/Accepted cannot decrypt
   until native confirmation. Test both an existing user and a new user behind
   invite-only registration gates.
2. Reject wrong-recipient, expired, superseded, replayed and revoked invitations.
   Change selections before acceptance and confirmation; only current grants
   should activate. Reject a recreated identity using a former member's email.
3. Give the person A and B, then remove A. Verify B's membership, role and account
   permissions are unchanged in database readback, API reads and a fresh client
   sync. Preserve unrelated group assignments and another organization's access.
4. Share one account through A and B. Remove A's grant and confirm the review
   explains the remaining B access. Remove the last granting source and verify
   new retrieval is denied. Keep a separate direct grant to prove that a scoped
   removal does not silently remove it.
5. Give workspace membership with zero accounts. Verify ordinary item-list,
   sync, search, direct item and attachment requests cannot expose unchecked
   accounts. Test View and Edit and delete on reads, writes and deletes; neither
   should manage access. Try sibling-workspace and cross-business IDs directly.
6. Attempt owner demotion/removal/revocation, privilege escalation and native API
   bypasses through member edits, collection edits, groups, bulk actions and
   managed collection item reassignment. Confirm server enforcement, not just
   disabled UI controls. Exercise both sync and individual retrieval because
   native direct/group permission precedence is version-specific.
7. Submit concurrent/stale edits, duplicate targets, duplicate retries and a
   failure halfway through a save. Prove atomic rollback, idempotent retry and
   no notification of uncommitted changes. Reopen People to confirm persistence.
8. Remove all workspace access, offboard, and attempt native restoration. Confirm
   old pending grants do not return. Keep the unrelated currently open workspace
   stable; handle revocation of the current workspace explicitly.
9. Privately transfer one approved dummy personal item using the existing client
   sharing service. Verify owner/member decryption, attachments, collection
   contents and stable references in web and the unchanged official desktop
   client. Keep the unrelated personal item private.

Crayon already has useful negative-test references at [C16], lines 34-331,
[C12], lines 13-69, and [C17], lines 35-119. Adapt the scenarios to encrypted
items and native-client delivery; do not copy passing-test claims across apps.

Review source/build checks, candidate runtime acceptance, deployment approval
and live acceptance separately. Any later live rollout needs an encrypted backup,
tested migration/rollback plan, exact source receipt and separate human acceptance
with two identities and a second compatible client. A successful save toast or
an invitation row is not proof that the teammate can decrypt only the selected
accounts.

Implementation is intentionally waiting for Osiris's refined plan. Review the
remaining questions and defaults above before authorizing a candidate build.

## Source register

Paths are relative to this document. Crayon links point to the sibling local
checkout and will not resolve from the Vault GitHub repository. Preserve this
distinction rather than inventing committed URLs for untracked People files.
Line ranges in the text describe the inspected working files. Vault upstream
references are pinned by [V1].

- C1: [Crayon People UI][C1].
- C2: [Crayon People data events][C2].
- C3: [Crayon profile-menu navigation][C3].
- C4: [Crayon People backend][C4].
- C5: [Crayon team permissions and membership mutations][C5].
- C6: [Crayon team role types][C6].
- C7: [Crayon People contact migration][C7].
- C8: [Crayon invitation acceptance][C8].
- C9: [Crayon project permission query][C9].
- C10: [Crayon file permission query][C10].
- C11: [Crayon board sharing and access gateway][C11].
- C12: [Crayon People frontend tests][C12].
- C13: [Crayon draft assignable-role plan][C13].
- C14: [Crayon file share links][C14].
- C15: [Crayon MPL-2.0 license][C15].
- C16: [Crayon People backend tests][C16].
- C17: [Crayon board-sharing backend tests][C17].
- V1: [Vault upstream source lock][V1].
- V2: [Vault operations and release boundary][V2].
- V3: [Vaultwarden organization and membership model][V3].
- V4: [Vaultwarden collection and direct-grant model][V4].
- V5: [Vaultwarden group model][V5].
- V6: [Existing client invite/member dialog][V6].
- V7: [Existing client edit-member dialog][V7].
- V8: [Vaultwarden organization API][V8].
- V9: [Client-side organization-key confirmation][V9].
- V10: [Client-side item sharing][V10].
- V11: [Client collection encryption service][V11].
- V12: [Vaultwarden cipher access and effective restrictions][V12].
- V13: [Vault license and attribution boundary][V13].
- V14: [Compatible client license map][V14].
- V15: [Separate Bitwarden License terms][V15].
- V16: [Vaultwarden AGPL license][V16].
- O1: [Existing deployment configuration][O1].
- O2: [Existing owner-only enrollment helper][O2].

For identification of the uncommitted Crayon reference, SHA-256 values were:

```text
backend/src/app/rpc/commands/people.clj
9c57837e31a584bec7b4cca9a5fc7eabeba287fba2d4a87ff9d6e8966684952d
frontend/src/app/main/data/people.cljs
8832e87ddd51734af97fb544cfb903d00865964b4200d31eca91ec6096fadee9
frontend/src/app/main/ui/dashboard/people.cljs
152bc1176b3ee8be17b5235a715e7e49d2805188a8c95f746076bb301160ecc7
```

[C1]: ../../../Crayon/frontend/src/app/main/ui/dashboard/people.cljs
[C2]: ../../../Crayon/frontend/src/app/main/data/people.cljs
[C3]: ../../../Crayon/frontend/src/app/main/ui/dashboard/sidebar.cljs
[C4]: ../../../Crayon/backend/src/app/rpc/commands/people.clj
[C5]: ../../../Crayon/backend/src/app/rpc/commands/teams.clj
[C6]: ../../../Crayon/common/src/app/common/types/team.cljc
[C7]: ../../../Crayon/backend/src/app/migrations/sql/0158-add-people-contacts.sql
[C8]: ../../../Crayon/backend/src/app/rpc/commands/verify_token.clj
[C9]: ../../../Crayon/backend/src/app/rpc/commands/projects.clj
[C10]: ../../../Crayon/backend/src/app/binfile/common.clj
[C11]: ../../../Crayon/backend/src/app/rpc/commands/boards.clj
[C12]: ../../../Crayon/frontend/test/frontend_tests/data/people_test.cljs
[C13]: ../../../Crayon/.agents/plans/2026-10-20-assignable-people-roles.md
[C14]: ../../../Crayon/backend/src/app/rpc/commands/files_share.clj
[C15]: ../../../Crayon/LICENSE
[C16]: ../../../Crayon/backend/test/backend_tests/rpc_people_test.clj
[C17]: ../../../Crayon/backend/test/backend_tests/rpc_board_test.clj
[V1]: ../../upstream.lock.json
[V2]: ../operations.md
[V3]: ../../upstream/server/src/db/models/organization.rs
[V4]: ../../upstream/server/src/db/models/collection.rs
[V5]: ../../upstream/server/src/db/models/group.rs
[V6]: ../../upstream/web/apps/web/src/app/admin-console/organizations/members/components/member-dialog/member-dialog.component.ts
[V7]: ../../upstream/web/apps/web/src/app/admin-console/organizations/members/components/edit-member-dialog/edit-member-dialog.component.ts
[V8]: ../../upstream/server/src/api/core/organizations.rs
[V9]: ../../upstream/web/libs/admin-console/src/common/organization-user/services/default-organization-user.service.ts
[V10]: ../../upstream/web/libs/common/src/vault/services/cipher.service.ts
[V11]: ../../upstream/web/libs/admin-console/src/common/collections/services/default-collection.service.ts
[V12]: ../../upstream/server/src/db/models/cipher.rs
[V13]: ../../NOTICE.md
[V14]: ../../upstream/web/LICENSE.txt
[V15]: ../../upstream/web/LICENSE_BITWARDEN.txt
[V16]: ../../upstream/server/LICENSE.txt
[O1]: ../../../Karen/infrastructure/vaultwarden/compose.yaml
[O2]: ../../../Karen/infrastructure/vaultwarden/proxy.py
[E1]: https://bitwarden.com/help/about-collections/
[E2]: https://bitwarden.com/help/bitwarden-security-white-paper/
[E3]: https://www.mozilla.org/en-US/MPL/2.0/FAQ/
