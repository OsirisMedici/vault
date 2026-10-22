# Vault v2 integration and release

## Owner and outcome

The original Osiris release thread succeeded manager
a9cfb71e-af79-472a-b333-a368756aeac2 under Osiris's explicit release
authorization. Its host was osiris.local, arm64; branch
work/agent-vault-integrated; clean starting revision 4203f58. Current ownership
and Raven observations are recorded below; the original deployment evidence
remains attributed to Osiris.

The existing owner can find a supported imported account, explicitly request a
login, and read bounded accurate history in the existing Agent access page.
Only signed_in with identityVerified true is success. Team grants remain
opt-in and dormant; live sync remains dormant pending a fresh owner export,
source verification, matching baseline and exclusive access. Existing 253
accounts, 506 imported fields and 519 total fields must remain intact.

## Fresh-chat handoff requested

On 23 October 2026, Osiris superseded the three-chat fast-plan continuation:
publish the relevant source/evidence, prepare the best existing capabilities and
recommended improvements, and continue Agent Vault in one new ordinary chat.
The [product and restart handoff](plans/agent-vault-product-handoff-2026-10-23.md)
records the source inventory, priorities, acceptance gates and private-access
dependency. This acceptance chat stops runtime/browser work and further ledger
mutation after that handoff. The previously settled chats stay settled.
Case 10 remains blocked; no login, runtime readiness, deployment or acceptance
result changed. The new chat must verify actual private readiness before any
dependent login work. The fast-plan section below is the historical routing.

## Previous fast-plan owner and pending case 10

On 23 October 2026 IST (22 October UTC), the user explicitly authorized exactly
three ordinary top-level Vault chats with serial mutation ownership: phase 1
private access mcp:ad1ade75-b290-43fe-9590-5ec77af69b31, phase 2 runtime setup
mcp:a2161692-a2e1-4bf9-90f9-ea1095f97994, and phase 3 final login acceptance
mcp:14b3d523-1f7a-4451-89ee-5d51446e8366. Phase 3 alone owns this ledger and
final release handoff. T3 reports the prior Raven owner
mcp:99d9d867-817b-4802-804e-5bd15c3e9e08 completed and settled. Its tab must
not be operated by the new owner; no further chats or workers are authorized.

Phase 3 independently verified pranshis-MacBook-Air.local, arm64, clean HEAD
c608434e1d941ee74ccd2b2b0c43c11df81e9b79, origin
https://github.com/OsirisMedici/vault and branch work/vault-fast-acceptance.
Shell cwd and T3 binding both resolve to
/Users/pranshisharma/.t3/worktrees/Vault/work-vault-fast-acceptance in registered
Vault project mcp:c40d6377-2cc6-489e-8f61-e98f2c2b9b7f. The provider/model/settings
remain codex_native, gpt-6.1-sol, reasoningEffort high, serviceTier default.
The indexed upstream/web gitlink remains d2a095eb800fe80a9bc524579b974796eae51994.
The ledger, release boundaries and existing guarded chat-session, chat-relay,
driver and web-request source were read; no source implementation changed.

Phase 1's informational dependency-blocked receipt reports Raven's Tailscale
self raven.tailf4bdfc.ts.net and Osiris peer online, but no authenticated private
access route. Its bounded strict-host-checking SSH probes returned:

- hostinger-osiris: exit 255, "ssh: Could not resolve hostname hostinger-osiris:
  nodename nor servname provided, or not known".
- osirismedici@osiris.tailf4bdfc.ts.net: exit 255, "ssh: connect to host
  osiris.tailf4bdfc.ts.net port 22: Operation timed out". This newer observation
  supersedes the earlier Connection refused observation, without clearing access.

The same receipt reports loopback ports 19431 and 19433 not connectable,
integration-v1 and the managed tunnel plist absent, and no callable private
provisioning interface. These are attributed phase 1 observations, not repeated
phase 3 probes. No private runtime content was read or tunnel/runtime started;
there is no new runtime lifetime. Standalone ACP is not a prerequisite.

