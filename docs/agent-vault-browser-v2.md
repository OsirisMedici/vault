# Browser phase two source handoff

23 October 2026. This work helps the owner recover from an unavailable or changed
provider tab while preserving the demonstrated chat-assisted sign-in route.
The connector checks the intended thread and tab before retrieving credentials.
The owner must explicitly choose an account again after navigation or a change
in control. It never silently replaces a tab, account, origin or browser.

## Checkout and scope

- Physical host: `osiris.local`, computer name `osiris`, arm64.
- T3 binding and shell cwd:
  `/Users/osirismedici/.t3/worktrees/Vault/work-vault-v2-browser`.
- Branch: `work/vault-v2-browser`.
- Exact starting HEAD and merge base:
  `9598603d763dd2e092da7da78a4f346e2d3aca98`.
- The existing `OsirisMedici/vault` remote reported that exact SHA for
  `work/agent-vault-integrated`. Starting index/worktree were clean.
- Integration manager: thread `a9cfb71e-af79-472a-b333-a368756aeac2`.
  Only the manager assembles, deploys and runs real acceptance.

Owned changed files under `integrations/agent-vault/browser/` are
`controller.mjs`, `driver.mjs`, `failure.mjs`, `providers.mjs`, `public.mjs`,
`web-request.mjs`, `mcp.mjs`, `check-transport-readiness.mjs` and
`acceptance-v2.test.mjs`. This document is the only changed path outside that
directory. Final commit and remote verification belong in the completion
handoff, since embedding the final commit in its own content is circular.

The relay protocol, `chat-session.mjs`, `chat-relay.js`, runtime credentials,
engine, bridge/UI contracts and provider enum remain unchanged. No dependencies
were installed or changed. All new source keeps the repository's GPL-3.0-only
license; upstream code, pins and attribution were preserved.

## Changed behavior

`driver.inspect` accepts an optional internal `threadId` alongside `tabId`.
When supplied, it verifies the exact tab's thread through the existing bounded,
paginated `t3_preview_list` route. It also returns internal control generation
and dialog/file-chooser availability. These fields do not enter public results.
This is an additive browser-internal argument/result extension; existing callers
using only `tabId` still work. The manager should retain these extensions when
assembling alternate injected drivers.

Selections retain the inspected URL and control generation as well as the
existing exact account/thread/tab/origin binding and five-minute maximum TTL.
Sign-in rejects closed/replaced tabs, changed URLs, changed control generations,
foreign threads, human/other-agent ownership and blocking dialogs before
`withCredential`. A rejected handle remains consumed. A second inspection after
engine I/O prevents a change during retrieval from reaching `fillLogin`.
Post-verification checks also require unchanged control generation.

The driver still rechecks exact origin, ownership, generation, native focus,
fixed fields and the submit container before secret entry and submission.
Secrets enter only the injected/native clipboard implementation, followed by
Meta+V. Clipboard compare-and-clear, serialization and the exclusive lock remain.
No new tool, caller-provided expression, fallback browser or redirect is allowed.

Bounded host failures retain existing public reason codes instead of becoming
unrelated credential errors. Status reports `host_unavailable` when a tab is
unavailable or human-controlled. Its `ready` state means credential/host status,
not a verified login or readiness of any other tab.

`executeWebRequest` now checks tab/thread/control before reading private worker
configuration or claiming queued work. A preclaim failure is a helper result
only: the web request remains queued until explicitly retried, cancelled or
expired by the existing bridge. Failures after a successful claim still complete
the job as failed when permitted. Exact claimed account ID and username
filtering are preserved. No request is automatically requeued or retried.

The optional `VAULT_AGENT_RUNTIME_MODULE` is now validated and loaded before
attempting the default runtime. Previously even an explicit supported factory
required the default engine configuration to load first. This removes that
unrelated startup dependency without changing factory file/parent permission
checks or making a factory into an ACP capability.

## Supported transport readiness

The current installed public CLI reports
`t3 v0.1.2-nightly.20261022.3512`. Its public help exposes only Linux browser
setup under `t3 browser`. `t3 auth session issue --help` describes generic bearer
sessions and `preview:operate`; it does not document provisioning an ACP endpoint
and per-thread authorization. The issue command was not executed.
A focused current T3 catalog search found no supported ACP provisioning tool.

The single metadata-only external readiness probe ran before source edits:

```sh
bun integrations/agent-vault/browser/check-transport-readiness.mjs
```

It reported `configured:false`, all four ACP environment-presence flags false,
`outcome:blocked_external_dependency`, `cliExitCode:2`, and
`browserAvailable:null`. The bounded probe recognized the exact fixed CLI error:

```text
acp-mcp-call requires T3_ACP_MCP_ENDPOINT and T3_ACP_MCP_AUTHORIZATION.
```

The diagnostic now adds a fixed `nextAction`: `continue_chat_relay` on failure,
`open_owned_tab_in_chat` when the transport is reachable with no available tab,
or `inspect_exact_thread_tab` when the status reports an available tab.
This diagnostic is not the public web/MCP status shape. Raw CLI output,
authorization, URLs and tab metadata are never printed by the probe.

The exact external prerequisite is a supported T3 host launch mechanism that
privately inherits `T3_ACP_MCP_ENDPOINT` and `T3_ACP_MCP_AUTHORIZATION`, with
authority for the intended thread/tab and host-managed lifecycle/renewal. Any
`T3_ACP_MCP_NODE` and optional `T3_ACP_MCP_ENTRYPOINT` must come from the same
supported host context. Generic bearer issuance is not demonstrated to satisfy
this prerequisite. There is no verified provisioning command to hand off here.
Keep the working chat relay until that supported mechanism exists. No internal
tokens, app state or installed Electron implementation were inspected or copied.

