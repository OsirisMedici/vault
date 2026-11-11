# Agent access: discovery and recent requests

This source-only UI change serves the unlocked Vault user who needs to find an
imported account and understand the last confirmed result of a chat-assisted
sign-in. The existing owner workflow and imported data remain the baseline.

Previously the page had one complete account selector and only the request
created during the current page visit. It now adds local, case-insensitive
search across name, username, origin and provider, plus All/ClickUp/GoDial
filters. Changing or clearing a filter clears selection. A hidden or stale
option cannot enable submission. No account is automatically selected, and
only the explicit Request sign-in action creates work.

The UI uses the existing header, container, input/select, button, callout and
typography components and inherited charcoal styling. Counts, no imported
choices, no filter matches, loading, retryable history failure, queued/working,
failed and verified outcomes have distinct text. History is a wrapping list
rather than a fixed-width table; its native desktop/mobile rendering still
requires the manager's actual compiled-client check.

## Frozen interface and behavior

`AgentVaultService.history(userId)` calls the existing explicit-user
`ApiService.send("GET", "/agent-vault/requests", undefined, userId, true)`.
The configured Vault API base supplies the public `/api` prefix. No engine
origin, browser storage or credential access is introduced.

The response must contain exactly `{requests: [...]}`, at most 25 unique
request IDs, with each row passing the unchanged strict `AgentRequest`
projection. Unknown fields, account IDs, invalid fixed provider/origin pairs,
invalid expiry strings and inconsistent `signed_in`/`identityVerified` values
are rejected. Server order is retained; no creation timestamp is invented from
expiry. The permissions worker supplies current-user isolation and newest-first
ordering at this frozen endpoint; the UI cannot independently prove ownership
or ordering from the public projection alone.

History loads independently from metadata on unlock/Refresh and can be retried
with Refresh history. It never creates, resumes, cancels or polls a historical
request. An active row prevents another submission and directs the user to the
chat and a read-only refresh. Known outcomes are updated by current-request
create/cancel/poll responses; older in-flight history reads cannot overwrite
those newer results. Rows stay bounded to 25. A failed read keeps prior rows
clearly identified as last confirmed states. History failure does not discard
otherwise available account metadata.

Historical identity verification describes a recorded outcome, not the current
existence of a logged-in browser session. Success text requires both
`signed_in` and `identityVerified`; queueing, elapsed time or a history row never
invents a result. History has no action that selects or executes its account.

The existing unlock gating, explicit-user API use, selected-account identity
validation, duplicate-submit and uncertain-submission protection, cancellation,
15-second API timeout and bounded current-request polling remain. Lock, logout,
account change and destruction clear accounts, filters, selection, history,
request and timers. Session generations reject late metadata, history, create
and poll responses. No new provider enum, admin panel, backend, source patch,
build tooling, deployment or installed application changes are included.

## One aggregate synthetic acceptance case

From the assigned worktree with Bun 1.4.4:

```sh
~/.bun/bin/bun --no-install branding/agent-web/check-contract.ts
```

This is one aggregate case, replacing the earlier service-only fixture. It
executes the actual service and component logic with explicit Angular/RxJS and
layout substitutes. A tiny in-memory Bun bundle resolves the absent shared
layout imports; it is not an Angular build, dependency install or rendered app.
It uses only synthetic `.invalid` identities and injected responses, with no
network, private configuration or live sign-in required.

Verified locally on Raven: PASS. Assertions cover strict account/request and
25-row history projections, provider/account/request identity binding,
explicit-user API arguments, local filters and explicit selection, hidden
selection rejection, initial empty history, read failure/retry, read-only
history, active-history submit gating, duplicate and uncertain submission,
queued-to-verified polling, cancellation and history reconciliation, stale
history versus newer polling, lock/user-change clearing, and late history,
metadata and create rejection. TypeScript transpilation and `git diff --check`
are separate hygiene checks, not additional acceptance cases.

## Pending manager checks and evidence limits

No baseline or after screenshots were captured. This worktree has an empty
`upstream/web`, no generated candidate or installed dependencies, and T3
`preview_status` reported no attached tab. There is no permitted synthetic
Angular runtime here to capture without preparation/install/build. No personal
browser, production sign-in or private profile was opened. No preview service
or Tailscale mapping was started or changed. This fixture is not real editor,
rendered-client, authenticated API or provider acceptance.

Only the original manager assembles this UI with the permissions endpoint and
uses the reviewed Bun-managed build path with Node 26.12.0 solely for the full
Angular compiler. No dependency installation or full Angular build ran here;
there was no heavy-operation slot.

In the manager's allocated rendered/live acceptance, open `/#/agent-vault` in
the actual generated client with an authorized synthetic runtime first. At
normal desktop width and a measured narrow/mobile CSS viewport:

1. Capture the prior UI if available, then the resulting native charcoal page.
   Check labeled search/provider controls, counts, clear filters, long wrapping
   usernames/origins/IDs, keyboard selection/focus and disabled unselected submit.
2. Search and filter to matching/empty results, explicitly select a visible
   account, and confirm changing filters clears it. Check metadata loading/empty
   and history loading/empty/failure/retry states without discarding the account
   list or executing history entries.
3. Exercise queued, failed and identity-verified results in the existing allocated
   flow; verify history order/max25/current-user isolation against the integrated
   backend, active-request gating, explicit retry/cancel, and stale-response
   clearing on lock/user switch. A history refresh must issue only GET requests.
4. Save/inspect real before/after desktop/mobile screenshots and relevant tested
   states. The manager alone may perform an assigned real authenticated sign-in,
   deployment and final acceptance; synthetic outcomes here prove none of those.

These are pending steps inside manager-owned acceptance, not extra worker test
cases. Preserve license/attribution files, upstream pins, private data and the
accepted official Bitwarden installation. No deployment was performed.
