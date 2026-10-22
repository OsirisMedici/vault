# Agent Vault: what to keep, what to build, and the fresh-chat handoff

23 October 2026. Source-backed product proposal and restart handoff requested
by Osiris. This supersedes the three-chat fast-acceptance routing for future
work. It does not claim another login, deployment or completed product.

## What we are building

One dependable way for Osiris to ask a chat to use the correct saved account,
privately complete any required approval, and see an accurate result. Later,
an owner can grant a person or agent narrowly defined access to selected client
accounts and remove it without disrupting everybody else.

Reuse this Vault repository, its existing deployed page and the pinned Agent
Vault companion engine. Keep Vaultwarden as the human password source of truth.
Make the connection between those parts dependable before adding more storage,
providers or a new visual identity.

The finished owner experience is: ask for GoDial, choose the intended account
when needed, approve privately if required, then see either the exact verified
identity or one clear explanation of what needs attention. A new chat should
not require the owner to coordinate several setup conversations.

## Current truth and evidence precedence

- Production entry point: https://vault.scaleadvertisement.com/#/agent-vault.
  This is the existing URL, not a new live check in this handoff.
- [The release ledger](../agent-vault-v2-release-2026-10-23.md) is authoritative
  for deployment and acceptance. It records nine of ten aggregate cases passed,
  with case 10 blocked. This is not a product-readiness percentage.
- Raven's actual discovery/filter/selection, desktop/narrow rendering,
  reload-induced lock clearing and queue/cancel/history checks passed as
  recorded there. Historical successful logins are separate from case 10.
- The remaining case is one new GoDial login for businessabhish@gmail.com,
  exact identity verification and matching UI signed_in with
  identityVerified true, plus clipboard cleanup. Request
  bfef78c8-ef66-4c04-913e-35d00bd1dd5b is cancelled and cannot be reused.
- Phase 1 reported no authenticated private SSH route from Raven. The
  hostinger-osiris alias did not resolve; the Osiris peer's port 22 timed out.
  Phase 2 has not handed off verified engine/worker readiness. Both preparatory
  chats are settled. A fresh chat does not clear this dependency.
- Existing f561d1862dc95d86689585f080acedf12e6fc3a7 artifacts stay frozen:
  web osiris-vault:0.2.0-agent-web-f561d18 and bridge
  osiris-vault-agent-web:v2-f561d18. The existing VPS engine stays unchanged.
- The ledger records preserved inventory of 253 accounts, 506 imported fields
  and 519 total fields. This handoff did not reread private inventory.
- Older READMEs/audits mix initial Mac, later VPS and source-only stages.
  Use their implementation descriptions, but do not promote old status text
  over the newer ledger. Recovery receipts do not prove a full live restore.

## The strongest things already here

1. **An existing password product and deployment.** Vaultwarden, the Vault web
   surface and the official signed Bitwarden client already have distinct
   roles. Preserve the working client, data and Keychain enrollment.
2. **A reusable credential engine.** The pinned companion provides a foundation
   for credentials, users/agents, vault grants, service rules and API proxying.
   Upstream proposals, OAuth and other features remain source-reviewed or
   separately evaluated; they are not all accepted Vault product features.
3. **A mapped imported account snapshot.** Stable source IDs, private metadata
   lookup and exact origin/account checks avoid sending the password collection
   to the model. Import is not automatic synchronization.
4. **A useful Agent access page.** Local search, provider filtering, explicit
   account selection and disabled unselected submission are implemented, with
   real Raven render/interaction evidence. Keep these behaviors.
5. **Honest request states.** Queued, working, verification required, rejected,
   failed, cancelled, expired and identity-verified outcomes are distinct.
   Queueing and historical success do not imply a current signed-in session.
6. **A guarded browser executor.** Account selection is bound to the exact
   thread, tab, origin, URL/control generation and short lifetime. Ownership,
   focus, fixed provider fields and destination are checked before use.
7. **A supported chat relay.** Existing chat-session/chat-relay code uses
   injected T3 tools. Passwords remain inside trusted code and the intended
   browser/clipboard path; standalone ACP is optional for this route.
8. **Exact provider identity checks.** ClickUp and GoDial have fixed adapters
   and expected-email comparison. Their earlier real-account acceptance is
   recorded separately; Raven's final v2 GoDial case remains pending.
