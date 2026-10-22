# Working Agent Vault integration

22 October 2026. This handoff supersedes the pre-integration audit findings.
Osiris authorized restoring the existing engine persistently, assembling the
engineer branches, fixing metadata/provider mismatches and using the proven
chat-helper route while standalone browser access remains unavailable.

## What Osiris can do now

Use the existing 253-account import through the restored Agent Vault UI and ask
this chat to sign into ClickUp or GoDial with the selected saved account.
The assembled host code obtains the credential privately and verifies the
exact signed-in email. Both providers passed a fresh sign-in. No reimport,
source password change or desktop rebuild was required.

Keep this conversation's in-app Browser active while a login runs. The host
requires a real preview click to focus WebContents before the native paste.
If that focus is unavailable, it fails closed instead of submitting empty
fields or pretending to be signed in. Website MFA/device/CAPTCHA requirements
still belong to the owner privately.

The private HTTPS UI remains at the preexisting dedicated Tailscale mapping
on port 18443 of this Mac. The runtime is now managed independently of this
conversation process. The Mac must remain awake and online. It starts at user
login and after owned-process failure; a real service restart was verified,
while an actual Mac reboot/login was not performed.

## Preserved and assembled

The engine moved from temporary trial custody to
~/.local/share/osiris-agent-vault/engine with the same database, data-key wrapping,
CA, owner enrollment and credentials. SQLite's backup API preserved committed
WAL records. A consistent pre-install snapshot and the original source state
remain private. Aggregate integrity/count checks report all 253 imported pairs,
506 imported credential fields and 519 total fields including the older trials.

The LaunchAgent is com.osirismedici.agent-vault. Master material is read from
a mode600 private file through stdin, absent from plist/argv/environment and
source. Engine stdout/stderr go to /dev/null. Loopback API/proxy ports stay
18431/18432. Existing Tailscale routing and registration restrictions remain.
This local same-user setup is not a new isolation or disaster-recovery claim.

Owned commits from all four engineer deliverables were cherry-picked into
work/agent-vault-integrated. The root main checkout and its index were preserved.
Vault 01-04 were settled and verified in the sidebar. No engineer was restarted.
Original Bitwarden, its Keychain enrollment, the installed T3 app and the live
VPS Vault were not replaced or redeployed. This work was not pushed publicly.

## Integration fixes

- The credential provider accepts strict RFC3339 UTC timestamps with offsets
  and up to nanosecond precision, including the importer's microseconds. The
  existing metadata and passwords did not need rewriting.
- The private engine configuration, member capability and runtime factory are
  wired. A bounded configuration helper can refresh the existing engine-owner
  session privately when necessary, without revealing it or altering accounts.
- ClickUp uses the observed password-input field, numeric-workspace profile
  URL and visible email-input text field for exact identity verification.
- GoDial uses the observed text username field, fixed Login button/card rather
  than a nonexistent HTML form, and its authenticated hash routes. Verification
  projects only the current profile email used by the application's greeting;
  it never returns the store or tokens.
- The driver uses the supported preview list limit 50. It checks native focus,
  exact origin, tab/thread binding, hit-tested fixed controls and nonempty paste.
  Clipboard cleanup clears only its unchanged private field value.
- Document readiness uses DOM readiness, so pending analytics/font resources
  cannot indefinitely block an otherwise ready form. CAPTCHA challenge and
  verification states remain separate, with no challenge bypass.
- The owned browser package now uses Bun 1.4.4 and bun.lock, migrated from the
  existing exact dependency resolutions. Upstream package managers were untouched.

## Verification and remaining boundary

The bounded [result receipt](../integrations/agent-vault/results-2026-10-22.json)
records C08 real assembled lookup, C09 fresh ClickUp sign-in and C10 fresh GoDial
sign-in with exact identity verification. Source syntax, MCP bundling, frozen
Bun install, LaunchAgent plist validation and scoped Gitleaks checks passed.
The allocated integration cases were repeated after observed fixes. No broad
upstream suites or extra provider test matrix was run.

The standalone external MCP transport remains unavailable. The supported CLI
requires T3_ACP_MCP_ENDPOINT and T3_ACP_MCP_AUTHORIZATION, and this host does not
inherit them. The accepted fallback is an explicit chat relay using the already
injected T3 tools; it successfully drove the full assembled controller in C09
and C10. No T3 token/state scraping, personal Chrome or app patch was used.
No unsupported external capability is claimed and no active MCP registration
or agent session was forcibly restarted.

Operational commands and the reusable chat relay are in
[the integration guide](../integrations/agent-vault/README.md). Password refresh
from Bitwarden, additional provider routes, off-host encrypted recovery and VPS
Agent Vault activation remain separate follow-up work. The new controller's
accepted provider set is ClickUp and GoDial; it does not assert all 253 websites
support unattended login.

## Parallel completion and launch status

All three follow-up workers completed and their owned commits were reviewed
and assembled here. The supported transport now respects its supplied launch
environment and has a metadata-only readiness probe. The missing per-thread
ACP capability remains an external host dependency; the accepted chat relay
is unchanged.

The [recovery helper](agent-vault-recovery.md) created and verified a new private
snapshot and independent offline copy at 253 accounts, 506 imported fields and
519 total fields. Existing master wrapping and CA material matched. Decryption,
live restoration and off-host recovery remain untested.

The [VPS package](agent-vault-vps-readiness.md) stages the existing snapshot into
a new companion destination instead of creating an empty vault. Assembly fixed
the independent workers' snapshot-layout mismatch. A repeated synthetic case
proved the full recovery input is accepted and Mac helpers excluded. The actual
private snapshot also passed read-only permission and inventory compatibility
checks. MCP bundling, shell syntax, Compose validation and whitespace checks
passed; the live managed Mac engine remains ready with all fields preserved.

The Mac chat-assisted pilot is usable. A full team/VPS launch is not accepted:
the Linux image build and live unlock/CA/ownership checks have not run, no data
was transferred or service deployed, and unattended T3 capability is absent.
No source push, main merge, installed desktop replacement or team message was
performed. Parallel code completion must not be reported as production launch.