The one pending owner action is to restore Raven's already-approved authenticated
private SSH route to the existing VPS as hostinger-osiris through trusted operator
setup with verified host trust, then report ready in phase 1. Credentials and
capabilities must stay out of messages. No new grants/users/SSH enrollment,
arbitrary key copying, public listener or T3 changes are authorized. Phase 2 may
configure managed loopback-only forwarding of the existing engine 19431 and
worker 19433 only after a verified access-success receipt. Phase 3 keeps its
runtime/browser/login gates closed until phase 2 hands off verified engine and
private worker readiness and runtime ownership.

Acceptance remains nine of ten aggregate cases recorded passed, with case 10
blocked; this is a test count, not product-readiness percentage. No browser tab,
request, credential fill or website login was started in phase 3 preparation.
The deployed f561d18 artifact and existing VPS engine remain frozen. After the
verified phase 2 receipt, case 10 alone will require:

1. Inspect current preview profiles and open fresh owned Vault/GoDial tabs;
   validate a benign input path before any needed private owner unlock. Stop for
   MFA, CAPTCHA or recovery.
2. Explicitly select GoDial businessabhish@gmail.com and create a new UI request;
   cancelled request bfef78c8-ef66-4c04-913e-35d00bd1dd5b cannot be reused.
3. Bind the exact current thread/tab/request through the existing guarded chat
   relay, verify exact GoDial identity and matching UI signed_in with
   identityVerified true, then verify clipboard compare-and-clear and close the
   temporary helper. Capture and inspect nonsecret saved screenshots.
4. Record actual results and tunnel lifetime here. A dashboard, queue or
   historical verified entry cannot pass this case. Success is an owner/chat-
   assisted login; team launch, live sync and unattended capability remain out
   of scope. No repetition of cases 1–9, rebuild or redeployment is authorized.

## Previous Raven release owner and external blockers

Verified on 23 October 2026 IST (22 October UTC): the sole replacement owner is
top-level thread mcp:99d9d867-817b-4802-804e-5bd15c3e9e08, titled
Vault v2 · Release owner · Raven. It has no parent/subagent relationship and
belongs to registered Vault project mcp:c40d6377-2cc6-489e-8f61-e98f2c2b9b7f.
T3 binding and shell cwd both resolve to
/Users/pranshisharma/.t3/worktrees/Vault/work-vault-v2-release-pranshi, branch
work/vault-v2-release-pranshi. Hostname is pranshis-MacBook-Air.local, arm64.
Tailscale status independently reports raven, raven.tailf4bdfc.ts.net, online.
No additional chat or worker was created.

The starting index/worktree were clean at
042424af120f25630c8e526ace1d98078aec21ce. Origin is
https://github.com/OsirisMedici/vault; a fresh ls-remote returned that exact SHA
for work/agent-vault-integrated. Raven's upstream gitlinks retain the recorded
pins but are uninitialized; no upstream checkout or generated build was created.
The main checkout remains at 1b7e6b14cc704c7622ce2c2edab8e86a3fb765fe with
its pre-existing untracked docs/plans/ preserved. Bun is 1.4.4 at ~/.bun/bin/bun.
The shared ~/.config/osiris-agent-rules/javascript-tooling.md is absent;
the user's Bun instructions apply. No install, compile or deployment ran.

A fresh tab owned by this release thread used the current osiris profile
profile-9be6f056-3046-4f5d-aaa7-8aba6f1a990f. Tab ID:
tab_5_974e2e35-7c59-468d-a962-f439b90d576a. Agent access redirected to #/login.
Real saved snapshots succeeded. A harmless example.invalid email was entered,
read back through the accessibility tree and inspected screenshot, then cleared
without submitting it. This proves an automation input path, not human private
entry or authenticated acceptance. The owner was asked to sign in privately.
Subsequent status showed #/2fa and a separate unclaimed recovery-route tab;
the release owner stopped authentication actions and did not inspect or operate
MFA/recovery. At the initial blocked handoff no authenticated session, recovery
action, password rejection or completed private unlock was claimed.
Saved login/input evidence remains in T3's
browser artifacts outside source. No earlier thread's tab was operated.