9. **Bounded history and cancellation.** The UI reads current-user history
   without executing it. Backend history is capped at 25; Raven's real
   queue/cancel/persisted-history check is recorded in the ledger.
10. **Opt-in permission groundwork.** Bridge policy v2 has explicit
    user/account/provider grants, isolation, grant rechecks and revocation
    transitions. Production remains the existing owner-only configuration;
    real team activation and an authenticated admin UI are unfinished.
11. **Guarded sync groundwork.** Reviewed plan/apply, private baseline, changed
    field updates and interrupted-operation handling exist. Live use still
    requires fresh authorized source acquisition, verified identity, matching
    baseline and actual exclusion of other credential consumers.
12. **Recovery and release discipline.** Pinned upstreams, generated candidates,
    Bun tooling, build receipts, preserved attribution, retained images and
    encrypted recovery evidence provide a base for controlled maintenance.
13. **A separate action-policy foundation.** Published feat/team-agent-access
    at 4663d39 has scoped connections, approval consumption, leases, replay
    prevention, revocation and audit fixtures. Its real authorize method always
    denies integration_unavailable. Reuse the design after review; do not call
    this an integrated or working authorization service.

## What to build next, in order

These are recommendations for a later scoped implementation, not permission to
activate them now. First finish the existing owner workflow; then team use;
then broader automation. Each item has a concrete completion condition.

1. **One visible readiness check and recovery path.** Present separate states
   for Vault lock, private connection, engine, worker, browser and account
   readiness. Return one useful next action for the failing layer. Reuse
   existing bounded status/reason codes, but do not equate public health or
   metadata readiness with executable readiness. Success: a missing worker
   prevents a misleading login attempt and identifies the operator action;
   a new chat sees the same accurate state without repeated probes.
2. **Supported device enrollment and managed private connectivity.** Provide
   a trusted operator-owned way to enroll a permitted Mac and maintain the
   approved private route, with renewal and explicit disconnect. No pasted
   capability values or copied T3/browser state. The present SSH route must be
   restored by the trusted operator first. Success: a newly authorized device
   reaches the existing engine/worker after normal startup without runtime
   initialization, reimport, public ports or multi-chat setup.
3. **One complete login action with an understandable handoff.** Join account
   choice, explicit request, executor binding and final verification into one
   owner flow. Preserve duplicate/uncertain-request protections; never retry
   a submission blindly. Stop for private MFA/CAPTCHA/recovery and require
   identity proof afterward. Success: a fresh GoDial request ends in matching
   website identity and UI verified success, with no secret in tool output.
   This is the first acceptance gate before expanding the product.
4. **Private browser fill with stronger separation.** Prefer a supported trusted
   browser private-fill interface over the shared system clipboard when such
   an interface is actually available. Keep the guarded relay as the current
   bounded route. Separate privileged credential custody from unrestricted
   agent code. Success: wrong-tab/control/origin changes deny use, secrets do
   not enter model-visible arguments, and cleanup/crash behavior is verified.
   Existing same-user clipboard code is not a strong local isolation boundary.
5. **A clearer account catalog and login status.** Make provider, account,
   client/workspace context, support status and snapshot freshness easy to see.
   Client labels help selection but never grant access. Show current session
   verification separately from a historical login. Success: ambiguous accounts
   require a choice, unsupported entries have an explanation, and switching
   identity/locking clears sensitive account state and stale responses.
6. **Owner-managed people and agent permissions.** Add authenticated grant
   review/admin UI on top of the existing explicit policy. Distinguish human
   native password sharing from agent login/use permission. Bind each device
   or agent connection to a verified identity; do not trust an entered owner
   UUID. Reconcile the separate action-policy design with bridge policy before
   integrating it. Success: A can use only its selected account/action; B
   remains isolated; removing A preserves B and unrelated grants. No real
   onboarding belongs in the current handoff.
7. **A real activity and access review.** Explain who requested which action,
   the approved scope, verified outcome, failure reason, and revocation/cleanup
   state. Add owner-authorized access to a deliberate retention policy rather
   than mistaking the current bounded history or one-hour audit for a durable
   audit product. Success: an owner can trace one request and revocation without
   passwords, tokens, raw responses or secret-derived hashes in the report.
