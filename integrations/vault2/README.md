# Vault2 access experiments

**Current direction:** Osiris removed the GHL-only constraint. See
[Fast access findings](FAST-ACCESS.md) for the measured Figma connector and
API-free browser input transaction in the separate deep-review checkout.
The GHL-specific material below describes the preserved earlier draft only.
Vault2 API consumption remains quiesced by explicit owner instruction.

Status: **blocked before private fill; not accepted for daily sign-in**.
This folder belongs to the GHL continuation. Operations/branding publication is
owned separately. Nothing here changes the engine, Serve, T3 settings, upstream,
Bitwarden, or the frozen custom deployment. No dependencies were added.

## Intended daily action

Use the current T3 thread's fresh tab in the discovered `osiris` profile, select
only source ID `6be9b651-e7f0-45f3-8cbc-227d801fe7b0`, and sign into
`https://app.gohighlevel.com` as `scaleadvertisement@gmail.com`.
The helper rejects a different source ID, username, origin, thread, tab, profile,
control generation, URL, form, or focused input. The other LeadConnector record
must never be substituted. Selection is one-use and expires in five minutes.

`ghl-session.mjs` retains credentials inside local trusted code, uses upstream's
single-key reveal API, and sends only fixed nonsecret browser controls to T3.
This is owner-assisted local custody, not an isolated security service: it runs
as the same Mac user and uses the shared system clipboard. It has no agent grant
and does not implement Touch ID. Do not call this a native private-fill API.

`ghl-relay.js` runs a full helper command in one trusted tool-runner loop. The
model does not relay each key/field. It retains all existing guard calls; reducing
checks to hit a latency number is out of scope. The stdio/tool transport still
has repeated round trips, so there is no 1–3 second performance claim.

## Preconditions and exact test sequence

1. Obtain an explicit runtime-ready receipt from the operations owner after its
   restart window. This continuation is currently quiesced: no Vault2 API use.
2. Call `preview_status`, discover profiles, then `preview_open` with
   `reuseExistingTab:false` and the approved profile. Bind the actual current
   thread/tab/profile; never reuse another thread's tab.
3. Start the helper with Bun and its `--thread`, `--tab`, `--profile`, and exact
   `--account` arguments. These arguments contain no credential values.
4. Run `probe-input` through `runVault2Command`. This command makes **no engine
   API calls**. It requires a stable unique form, pastes an invalid test email,
   verifies it, clears the input, and compares/clears only its own clipboard.
   Stop if any guard or benign input check fails. Do not read a password first.
5. Only after that real probe passes, run `discover`, then `sign-in` with its
   returned one-use selection ID. Owner session setup and selected metadata,
   username and password lookups stay inside the helper. No bulk credential scan.
   Do not run during backup/restart or silently retry a submission.
6. `submitted` always has `identityVerified:false`. Wait for the actual website,
   stop for private owner MFA/CAPTCHA/recovery, and inspect visible profile UI for
   the exact email. No cookies/storage/tokens or hidden identity dumps. A URL or
   missing form does not verify the identity. This adapter does not yet automate
   the GHL profile menu or claim a signed-in result.
7. Send `close` even after failure. Review the explicit cleanup receipt. Only
   logout followed by HTTP 401 from `auth/me` reports `session:revoked`. A failed
   logout or probe reports `revocation_unverified`, not success. Clipboard/lock
   cleanup uncertainty is reported independently. Lifetime is at most 600 seconds;
   abrupt process death remains an untested cleanup gap.

Start end-to-end wall time **before navigation/readiness**; finish only at exact
visible identity or a required human step. Separately report provider page-load
and authentication waits, owner-session setup, selected credential lookup,
benign-input probe, private fill, submission and cleanup. Helper `commandMs` ends
at that command's result. It is not end-to-end login timing. Zero phase counters
mean a phase was not run; never present them as measured zero-latency success.

