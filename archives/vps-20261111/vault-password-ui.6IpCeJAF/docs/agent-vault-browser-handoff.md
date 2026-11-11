# Agent Vault browser handoff

22 October 2026. Independent source deliverable on `work/agent-vault-browser`.
Only `integrations/agent-vault/browser/` and this document are owned by this work.
No source push, PR, registration, deployment, app restart, peer contact, import
read, or real provider sign-in was performed.

## Delivered behavior

The additive stdio MCP has four tools: `vault_agent_status`,
`vault_agent_find_accounts`, `vault_agent_sign_in`, and `vault_agent_cancel`.
The existing Vault MCP and its registration are unchanged.

The controller consumes random selection handles bound to exact account,
thread, tab and origin. Their default lifetime is five minutes. It checks the
binding, expiry, browser ownership and origin before `withCredential` runs.
Account lookup returns only approved metadata. Public responses are rebuilt
from a closed set of states, reasons and fields. Native exceptions and engine
objects are never forwarded. A fill result cannot assert `signed_in`.

The driver uses fixed provider controls, supported T3 preview operations and
native `pbcopy` stdin followed by `preview_press` Meta+V. Both username and
password use this private path. No credential is inserted in a tool argument,
DOM expression, shell command or argv. The browser keeps its own cookies.

Before filling, `t3_preview_list` must associate the exact tab with the supplied
thread. Every fill checks exact HTTPS origin, exact tab ID, loading/dialog
state, ownership and ownership generation. The focused field must be the one
unique visible editable field of the intended type before and after paste.
Submit must be the one visible submit button in that password field's form.
No additional authentication origin is followed. Unexpected redirects fail
closed. A human-owned tab is never operated.

Fills use an in-process queue and an exclusive mode700 temporary directory
lock outside the checkout. A crashed process can leave the lock directory
`osiris-agent-vault-browser-<uid>.lock` under the host temporary directory.
Do not remove an existing lock until its owner is confirmed inactive.
Clipboard cleanup compares against only the value this operation placed there,
on success and failure. A different clipboard value is preserved. Cleanup
failure returns `host_unavailable` with `clipboard_unavailable`.

`cancel` invalidates outstanding selections and cancels queued requests. The
frozen driver interface has no interrupt signal. Cancellation during an active
fill therefore returns `denied/request_in_progress`; it does not claim that the
native fill stopped. The caller can cancel all without knowing a request ID.

## Supported host transport evidence and blocker

The injected T3 catalog exposes `preview_status`, `preview_open`,
`preview_click`, `preview_press`, `preview_evaluate` and `t3_preview_list`.
No private-fill or clipboard API was present in the focused catalog search.
`preview_status` initially reported no attached tab. `preview_open` then opened
our own incognito tab with `available:true`, `owner:agent`,
`ownedByCaller:true`. That disposable blank tab was closed afterward. No user
or manager tab and no provider website was used.

The supported external route is `acp-mcp-call`. This host's installed `t3`
recognizes it. The actual external probe was:

```sh
t3 acp-mcp-call preview_status '{}'
```

It exited 2 with the exact error:

```text
acp-mcp-call requires T3_ACP_MCP_ENDPOINT and T3_ACP_MCP_AUTHORIZATION.
```

The current process has no exported ACP transport environment. `t3 browser
--help` exposes only the headless-browser setup subcommand, not a tab-control
CLI alternative. The injected model tools are usable, but they are not a
callable host capability available to an ordinary external MCP process.

`transport.mjs` implements the documented CLI route when T3 actually provides
its endpoint/authorization to a trusted host process. It supports the documented
`T3_ACP_MCP_NODE` and optional `T3_ACP_MCP_ENTRYPOINT` launch form, or `t3` from
PATH. Authorization stays inherited in the subprocess environment, never in
argv, source, output or MCP parameters. Missing capability fails closed.

The narrow required fix is a supported, per-thread host transport inherited by
the connector, with authority to operate that thread's intended tab. T3 must
supply it through its supported integration mechanism. Do not scrape T3 state,
copy an internal app token, patch Electron, rebuild/restart T3, or route through
personal Chrome. This branch does not establish that such an external capability
can currently be provisioned from the Codex host. A mock callTool is not live
login evidence. No private password interaction can fix this transport blocker.

## Acceptance allocation

- C04: BLOCKED before private fill. The real external transport probe above
  failed. No dummy form was filled, no clipboard secret was written, and no
  secret-free live-fill pass is claimed. Opening an injected-tool tab does not
  satisfy this case. Run C04 through the final externally callable supported
  host path once available; do not substitute a model-tool relay or mock.
- C05: PASSED once with the injected driver and metadata fixture. A selection
  minted at the approved ClickUp origin was used after the fixture origin
  changed to `https://wrong.example.invalid`. Result was
  `denied/origin_mismatch`, credential reads 0, private fills 0. The fixture
  contains metadata only, no password. No repeat or extra acceptance suite.

