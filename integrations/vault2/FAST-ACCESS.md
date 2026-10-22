# Fast daily access: findings and tested scope

Osiris selected deeper reasoning with the current Codex model, allowed another
app instead of GHL, and explicitly kept all Vault2 API use quiesced.

The new source checkout is
`/Users/pranshisharma/.t3/worktrees/Vault/work-vault2-ghl-deep-review`, branch
`work/vault2-ghl-deep-review`, based on
`c80218e20d2717cb71052e45e5fc38f0991a5927`. Host is Raven,
`pranshis-MacBook-Air.local`, arm64. The T3 conversation remains bound to the
original worktree; all source commands for this round explicitly targeted the
new checkout. No new conversation, worker or provider was launched. Only the
five existing GHL source files were copied initially, with matching bytes. No
private state, untracked operations source, branding or generated build was
copied. All new work stays under this checkout's `integrations/vault2`.

## What Osiris can use now

Use the existing official Figma connector for design work. Its authenticated
`whoami` access test completed in **1,145 ms**, returning
`businessabhish@gmail.com`, Osiris, Osiris Medici's team. This elapsed wall time
includes the connector request and its remote authorization/identity response.
It does not include browser navigation or a browser login because neither is
part of that connector action. No design was edited. No Figma token, password
or account was created. This is existing connector access, not a Vault login.

## Browser path tested without credentials

`browser-probe.mjs` uses a fresh owned T3 Figma login tab in the discovered
`osiris` profile. It imports no vault code, has no engine API calls and has no
submission path. It can only fill and immediately clear an invalid test email.
The password field must be empty and is never filled.

The old draft relied on many native clicks/key calls. This experiment uses the
browser's standard clipboard API and native input setter/events inside a single
guarded page transaction. Clipboard-read permission was already `granted`;
the code refuses `prompt`/`denied` instead of requesting new permission.

The host still checks exact thread, tab, profile, URL, ownership, control
generation, dialog/file chooser state before and after the operation. The page
checks exact origin and URL, focus, visibility, hit-testing, input types and
shared form, empty input state, challenges, and a short-lived one-use marker
bound to the actual document and elements. It rechecks after asynchronous reads
and preserves intervening human input. No selectors, provider origins or account
identities are accepted from page content. The clipboard carries only a random
nonsecret test email. The host compares and clears only its own value.

The relay now handles coalesced independent status/list requests correctly;
the old implementation could drop the second request in one output chunk.
Only this read pair may execute in parallel. Mutations remain sequential.
Per-tool durations are reported without raw page responses or credential values.

Measured real browser results:

- Initial already-loaded-page probe: **2,637 ms**, benign input verified and
  cleared, ten browser calls. The in-page transaction took 9.1 ms.
- Final checked source, helper startup through close: **3,150 ms**. The probe
  command took 2,625 ms; its input transaction took 4.4 ms inside the browser,
  and the helper measured 378.6 ms around that transaction's complete tool/stdio
  exchange. Close took 104 ms. Clipboard cleared; helper lock released; no owner
  session existed. Startup and transport overhead are included in the 3,150 ms.
- Requesting a 10 ms instead of 250 ms stdio wait did **not** improve the result:
  **3,153 ms** including startup/close, 2,625 ms for the command. Browser tools
  themselves took about 17–28 ms each. A transport wait floor is an inference,
  not a verified T3 implementation fact. The ineffective wait change was reverted.

These runs were on an already-loaded login page. Its navigation timing separately
reported DOMContentLoaded 1,024.1 ms and load 1,024.3 ms. This is a different
measurement boundary; do not add it to a warm probe and call that end-to-end
login latency. **No authenticated browser end-to-end sample exists.** Provider
authentication/MFA waits were not exercised because no request was submitted.
Actual credential lookup and password fill remain unmeasured while API use is
paused. The 1–3 second full Vault login goal is therefore still pending. Even
the cold-helper nonsecret input sample slightly exceeded three seconds.

## Verification and limitations

Twelve focused fixture tests passed: cleanup truthfulness, exact identity/control
binding, permission refusal, one-use fill/clear, intervening navigation/human
input/form replacement, coalesced responses and refused parallel mutation.
JavaScript syntax checks passed. Fixtures are not live credential acceptance.
The real browser probe passed separately, and subsequent DOM inspection confirmed
both fields empty and the one-use document marker absent. Both helper processes
exited, with no clipboard payload or lock retained. Crash/forced-kill cleanup and
real authenticated owner-session revocation remain untested.

Baseline screenshot was saved and visually inspected:
`/Users/pranshisharma/.t3/userdata/browser-artifacts/browser-screenshot-www-figma-com-mvk2sksr-c936d58e.png`.
After-state snapshot attempts failed twice with
`Preview automation snapshot timed out after 15000ms.` The permitted in-app
Browser fallback had returned `Browser is not available: iab` earlier in this
same continuation. No personal Chrome was operated. The baseline is not presented
as an after-state or evidence of login. The final cleared state has DOM/receipt
evidence but no saved after screenshot.

## Minimal continuation

1. Keep using Figma's connector for Figma tasks within its existing permissions.
2. Keep the Vault2 API paused until the owner explicitly clears the operations
   window. No engine/UI restart, state/Serve/settings change or deployment belongs
   to this checkout.
3. When cleared, select any appropriate saved account with a complete imported
   pair, using bounded metadata discovery. Figma has no imported pair, so do not
   request a Figma password or pretend its connector proves Vault browser login.
4. Add a narrowly fixed adapter for that exact app/account; retain all binding,
   challenge and identity checks. Do not route real credentials through the
   nonsecret probe. The current probe supports no credential payload or submit.
5. Measure actual lookup, actual password fill, page-load/authentication wait and
   action-to-exact-visible-identity together. Stop for private owner verification,
   then verify exact identity. A warm input microbenchmark cannot pass this gate.

To reproduce the credential-free experiment, start with `preview_status` and a
fresh owned Figma tab. Start `bun integrations/vault2/browser-probe.mjs` with its
actual `--thread`, `--tab` and `--profile`; run `probe-input` through
`runVault2Command`, then always `close` and inspect the cleanup receipt. It never
needs Vault readiness or access to owner files. The helper expires in 120 seconds.
No daemon or reboot behavior was installed. Production/preview lifetime remains
the separate operations owner's responsibility.
