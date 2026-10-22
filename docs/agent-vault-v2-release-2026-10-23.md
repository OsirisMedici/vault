# Vault v2 integration and release

## Owner and outcome

This worktree's thread succeeds manager a9cfb71e-af79-472a-b333-a368756aeac2
under Osiris's explicit release authorization. No other release owner, chat or
worker is active for this sequence. Host osiris.local, arm64; branch
work/agent-vault-integrated; clean starting revision 4203f58.

The existing owner can find a supported imported account, explicitly request a
login, and read bounded accurate history in the existing Agent access page.
Only signed_in with identityVerified true is success. Team grants remain
opt-in and dormant; live sync remains dormant pending a fresh owner export,
source verification, matching baseline and exclusive access. Existing 253
accounts, 506 imported fields and 519 total fields must remain intact.

## Source assembly

Browser efca940 was already accepted as e1cf42a and was not applied twice.
Reviewed owned commits, individually cherry-picked:

- Sync 428bb67 -> 290eb7a.
- UI 49815d6 -> e852fb5.
- Permissions d205249 -> 9edfd67.
- CI b8db55a -> 7d3800a.

The Pranshi results branch is documentation evidence only, not merged feature
source. Upstream/web remains clean at d2a095eb800fe80a9bc524579b974796eae51994.
No merge of main, original checkout reset or dependency/pin update occurred.
Integration fixes include the new permissions module in the bridge image and
an activation helper that checks the exact expected current image and ID,
while retaining the pinned base/layer/config checks and rollback.

## Acceptance budget

Five existing worker aggregate cases passed again on the assembled source:
sync S2, browser B2, UI logic, permissions/history, CI packaging. Their rechecks
are the same cases, not new allocations. Syntax/diff/scanning/build are hygiene.

The five manager allocations, keeping ten total, are:

6. Fresh recoverable snapshots, deployment/rollback and preserved inventory.
7. Public HTTPS health, authentication and blocked worker/admin/registration gates.
8. Authenticated discovery, explicit selection, desktop/narrow rendering and session clearing.
9. Authenticated bounded read-only history, request lifecycle and accurate outcome.
10. One real GoDial website login, exact identity verification and clipboard cleanup.

Synthetic permissions case covers isolation and revocation; no real team
identity or grant will be created. Pending cases must not be reported passed.

## Build and publication

The single production compile passed in 182543 ms on osiris.local, darwin arm64,
Python 3.13.3, Bun 1.4.4 and compiler-only Node 26.12.0. Frozen installation
used disabled lifecycle scripts; no pin, dependency or upstream edits occurred.
Build source revision: f561d1862dc95d86689585f080acedf12e6fc3a7.
The later 0d0e579 commit adds only the guarded bridge activation helper.

The exact public build receipt is
[releases/vault-v2-f561d18-build.json](releases/vault-v2-f561d18-build.json).
All 29 compiled JavaScript files and four license files survived packaging
byte-for-byte. Artifact: 257 files, 65396292 bytes, inventory SHA-256
251309e3892853034ae7a4fa61af210b2d0ff226373743bfd2c9db25871e8465.
Public index SHA-256:
6760df2867427d9e34795a1f648af9a72b87dcfb0259c8feec556d97b026dbe8.

Gitleaks redacted scans passed for all six incoming/integration commits and
the owned feature overlay. Whitespace and Python/JavaScript syntax hygiene
passed. The generated candidate and pinned upstream stayed clean.
GitHub production dispatch was not run. The reviewed equivalent serialized
local build ran instead; main was not merged to expose the dispatch workflow.

## Deployed release

Release contexts and helpers are at /opt/osiris-vault-web-release-f561d18.
Only the bridge and Vaultwarden image references changed. Both guarded helpers
validated exact prior image IDs and unchanged parsed Compose configuration,
then recreated only their respective service. Both containers became healthy.
The engine container was not replaced or restarted by this release.

- Web image: osiris-vault:0.2.0-agent-web-f561d18.
- Web image ID: sha256:82fc407ef671cbc3477ed32a973e7bd088439726c90fa627a8e37362d867b7fb.
- Bridge image: osiris-vault-agent-web:v2-f561d18.
- Bridge image ID: sha256:f529c2758ef53a27c07512325b99847da8692320945d8bcd620fec43686761a5.
- Engine image ID unchanged: sha256:da4f8215ffb14b1c4be0c497863acf2842b399282b67983474e8563802765039.

