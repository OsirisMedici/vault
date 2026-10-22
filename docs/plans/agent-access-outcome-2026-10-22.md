# Vault manual desktop and agent login outcome

Updated 22 October 2026 from Osiris's explicit outcome and approvals in thread ef6fcce8-bcd5-4a84-88a7-6ee438f468dc.

## Outcome

Osiris can open Vault on his Mac, search an account such as Slack, and manually use its username/password and website link. T3 agents have a persistent discoverable MCP connection to request the same account and complete a supported website login through a trusted host. Ordinary tool results and model context contain account metadata and bounded states, not passwords or sessions. A connected service remains subject to the user's authorization for subsequent actions.

The experience should be select the correct account, approve unlock when required, fill the intended website, and verify the signed-in identity. Website MFA/passkey/CAPTCHA may require the owner. An always-available MCP connection does not mean an always-unlocked vault.

Osiris selected the existing configured GoDaddy route for the first real MCP login acceptance. Other providers remain outside that first auth test.

Manual Mac delivery changed after desktop acceptance work: Osiris selected the signed official Bitwarden app connected to the same self-hosted Vault server. The desktop owner observed it open and signed in, with Sync now recorded at 2026-10-22T14:27:10.740Z. Specific item/copy/edit and fresh biometric acceptance remain untested. The branded derivative remains blocked by native framework/team-identity checks and Gatekeeper; preserve its source without weakening runtime security or replacing the accepted official client. This manual-client decision does not solve the T3 protected browser bridge.

## Approval and present scope

Osiris approved audit issue 01 (daily T3 connection) and 04 (saved-session lifecycle fix), and explicitly requested a new chat for each approved number. This supersedes the older single-chat-only coordination rule for these two workstreams. Existing historical workers and former coordinator are settled; preserve their records. Current launch coordinator is the thread above.

The native Mac workflow and persistent MCP/browser connection are now the product target. Inspect and reuse the existing desktop build and protected-login prototype. Do not assume the earlier experiment is the only viable integration architecture: prefer a supported independent MCP connection if it meets protected browser-fill requirements and avoids changing signed T3 binaries. If native T3 integration is necessary, explain the concrete prerequisite and prepare a reviewable compatible candidate before an installed-app replacement.

Team workspaces, sharing redesign, unrelated desktop integrations and universal browser support are not prerequisites for the first accepted login. The requested long-term goal is broad browser/site support; report actual adapters and unsupported surfaces accurately. Current instructions permit agent automation through T3 preview or the in-app Browser, and exclude personal Chrome.

## Ownership

Active implementation chats:

- Issue 01: `mcp:55b05fc7-4520-4bd8-acb5-282aec0eb039`, Vault 01 - Persistent MCP and browser login.
- Issue 04: `mcp:0a745bfc-bc85-4cdd-a043-33a0dc868ef6`, Vault 04 - Reliable unlock and saved sessions.

Both were launched with an explicit root workspace binding. Issue 01 acknowledged ownership and began inspecting the daily T3 compatibility path. Launch is not implementation or native acceptance proof.

Issue 01's inspected compatibility target is installed Nightly `0.1.2-nightly.20261022.3512`, embedded source `3b95e7831b11`. The protected prototype source remains at `8d3b061121fe65669d5d43d011b48cd3027a4108` with uncommitted edits. Prepare a generated candidate against the installed revision; preserve both original source and live data. The current public preview interface has no supported protected-fill/session-import adapter. An independent MCP's metadata tool is an intermediate artifact until the compatible native bridge is delivered and accepted.

Issue 01 chat owns the connection architecture, new Vault MCP integration code/config, account metadata lookup and ambiguity handling, provider/browser bridge, request status and the sole integration-runtime lifecycle. It may edit protected integration files outside the issue 04 list after reading their existing handoffs. PrivateVaultLogin.ts and its tests remain issue 01's files; request lifecycle review from issue 04 rather than concurrent edits. Preserve existing dirty work and public/private boundaries.

Issue 04 chat exclusively owns VaultCli.ts, VaultCli.test.ts, VaultDeviceUnlock.ts and VaultDeviceUnlock.test.ts in the existing Karen integration source. The known cleanup/bw lock fix is already implemented with recorded tests. Verify the current fix, correct only demonstrated remaining lifecycle defects, and hand exact changes/acceptance needs to issue 01. It does not launch competing runtimes or edit the browser owner's files.

Both chats use the existing Vault root as their T3 workspace and respect these explicit external-source boundaries. New worktrees from HEAD do not contain the dirty integration. Checkpoints, if needed, contain only reviewed non-secret source. Preserve original upstream checkouts, official Bitwarden app, Keychain enrollment, T3 chats/data and private profiles. Source publication, installed-app replacement and server deployment remain distinct reviewed actions.

## Evidence and first steps

1. Read AGENTS.md, docs/desktop.md and docs/testing.md. Read .local/context/single-chat.md for the latest handoff, then lock-lifecycle-fix.md and the relevant browser/lifecycle file. Stop using stale runtime PID receipts.
2. Inspect active source and actual available tools. The signed-in Vault web page in this launch thread is proven; it is not protected-login acceptance. Daily Nightly has no preview_vault_login in its current catalog. The isolated test runtime was stopped.
3. Choose and record the minimum viable connection compatible with the actual daily T3 version. Record the target files, browser bridge and a source/build delivery receipt. Use current MCP configuration/connection discovery, not an ad-hoc patch of a signed app.
4. Implement and run focused checks. Coordinate contracts across the two chats. Fixture results are source evidence only.
5. Prepare one coordinated native/private acceptance after a functioning target connection exists. Ask for private human input only when the exact ready control needs it. Do not repeat password/enrollment loops to compensate for a missing integration.

## Completion

Issue 04 source milestone: owner reports 109 owned CLI/device tests, desktop typecheck, scoped lint and formatting passing. New fixtures reproduced cancellation during filesystem preparation, cancellation between enrollment commands, and unlock after failed removal. Fixes preserve ordinary request lock without CLI session invalidation; explicit removal waits for local deletion and CLI revocation and blocks restore on failure until retry. Added `searchAccounts(query)` returning bounded metadata only. The combined browser suite still had one early-load/readiness test race assigned to issue 01. These are fixture/source results; native and installed integration acceptance remain pending.

- Native desktop: use the owner-selected signed official Bitwarden client against the same Vault server. Signed-in/sync observation exists; accept the manual search/open/copy workflow and any specific biometric/edit behavior separately. A branded derivative is not a prerequisite for the first MCP login.
- MCP: registered and discoverable in daily T3; metadata search resolves requested service/account and asks on ambiguity; no real-secret tool output.
- Login: one supported target tab/site, explicit account binding and current authorization, private unlock/approval, host fill, exact provider identity check. An opened URL or ready_to_verify state alone is insufficient.
- Lifecycle: ordinary request cancellation clears memory/private work without invalidating future enrolled restore; next request requires intended approval; restart restoration and explicit local removal are verified separately.
- Delivery: report exact source/build/config, tests, supported browser/provider coverage, installed status, pending human checks, and rollback/removal procedure. No universal-site/browser or completed-release claim from a fixture build.
