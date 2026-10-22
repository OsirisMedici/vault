# Engineer 2: imported account selection and private credential connector

You are one of four independent engineers implementing the shortest practical Vault + Infisical Agent Vault integration. Osiris is the owner; the manager is thread a9cfb71e-af79-472a-b333-a368756aeac2. The user explicitly authorized three separate implementation chats/worktrees, then a FOURTH immediate Bitwarden bulk-import chat. All four must work independently. Speed matters. This is implementation, not a research-only assignment.

FIRST:
1. Inspect pwd, branch and Git state and read AGENTS.md in this T3-bound worktree.
2. Read docs/plans/agent-vault-four-engineer-delivery-2026-10-22.md and integrations/agent-vault/CONTRACT.md completely. The interfaces and the ten-case budget are frozen.
3. Read your assigned prompt in docs/plans/agent-vault-dispatch/. Consult docs/agent-vault-evaluation-2026-10-22.md only for existing evidence. Do NOT repeat historical upstream tests.
4. Begin the smallest working implementation in your owned files. Use injected peer interfaces/dummy fixtures, so you never wait for another engineer's code.

COORDINATION:
- Do not spawn subagents or more chats.
- Do not message, read the chat of, edit the worktree of, or pull/cherry-pick from another engineer. Do not negotiate interfaces with peers.
- Route a material blocker or contract change ONLY to manager using t3_thread_send on a9cfb71e-af79-472a-b333-a368756aeac2, mode auto, with a unique stable clientRequestId. Keep the report nonsecret and propose the narrowest fix.
- Manager owns integration, root-level docs and final real provider login tests. Do not wait for a reply when you can keep implementing independent parts.
- On completion commit your owned nonsecret source on the assigned branch. Return SHA, file list, run command, allocated check results, assumptions and concrete blocker if any. Send the same bounded handoff to manager. Do not push/open a PR.

PRODUCT:
Existing Vault and its signed Bitwarden desktop app remain. Agent Vault is the complete pinned companion engine, not rewritten cryptography. The fourth engineer imports all eligible source passwords into the running engine and writes a private metadata manifest. The first version uses that imported snapshot. Live Bitwarden synchronization and new Touch ID/native enrollment are deferred. A small host-side login tool must use stored credentials without putting them in model messages, then verify the correct website account. First routes ClickUp and GoDial only.

EVIDENCE:
- Main source baseline before this plan adf6d29dd68b59eb10fe51975844a7018d0a49d6; your planning baseline also contains the manager docs/contracts.
- Upstream Agent Vault v0.40.1 d5836ec3bb2315de38043d742ae5daca11a4944a.
- A clean read-only source is /tmp/vault-agent-vault-eval.rIoisH/upstream. If unavailable obtain that exact commit externally. Do not initialize all large upstream submodules needlessly.
- Existing binary /tmp/vault-agent-vault-eval.rIoisH/agent-vault-preview. Source-path isolation only differs from upstream; credential/auth/proxy logic was not changed.
- Live trial API 127.0.0.1:18431, proxy 18432; contains REAL passwords. ENGINEER 4 IS THE ONLY WRITER during import. Do not stop/restart/read its private controls or actual credentials. Your checks use own dummy state or injected fixtures.
- Existing VPS alias hostinger-osiris has healthy osiris-vaultwarden. Read-only Docker inspection requires sudo -n. No other service enumeration/mutation needed.
- Existing old Vault MCP reports native_adapter_required; the installed T3 lacks that accepted native adapter. This task does not wait for the old native/signing effort.
- The successful real website pilot used a privileged private-paste helper; it was not generic proxy-only website login. Generic proxy strips Set-Cookie.
- Default bw CLI is unauthenticated independently of desktop. Do not start auth loops or claim desktop unlock gives a bw session.
- ClickUp expected source username scaleadvertisement@gmail.com, GoDial businessabhish@gmail.com. Manager handles their real private sign-ins. Do not change provider accounts.

BOUNDARIES:
Use purpose-built APIs/CLIs first and T3 preview/in-app Browser for web work. No personal Chrome, arbitrary browser engine workaround, T3 app patch/restart/replacement, official Bitwarden modification, Keychain extraction, or Karen protected-checkout edit. Read docs/operations.md for VPS-related files. Read docs/desktop.md only if considering desktop changes, which are deferred here.
No secrets in source, fixtures, terminal/tool output, shell argv, MCP JSON, eval scripts, reports or model context. Trusted host code may handle secrets internally. Project data/runtime/export paths stay outside every checkout. Source-only examples use example.invalid and dummy values.
Current design is a same-user workflow boundary, not protection from fully unrestricted host access. Do not overclaim, but do not turn this sprint into unrelated hardening or broad audit.

CHECK LIMIT:
There are at most TEN acceptance cases total, not ten per chat. You may implement/run only your assigned cases. No broad npm test/upstream suites/test matrix/100 subtests. Narrow syntax/build/secret checks are fine. Repeat a failed allocated case only after a fix, and record the repeat. Stop expanding scope when your owned deliverable works.

End every final user-facing reply with exact words over and out, only when done or genuinely blocked.

ASSIGNMENT:
Branch work/agent-vault-credentials.
Own ONLY integrations/agent-vault/credentials/ and docs/agent-vault-credentials-handoff.md.

The fastest v1 uses the authorized bulk-import snapshot. Engineer 4 owns reading Bitwarden, native export reauthentication, all runtime import writes and import-manifest.json. YOU DO NOT need to unlock Bitwarden or import passwords. Do not start a second native prompt or CLI enrollment. Live Bitwarden sync is deferred.

Implement credentials/provider.mjs exporting createCredentialProvider({engine,manifestPath,now?}) exactly as CONTRACT.md. Expose status, findAccounts and withCredential. The private manifest is version1 with vaultName bitwarden-import-20261022 and account metadata rows {accountId,name,username,origins,credentialRef,sourceItemId?,importedAt}. Validate file owner/mode, no symlink, bounded size and schema. Do not print its account inventory or read unrelated private config.

Search approved name/username/origin metadata, use exact normalized HTTPS origins without wildcards. Preserve duplicate source records as distinct account IDs. Return multiple candidates rather than guessing. withCredential must validate account membership and origin before engine.withLogin, then compare engine username to the manifest and invoke the internal consuming callback. Never expose password in public result/error/status. If source manifest missing, return import_required and keep status honest. Never infer a new web permission from a URL found in the imported data.

Write a small runnable smoke entrypoint or documented Node call suitable for manager integration. Build immediately against a temporary dummy manifest and injected fake engine. Do not wait for actual engine/import. Do not change engine/client.mjs, browser code, shared contract, old MCP, source vault or import-manifest.json. If any contract field is insufficient, send one bounded manager message and finish independent implementation.

Your ONE acceptance case is C03: a bound fixture account and exact origin resolve through the injected engine and pass its credential only to the internal consumer while public metadata stays secret-free. No test matrix or full suite. Use this one case to establish the contract path, not a broad hardening program.

Handoff should include SHA, owned paths, exact module instantiation, fixture invocation, C03 result, missing config errors and any integration issue. State imported snapshots can become stale until explicitly refreshed. No real website login or private export action in your chat.