## Current platform findings (Raven, 23 October 2026 IST)

Live host/worktree/branch/HEAD/remote and registered Vault binding matched the
handoff. The original upstream checkout remained clean at
`d5836ec3bb2315de38043d742ae5daca11a4944a` (v0.40.2).

The live T3 catalog exposes literal `preview_type`, keyboard input and arbitrary
page evaluation, but no credential-reference/private-fill tool. The supported
external `acp-mcp-call` path has no endpoint, authorization, node, or entrypoint
in this process; the bounded existing transport probe returned
`host_transport_unavailable`. No T3 authorization/state was copied to enable it.
Upstream's pinned services documentation supports API header/body substitutions;
it is not a browser form-fill facility. No proxy rules, broad grants or browser
proxy configuration were created as a shortcut.

A fresh owned GHL tab opened in the approved profile. Snapshot attempts returned
`Preview automation snapshot timed out after 15000ms.` twice; the allowed in-app
Browser fallback returned `Browser is not available: iab`. Personal Chrome was
not operated. A later same-site navigation made the form observable, but another
snapshot still timed out, and DOM evaluations alternated between visible fields
and no fields. The strict helper stopped at `form_unavailable` after 2,461 ms,
four browser calls, before clipboard or engine access. No login was submitted.

Observed separate navigation call time was 941 ms and subsequent form-wait call
time 833 ms. The page later reported DOMContentLoaded/load at 969 ms in its
current document. These measurements have different boundaries, were separated
by investigation, and **must not be added into an end-to-end login figure**.
After the host later reported a stable form, a second API-free probe reached the
input step and failed with `host_operation_failed`: 6,971 ms total, seven browser
calls, and 5,123.87 ms in the attempted benign-input phase. It stopped before
clipboard use, credentials or submission. A separate direct focus-only call
returned success after 3,545 ms; that is not fill or login latency. These are
failed/partial lower-level measurements, not a successful normal-use sample.

Required next platform condition: a stable owned T3 GHL form and working benign
input/inspection path. The 1–3 second target then requires actual lookup/fill and
full provider authentication measurements. If supported stdio transport remains
too slow, a trusted host private-fill/batched action facility needs explicit
thread/tab/control/account checks; this task did not modify T3 to create one.

The official Figma connector access test succeeded for `businessabhish@gmail.com`,
handle Osiris, Osiris Medici's team. That connector is ready for purpose-built
design tools within its existing permissions. It proves no Vault-driven browser
login. No Figma password/token/account or design edit was requested or created.

## Source checks and cleanup

`bun test integrations/vault2/cleanup.test.mjs`: four fixture-only cases passed.
They cover verified revocation, logout failure, independent cleanup failures and
no-session/no-API behavior. They are not browser or live revocation acceptance.
The helper and relay bundle successfully with Bun 1.4.4. Bundling is syntax
hygiene, not private fill or authentication evidence.

The real probe helper closed: `session:not_created`, `clipboard:not_used`,
`lock:not_acquired`. No credential, owner token, master password or clipboard
content was printed. Current-thread screenshots could not be saved, so there is
no new before/after or successful-login image. Prior-thread baselines are not
presented as current acceptance. Credential lookup, actual private fill,
provider authentication, exact GHL identity, MFA handoff and live authenticated
cleanup all remain pending. Engine/UI runtime lifetime and private mappings are
owned by the separate operations continuation; this helper changes none of them.

The second probe acquired and released its lock; the absent lock was checked
after closing. Its old close field said `not_acquired` because it described the
current held flag incorrectly as history. Source now retains `released` through
close. That corrected historical lock label has syntax verification but no new
live input run. Both probe processes exited. No owner-session or clipboard
cleanup was needed, and there has been no Vault2 API consumption in this thread.

Code in this folder carries GPL-3.0-only identifiers consistently with Vault.
The separate upstream distribution and branding retain their existing license
and attribution files; this folder does not relicense or modify them.