Presence-only runtime diagnostics found ~/.config/osiris-agent-vault and its
integration-v1 directory absent. Neither t3 nor osiris-accounts is on PATH;
~/.local/bin/osiris-accounts and the documented ACCOUNT-ROUTING.md locations
are absent. No saved account was used. All four ACP environment-presence flags
are false. The existing bounded transport diagnostic emitted
outcome:host_transport_unavailable, cliExitCode:null, browserAvailable:null,
nextAction:continue_chat_relay, and exited 2. This differs from Osiris's earlier
CLI missing-capability result because Raven has no callable t3 launcher.
The injected preview tools themselves are available and worked as above.

SSH configuration for hostinger-osiris falls through to hostname
hostinger-osiris and user pranshisharma; BatchMode SSH failed exactly:
"Could not resolve hostname hostinger-osiris: nodename nor servname provided,
or not known". Tailscale reports Osiris online, but a bounded BatchMode SSH
attempt with StrictHostKeyChecking=yes to osirismedici@osiris.tailf4bdfc.ts.net
failed exactly: "connect to host osiris.tailf4bdfc.ts.net port 22: Connection
refused". No host trust, credentials, account access or network exposure changed.
A focused available-tool search found no callable private runtime provisioning
or transfer capability. The existing chat-session/chat-relay source is present,
but cannot start its credential runtime without private configuration/access.

The owner subsequently completed private authentication and reported done.
Cases 8–9 were exercised as recorded below. The remaining external prerequisite
is a supported authenticated private transfer/provisioning route for case 10.
The latter must supply only the existing approved engine configuration/member
capability, import metadata manifest and private bridge worker configuration/
capability, adapting host paths privately and preserving owner-only modes.
Reach the existing engine and worker listeners through validated private access
or loopback tunnels; do not copy T3/browser state, vault exports, master input,
backups, Keychain or an entire private directory. Do not initialize an engine,
create grants or substitute a generic bearer/secretRef for browser transport.
Standalone ACP remains optional: the approved guarded chat relay is sufficient
once its private runtime prerequisites exist.

Acceptance is now nine of ten allocated cases passed: seven inherited from the
original release record plus the real Raven checks for cases 8 and 9 below.
Case 10 remains blocked. The one new GoDial queue/cancel lifecycle check did
not invoke the credential executor or attempt a website login. No clipboard
credential fill occurred. These checks reuse the existing allocations, with
no broad suite or new identity. VPS image/container,
inventory and recovery claims below were not independently rechecked from Raven.
The existing production URL remains
https://vault.scaleadvertisement.com/#/agent-vault; no replacement server or
preview was started. Source changes remain evidence/ownership only; the one
authenticated request/cancellation is the bounded acceptance mutation below.

### Authenticated Raven acceptance follow-up

On the owner's done response, this exact owned tab was on #/agent-vault.
The rendered page showed the existing owner, 253 imported accounts and two
supported choices. Authenticated GET accounts, status and requests all returned
200. No token/storage inspection or programmatic private unlock was used.

Case 8 passed the bounded discovery/render/session check. An unmatched local
search showed zero choices and its explanatory message; an uppercase exact
target username search showed one. Combining that search with ClickUp showed
zero, Clear filters restored two, and GoDial alone showed one. The imported
account remained explicitly unselected with a disabled Request sign-in control
until the target GoDial option was clicked. Selection then showed exact username
businessabhish@gmail.com and origin https://app.godial.cc, enabling the control.
Filtering/selection generated no additional Agent access API calls.

