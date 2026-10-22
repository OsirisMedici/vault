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

## Build, deployment and live ledger

Pending. One serialized local production build is authorized as the reviewed
Bun 1.4.4 orchestration / Node 26.12.0 Angular compiler path. GitHub manual
production dispatch is unavailable until the workflow exists on the default
branch; main will not be merged to manufacture that prerequisite.

A fresh chat-owned browser tab uses the existing osiris profile. Its current
Vault session requires private owner login/unlock. Standalone transport and
automatic unlock remain separate external prerequisites, not release claims.