8. **A safe credential refresh workflow.** Productize the existing sync
   plan/review/apply path with visible freshness, conflict and recovery states.
   Establish source identity, custody and real consumer exclusion first.
   Automatic sync requires a separately supported source/unlock integration;
   the current adapter uses an explicitly authorized export. Success: one
   approved changed pair updates without reimporting the whole collection,
   missing/unowned records stay untouched, and interruption can be reconciled.
9. **Repeatable recovery and maintenance.** Turn the existing receipts into
   a rehearsed isolated restore procedure, capability renewal, update ownership
   and nonsecret health reporting. Preserve data separately from image rollback.
   Success: recover an isolated copy and verify owned counts, decryption and
   the intended login flow before claiming disaster-recovery acceptance.
10. **More providers and named API actions.** Expand only after the first two
    adapters are repeatable. Each provider needs fixed allowed origins, private
    verification handoff, exact identity proof and a small relevant test set.
    API actions should constrain method/input and reconstruct approved outputs;
    generic proxy injection alone does not prove response non-disclosure.
    Login permission must not implicitly authorize sends, purchases or edits.
11. **Native approval and a consistent Vault identity.** Later evaluate a
    separately signed helper with private enrollment and Touch ID, then consider
    Agent Vault UI branding. Signing, custody, cancellation and human biometric
    acceptance come first. Fingerprint-only agent unlock is not implemented;
    never rename/replace the accepted signed Bitwarden installation to achieve
    branding. A reskin should follow a reliable workflow.

## Implementation and acceptance sequence

For the fresh chat, begin with the existing source and blocker record only.
Do not rebuild, redeploy, install dependencies, restart/initialize an engine,
reimport, rotate credentials, add users/grants or create another worker/chat.
Keep the existing build, private data, SSH host trust and Karen integration
intact. Feature implementation needs a later selected scope.

Once a supported private access/runtime readiness receipt actually exists,
the one existing login case may resume in fresh owned T3 tabs using current
profile discovery. Use only Vault and fixed app.godial.cc, no old thread's tab,
personal Chrome, standalone Playwright, storage/token inspection or secretRef
workaround. Owner secrets are entered privately in a working page. Stop for
MFA/CAPTCHA/recovery. Save and inspect nonsecret real screenshots, verify
clipboard compare-and-clear, close the temporary relay and report runtime
lifetime. Do not repeat cases 1–9 or broaden testing to prove the roadmap.

## Source publication and fresh-chat boundary

The handoff is published only on work/vault-fast-acceptance. It contains the
assembled v2 source and ledger history. Worker browser/sync/UI/permissions/CI,
results, release and the separate team-access foundation branches were already
present on origin at their recorded local source revisions. The access/runtime
worktrees were clean at the common published base; they had no unique edits to
collect. Local main remains untouched, as do all other branches and T3 refs.
Source publication is not deployment or permission to publish private config.

Start exactly one ordinary top-level chat in registered Vault project
mcp:c40d6377-2cc6-489e-8f61-e98f2c2b9b7f, with a new worktree based on this
handoff's committed branch. The new chat becomes the sole continuation owner.
The prior access/runtime/release chats stay settled; this chat stops browser,
runtime and ledger mutation after handoff. Launch acceptance is not runtime or
login completion. Exact final commit/remote SHA and the new chat link belong
in the completion message rather than in their own commit contents.

## Evidence used

- [Current release/acceptance ledger](../agent-vault-v2-release-2026-10-23.md).
- [Integration guide](../../integrations/agent-vault/README.md) and
  [internal contract](../../integrations/agent-vault/CONTRACT.md).
- [UI](../agent-vault-ui-v2.md), [browser hardening](../agent-vault-browser-v2.md),
  [permissions](../agent-vault-permissions-v2.md), [sync](../agent-vault-sync.md),
  [CI/build](../agent-vault-ci-v2.md) and [recovery](../agent-vault-recovery.md).
- [Earlier product direction](agent-vault-next-steps-2026-10-22.md) and
  [human team/workspace proposal](team-workspaces.md), both subject to their
  stated acceptance and implementation limits.
- Separate published foundation: feat/team-agent-access at
  4663d39cc68a3e573a60c0b5a4e5581e25dd17d0,
  docs/team-agent-access-implementation.md and vault_access/policy.py. It is not
  imported into this branch or active deployment.
- Local controller/driver/providers/web-request, runtime factory/status and
  bridge permission/request implementation were inspected. No live credentials,
  runtime configuration or browser session was accessed for this proposal.