Web rollback Compose:
/opt/vaultwarden/compose.pre-agent-web-f561d18.yaml.
Bridge rollback Compose:
/opt/osiris-vault-agent-web-release-418d983/bridge-context/deploy/agent-vault-web/compose.pre-v2-f561d18.yaml.
Both prior images remain retained. A rollback was not exercised. To roll back,
review and restore the matching saved Compose to its original compose.yaml and
recreate only that service with --no-deps. Preserve all data and private config.
No engine/database restore belongs to an image-only rollback.

## Fresh recovery and data proof

Fresh encrypted Vaultwarden backup:
/opt/vaultwarden/backups/vaultwarden-20261022T201549126398Z.tar.age,
686440 bytes. The existing registered backup helper copied it off-host,
verified checksum, decrypted through its existing Keychain recovery identity,
and checked the isolated SQLite database and retained server signing key.
One existing user remained. The backup's short service pause completed normally.

Fresh encrypted companion backup:
/opt/osiris-agent-vault/backups/v2-20261022T201756Z/companion.tar.age,
676200 bytes. It includes consistent engine and bridge SQLite backups, existing
master input, CA, bridge config/token/manifest and previous bridge Compose.
Its off-host copy decrypted and both SQLite databases passed integrity checks.
Private off-host copies remain under the existing Osiris/Vaultwarden/backups
Application Support directory. No secret or secret-derived hash was published.
These are recovery-material/database checks, not a full service restore test.

After deployment a trusted bounded comparison against the encrypted companion
snapshot confirmed master input, encrypted master-key wrapping, CA files,
bridge config, manifest and worker capability remained unchanged. Counts stayed
253 accounts, 506 imported fields and 519 total fields. Config v1 still permits
only the existing owner. No team grant or live sync was activated.

## Acceptance state and browser blocker

Seven of ten allocated cases passed: the five assembled worker fixture cases,
manager case 6 for recovery/deployment/preserved inventory and case 7 for public
gates. Cases 8, 9 and 10 remain pending. No additional cases were allocated.

Public checks after activation passed: /alive 200; unauthenticated accounts,
requests/history and status 401; public worker claim 404; /admin 404; empty
registration 403. /api/config retains the same HTTPS Vault API/identity/
notification destinations. Public index bytes match the packaged hash above.

Authenticated UI discovery/rendering, authenticated history and the new real
GoDial login have NOT passed on this release. The historical d6070d4 acceptance
predates v2 and must not be presented as its regression proof.

This thread is mcp:cf5edef4-c277-4687-9482-2a692d405a16. Fresh server browser
tabs used the current osiris profile; old native UI showed Removed profile.
Repeated snapshot, resize, typing and navigation calls timed out, while some
DOM evaluation/status calls worked. The visible preview initially stayed at
Connecting. The owner attempted private sign-in but reported inability to type.
Native observation showed an empty master-password field and stale profile
label; it did not prove a working private-entry path. No password rejection,
password change, automatic unlock or new verified session is claimed.

The stale view was closed and another fresh server tab opened. Current tab at
handoff: tab_8_cfcdced4-c3b1-44a4-a351-f9c43e9c74cd, bound to this thread.
Do not operate it from another thread. Pranshi must open her own fresh tab.
The alternate in-app Browser returned Browser is not available: iab.
No personal Chrome automation, T3 restart/patch, token scraping, new master
password, secretRef workaround or protected Karen checkout changes occurred.

Standalone transport presence diagnostic still returned
blocked_external_dependency: supported ACP endpoint/authorization absent.
Keep the guarded chat relay. A new private owner unlock is required before
live authenticated UI checks; never ask for a master password or MFA in chat.

## Handoff to Pranshi

Osiris requested moving the remaining production work to Pranshi's computer.
This means release/integration ownership and remaining acceptance move to Raven;
the existing VPS remains production. This thread stops production/browser
mutations after publishing this record. No new chat or worker was created here.
Reuse the deployed artifact and exact images; do not rebuild or redeploy merely
to continue acceptance. Read this ledger before the older historical status.