Actual DOM viewport measurements were 1440 x 1000 and 390 x 844, despite the
resize receipt's stale 1280 x 800 viewport field. Saved screenshots and the
accessibility tree reflected the requested widths. At 390 pixels document width
was 390; main client/scroll widths both 384 and form client/scroll widths both
326. Controls, account details, request outcome and history wrapped/readably
scrolled without horizontal overflow. The selected dropdown label ellipsizes;
the exact username remains readable in the details below.

A deliberate full location.reload() returned #/lock?promptBiometric=true.
The locked screen replaced the account selector, history and Agent access
component; none remained in the new document. Subsequent bounded checks showed
zero Agent access resource requests since reload. This verifies reload-induced
lock/session clearing, not a separate in-place lock/logout race or account-switch
test. No automatic unlock or private password entry was performed by the agent.

Case 9 passed one real queue/cancel lifecycle and bounded read-only history.
Before mutation, Refresh history issued GET /api/agent-vault/requests 200 and
retained exactly the two existing historical outcomes without executing work.
The historical verified login is explicitly not new v2 login acceptance.
One click of Request sign-in created request
bfef78c8-ef66-4c04-913e-35d00bd1dd5b (POST 201), for the exact selected GoDial
account. Its panel/history accurately said Queued — not verified. Polling used
GET on that same request ID (200). One Cancel queued request click returned
POST /requests/bfef78c8-ef66-4c04-913e-35d00bd1dd5b/cancel 200. The panel said
Cancelled and removed the cancel control. A fresh history GET 200 returned the
same request as Cancelled at the top, followed by the two older outcomes,
with the same ID/expiry/provider/username. Three rows were observed within the
25-row bound; no 25-record live boundary population was generated. This fresh
GET establishes persisted cancellation before the subsequent reload locked the
Vault. No working/signed_in completion was manufactured or claimed.

Real saved evidence was inspected in T3's browser artifacts outside source:

- Desktop discovery: browser-screenshot-vault-scaleadvertisement-com-mvk0800d-3369b67b.png.
- Desktop explicit selection: browser-screenshot-vault-scaleadvertisement-com-mvk08wj0-a90046ce.png.
- Desktop cancelled outcome/history: browser-screenshot-vault-scaleadvertisement-com-mvk09aae-6ea90aa0.png.
- Narrow discovery: browser-screenshot-vault-scaleadvertisement-com-mvk09km5-e6b513f7.png.
- Narrow details/cancelled outcome: browser-screenshot-vault-scaleadvertisement-com-mvk09z82-7b6cf71b.png.

After private executor access is provisioned, resume only case 10 in this same
thread. Select only GoDial businessabhish@gmail.com in a privately unlocked
Vault, create its new request and bind that opaque ID to a fresh owned GoDial
tab. Use the guarded chat executor, stop for owner verification when necessary,
require the exact website identity and matching UI signed_in with
identityVerified true, then verify clipboard cleanup. The cancelled request
cannot be reused. A queue, dashboard URL or historical login never passes case 10.

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

## Original Osiris acceptance state and browser blocker

At the Osiris handoff, seven of ten allocated cases passed: the five assembled worker fixture cases,
manager case 6 for recovery/deployment/preserved inventory and case 7 for public
gates. Cases 8, 9 and 10 were pending there. The current Raven results above
supersede that pending state for cases 8 and 9. No additional cases were allocated.

Public checks after activation passed: /alive 200; unauthenticated accounts,
requests/history and status 401; public worker claim 404; /admin 404; empty
registration 403. /api/config retains the same HTTPS Vault API/identity/
notification destinations. Public index bytes match the packaged hash above.

At that handoff, authenticated UI discovery/rendering, authenticated history
and the new real GoDial login had NOT passed. The historical d6070d4 acceptance
predates v2 and must not be presented as its regression proof.

The original Osiris thread is mcp:cf5edef4-c277-4687-9482-2a692d405a16. Fresh server browser
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
