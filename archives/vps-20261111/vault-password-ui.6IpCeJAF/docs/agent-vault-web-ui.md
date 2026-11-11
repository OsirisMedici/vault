# Agent access web UI

This owned Angular feature adds `/#/agent-vault` and an **Agent access** navigation
item to the pinned OSS web client. An unlocked Vault owner can select a supported
imported account, explicitly request a sign-in, and read the chat executor's
verified result. The browser connection in the current chat must be active.
Queueing alone does not prove sign-in. This page does not start a browser, send a
chat message, sync Bitwarden items, or expose passwords.

## Source preparation

For a dependency-ready Bun candidate and the daily build command, use
[Vault web builds with Bun](agent-vault-web-bun.md). That wrapper reuses this
source preparer and adds the pinned web-only tooling transformation.

Run from this repository, using a clean initialized public web source. The
parent may supply its existing checkout with `--source`.

```sh
python3 scripts/prepare-agent-web.py \
  --source /absolute/path/to/clean/upstream/web \
  --output .cache/agent-web-candidate
```

The output must be a fresh directory below this repository's ignored `.cache`.
Preparation checks the source checkout root, exact commit and origin from
`upstream.lock.json`, and clean Git state before and after copying. It copies
tracked public source only, excludes `.git`, `node_modules` and generated build
folders, and rebases internal source symlinks into the candidate. It applies
`branding/web-source.patch`, then `branding/agent-web/source.patch`, and copies
the three owned files under `branding/agent-web/app/` to
`apps/web/src/app/agent-vault/`. Original root license files remain byte-identical.
The receipt records patch and component hashes. No dependency installation,
full build, deployment, private configuration or installed application work runs.
No commercial `bitwarden_license` build target is changed.

## Behavior and boundaries

The lazy standalone component is a child of `UserLayoutComponent` behind its
existing `deepLinkGuard()` and `authGuard`. It reuses `SharedModule`, `HeaderModule`,
form controls, buttons, typography and theme colors. State feedback is immediate;
there is no added motion or custom color scheme.

`AccountService.activeAccount$` supplies the explicit Vault `UserId`.
`AuthService.activeAccountStatus$` gates reads and submissions on `Unlocked`.
Lock, logout, account change and component destruction synchronously clear
metadata, selected account, request, messages and polling. Generation checks
reject responses from an old user/session, including an old session of the same
user. ApiService does not expose cancellation here, so a request already sent
may finish on the server. Its stale result cannot repopulate the page. Leaving
the page or locking does not cancel a server request.

The small service calls only the explicit-user overload:

```ts
api.send(method, `/agent-vault${path}`, body, userId, true)
```

There is no API-origin override, engine URL, token handling or browser-storage
access. The existing configured Vault API base owns authentication. Expected
paths are `/agent-vault/status`, `/accounts`, `/requests`, `/requests/:id`, and
`/requests/:id/cancel`, all beneath that prefix.

Responses must have exactly the contract's fields. Metadata text, account counts,
IDs, timestamps, state and identity verification are bounded and validated.
Origins must exactly match the fixed ClickUp or GoDial provider. Unexpected
fields, mismatched request/account metadata, and signed-in results without
verified identity are rejected. Error messages are fixed local text; raw errors
and response bodies are neither rendered nor logged.

Account choices use `[provider, accountId]` as their key, allowing one imported
account ID to appear for both providers. No account is selected automatically.
The explicit **Request sign-in** button is disabled synchronously during its POST
and while a request remains queued or working. A failed or timed-out POST is
ambiguous: the page blocks another submission and tells the owner to check this
chat before reloading. It never retries a mutation automatically. The bridge's
single-active-request rule remains necessary across tabs and reloads.

Polling is serial, every two seconds after the preceding response, with at most
151 reads and a five-minute deadline capped by the request expiry. Each API call
has a 15-second UI wait bound. A terminal response stops polling. Failure or a
local deadline pauses updates with the last confirmed state; **Check status**
performs another bounded read cycle. The UI does not infer success or expiry from
a timer. Cancellation is offered only for a last-confirmed queued request. The
server must atomically reject cancellation after claim. A cancellation supersedes
any in-flight poll so it cannot overwrite the cancellation result.

All states have explicit text: `queued`, `working`, `signed_in`,
`verification_required`, `credentials_rejected`, `failed`, `cancelled`, `expired`.
Queued and working text states that sign-in is unverified. Only an identity-verified
`signed_in` response reports success. The copy action writes only the opaque
request ID. The owner can paste it into the current chat if needed.

## Checks and parent acceptance

The frontend owner ran one synthetic API-boundary fixture without dependencies:

```sh
bun branding/agent-web/check-contract.ts
python3 -m py_compile scripts/prepare-agent-web.py
git diff --check
```

It exercises the real service against a synthetic ApiService, verifies the exact
explicit-user request arguments, provider-plus-account key isolation, mismatched
request rejection, and refusal to project secret fields or unverified success.
It also parses both owned TypeScript files using Bun. This is a syntax and
boundary check, not an Angular type/template compile or rendered UI acceptance.
Preparation succeeded against the pinned clean public source and both patches
applied to a fresh candidate. Original license hashes and source cleanliness
were checked. No dependencies or full tests were installed/run by this owner.

The parent must install/build the candidate using the project's Bun tooling
policy and complete authenticated acceptance:

1. Open the built client, privately sign in and unlock Vault. Click **Agent
   access**, and confirm the existing header/navigation, dark theme, keyboard
   selection and narrow layout render correctly.
2. Select a supported imported account and provider. Confirm the displayed
   username/origin, click **Request sign-in** once, and verify repeated activation
   cannot enqueue another job. Confirm the queued state and copy action expose
   only the request ID needed by the current chat.
3. Use the parent's trusted chat executor to complete that request. Confirm
   `working`, then `signed_in` only after browser identity verification. Exercise
   verification-required, rejection, failure, cancellation and expiry with safe
   synthetic bridge responses where appropriate.
4. Lock, log out or switch Vault accounts while metadata, POST or poll responses
   are delayed. Confirm the page clears immediately and old responses cannot
   reappear. Include switching away and back to the same Vault account.
5. Confirm cancellation is offered only while queued, claim/cancel races preserve
   the server result, connection failures show fixed messages, and polling stops
   after terminal states or its bound. A failed POST must not auto-retry.

Build, deployment, real authenticated browser execution and visual acceptance
remain owned by the parent and are not claimed by this source patch.