## Explicit recovery procedure

1. For `host_transport_unavailable`, keep the current supported chat relay or
   have the manager obtain the supported external prerequisite above. Repeated
   credential reads cannot fix missing transport authorization.
2. For `host_control_unavailable`, use the exact intended thread's in-app
   Browser. When no automation-capable tab exists, the manager calls
   `preview_status`, then `preview_open` for its own tab. Keep human-owned tabs
   read-only. Do not grab control or substitute another existing tab silently.
3. Inspect the actual tab ID, control owner and exact approved origin. Select
   the account again. Changed URL/generation, closed tabs and failed handles
   require a new selection; a consumed handle cannot resume.
4. If web preflight failed before claim and the original request is still
   queued/unexpired, the manager may explicitly execute that same request with
   the fresh owned tab. If it was claimed/failed/cancelled/expired, request a new
   sign-in through the UI. Do not edit persisted request state to recover it.
5. For `form_unavailable`, review the fixed provider markup. For verification,
   CAPTCHA, new-device, MFA or recovery screens, stop for the owner's private
   action. Preserve `verification_required` until identity is actually verified.

No runtime registrations, live configuration, browser profiles, applications or
services were changed by this worker. This procedure is manager handoff, not a
claim that a recovery or provider login was performed here.

## Provider extension contract and proposals

`providers.mjs` holds fixed selectors, submit-container requirements, profile
navigation rules, identity expressions and normalization. `supportedOrigins`
also drives the browser's public metadata projection, removing a second local
origin list. `fixedProvider` resolves an ID back to the immutable code-owned
record; a caller cannot override its origin or selectors with object fields.
Unknown origins/IDs remain unsupported.

The shared driver uses the adapter's fixed profile path and identity expression;
it owns origin/control/generation checks, paste, cleanup and identity comparison.
An additional adapter must specify its exact HTTPS origin, username/password
controls, unique submit container, supported profile route/current-user email
projection and explicit normalization. Unknown identity strategies throw and
verify as unmatched. Do not return stores, session objects, tokens or raw DOM.

ClickUp retains the accepted `input#login-email-input`, `input#password-input`,
numeric-workspace settings route and `#email-input` rule. GoDial retains its text
username field, fixed Login button/card, hash-route constraints and bounded
current-user email projection. The GoDial expression's Vue store reference is
the existing manager-reviewed provider identity rule. It was not broadened to
return state or credentials. Both keep trim/lowercase email comparison.

Candidate routes below use only provider names and historical non-secret
observations already committed in the
[import handoff](agent-vault-import-handoff.md). No private manifest, username,
account identifier, login URL or current provider site was read in this worker.
They are review proposals, not new supported origins or live readiness claims.

| Candidate | Proposed next review | Known historical boundary |
| --- | --- | --- |
| Canva | First candidate for a fixed form and exact profile-email adapter, after the manager matches approved imported-origin metadata. | Earlier manual sign-in reached a dashboard; exact identity verification still needs an adapter and manager acceptance. |
| Kit | Fixed route that stops at new-device approval, followed by manager-owned identity proof. | Earlier attempt required private email approval. |
| GitHub | Fixed password route with explicit passkey/security-key/MFA stop and a separately reviewed identity rule. | Earlier attempt stopped at two-factor authentication. |
| GoDaddy | Defer activation until a supported browser path clears the existing provider check normally. | Earlier browser check blocked progress before password submission. |
| Notion / Hostinger | Defer until the source account's username metadata fits the required email login. | Earlier imported usernames did not fit the inspected form. No automatic username repair. |

Manager action is to confirm exact allowed origins from approved metadata, choose
one provider, review its adapter and allocate real acceptance. The manager owns
all shared bridge/UI/provider-enum changes. This branch changes none of them.

## Verification and limitations

Bun policy was read and Bun 1.4.4 used. The documented Node 26.12.0 full Angular
compiler exception is preserved. No Angular build, dependency install, old C05
suite or real provider login was run.

Run the one aggregate case from this checkout:

```sh
bun test ./integrations/agent-vault/browser/acceptance-v2.test.mjs
```

`B2` passed with one test and zero failures. Across the two existing providers,
18 lifecycle changes before retrieval caused zero credential reads/fills, and
18 changes during simulated engine I/O caused zero fills. The same case checks
consumed handles, ambiguous account selection, exact selected ID/origin,
caller override rejection, both retained identity expressions and mismatched
identity. It also simulates takeover immediately after clipboard write and
asserts no paste occurs and the unchanged synthetic value is cleared. Web
preflight rejects a closed tab before private configuration/claim. The fixture
uses an isolated temporary lock directory and an in-memory clipboard. It never
calls native clipboard commands, T3 tools, the credential engine or websites.

Build hygiene consists of Bun syntax bundles, `git diff --check` and scoped
redacted Gitleaks checks. The completion handoff records their final result and
the verified remote commit. The helper's diagnostic-only next-action addition
and custom MCP factory startup ordering received source/static review, not an
extra runtime acceptance case. MCP dependencies were not installed here.

The historical chat relay and real ClickUp/GoDial acceptance remain documented
in the [integration record](agent-vault-integration-2026-10-22.md) and
[web delivery record](agent-vault-web-delivery.md). This worker proves synthetic
source behavior only. The manager must assemble this branch and allocate live
regression/acceptance. There is no new deployment or unattended transport proof.

Clipboard access remains a same-user workflow boundary. Checks between host
operations are not atomic against other processes or human activity. A crash
can leave the native clipboard/lock behind. This is not protection against
unrestricted same-user code, and no new native private-fill capability is claimed.