Dependency installation used pinned versions matching the existing Vault MCP.
The MCP server construction/close smoke passed. All owned ESM files passed
`node --check`; `git diff --check` and the scoped credential-pattern scan passed.
These are build/source checks, not additional acceptance cases.

## Fixed provider verification routes and limits

Only `https://app.clickup.com` and `https://app.godial.cc` are supported origins.
No suffix matching, caller selectors, arbitrary URLs or cross-origin auth rule.

ClickUp login uses `#login-email-input`, `#login-password-input` and the form's
unique `button[type="submit"]`. Verification reads a unique visible email input
at exact `/settings/profile`, optionally reached through a unique visible
`a[href="/settings/profile"]` already on the page.

GoDial login uses unique visible `input[type="email"]`,
`input[type="password"]` and the form's unique `button[type="submit"]`.
Verification reads a unique visible `input[name="email"]` at exact `/profile`,
optionally reached through a unique visible `a[href="/profile"]` already on the
page.

Both require a visible profile/settings heading, no visible password field, and
an email-shaped value. Each uses trim plus lowercasing as its explicit email
normalization. The controller independently compares the observed email with
the selected metadata email after the driver reports a match, then rechecks
origin and ownership. It never treats a dashboard, navigation or submit as proof.
MFA/new-device/CAPTCHA markers produce `verification_required` with private owner
handoff; visible rejection markers produce `credentials_rejected`.

These fixed selectors and paths are conservative candidate rules, not audited
live-provider evidence. Only the historical ClickUp profile-email verification
is documented; the supplied evidence did not record exact selectors. No live
ClickUp or GoDial page was inspected in this task because the acceptance scope
allows only our disposable fixture. GoDial's `/profile` route especially needs
live confirmation. Missing or changed markup returns `verification_required` or
`form_unavailable`, never `signed_in`. The later integration owner must inspect
and correct the fixed rules within C09/C10 if the actual UI differs. Session
loading and delayed provider errors can also require private owner verification.
The two real account sign-ins remain unaccepted.

## Exact run steps and registration descriptor

From this worktree:

```sh
npm ci --prefix integrations/agent-vault/browser --ignore-scripts --no-audit --no-fund
node integrations/agent-vault/browser/acceptance-c05.mjs
node integrations/agent-vault/browser/mcp.mjs
```

Without an assembled credential factory, the runnable MCP reports
`import_required`. It does not read the running trial or a private manifest.

For the later assembled checkout, create an owner-only host module under
`~/.config/osiris-agent-vault/integration-v1/`, using
`browser/runtime.example.mjs` as a template. Export async `createRuntime()`
returning `{credentials}` from the frozen credential-provider interface. The
module and its parent must be owner-owned, nonsymlink, mode600/mode700. Wire the
engine owner's validated private configuration and the private import manifest.
The template paths are placeholders and cannot run unchanged.

A supported host can instead return `{credentials,callTool,clipboard?}` when it
provides the same officially exposed T3 preview tool route directly. `callTool`
is trusted host code, never a tool argument. It must resolve the actual intended
thread/tab and enforce T3 ownership. A dummy implementation does not satisfy C04.

Startup after assembly and supported transport provisioning:

```sh
VAULT_AGENT_RUNTIME_MODULE="$HOME/.config/osiris-agent-vault/integration-v1/browser-runtime.mjs" \
  node /absolute/assembled/checkout/integrations/agent-vault/browser/mcp.mjs
```

Use this additive stdio server descriptor in the supported MCP registration UI
or configuration mechanism for the chosen host, substituting absolute paths:

```json
{
  "mcpServers": {
    "vault-agent-browser": {
      "command": "node",
      "args": ["/absolute/assembled/checkout/integrations/agent-vault/browser/mcp.mjs"],
      "env": {
        "VAULT_AGENT_RUNTIME_MODULE": "/absolute/private/integration-v1/browser-runtime.mjs"
      }
    }
  }
}
```

The discovered T3 CLI has no advertised MCP-registration subcommand. There is
no verified T3 registration shell command to supply. The descriptor and exact
startup command above are reviewable preparation, not an applied registration.
Do not write ACP authorization values into this descriptor. A later integration
must verify that its supported host actually supplies the per-thread transport.
No current registrations were applied or changed.

## Files and remaining acceptance

Owned source: `controller.mjs`, `driver.mjs`, `providers.mjs`, `public.mjs`,
`transport.mjs`, `mcp.mjs`, `runtime.example.mjs`, `acceptance-c05.mjs`,
`package.json` and `package-lock.json` under `integrations/agent-vault/browser/`,
plus this handoff.

Manager/owner assembly is still required. This branch contains no peer modules
or imported runtime data. The first version consumes an imported snapshot;
live Bitwarden sync and new native/Touch ID enrollment remain deferred.

The clipboard fallback is a same-user workflow boundary. Other same-user
processes or clipboard history can observe copied data. Compare-then-clear and
ownership/focus checks are not atomic against unrelated host activity. A native
crash can leave clipboard data and the lock behind. Do not describe this as
protection from unrestricted host access or as a signed native private-fill API.
