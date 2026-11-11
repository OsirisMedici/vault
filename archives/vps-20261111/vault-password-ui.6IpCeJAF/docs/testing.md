# Testing Vault on this Mac

## Current boundary

The desktop candidate builds and launches. Its Vault branding, charcoal theme,
self-hosted-only server menu and existing server URL have been checked in the
native window. It is ad-hoc signed. Developer ID signing, notarization, account
sync and its own human Touch ID acceptance remain pending.

The protected agent connection is a separate compiled T3 experiment. Its focused
source checks and integrated build passed. A private device-enrollment screen
was reached, but native enrollment, fingerprint restore and successful Gmail
login have not been accepted. The normal installed T3 app does not gain that
experimental connection merely because the source builds.

Team/workspace work is a plan and an editable design. It is not a deployed
authorization feature. Design review is separate from testing real invitations
and encrypted sharing.

## Start only when the owner says ready

Osiris requested that test apps stay closed until he explicitly says **ready**.
A fresh session means a clean runtime. Preserve profiles, vault data and any
valid device enrollment. Do not reset accounts or delete stored connections to
make a test look fresh.

Use the existing runtime owner and one isolated test instance. Record its exact
process IDs and verify that the previous instance and its listener are gone
before relaunching. Keep the normal T3 conversation available for coordination.
Never terminate unrelated Electron apps by name or pattern.

## Test one flow at a time

| Window | Purpose | What it proves |
| --- | --- | --- |
| Vault, with “Log in to Vault” | Standalone desktop candidate | Desktop sign-in, sync and desktop biometric behavior, when each is observed |
| “Vault • Private sign-in” | Host-owned agent connection | Enrollment, per-request biometric approval and provider login, when each is observed |

Keep the standalone desktop candidate closed while accepting the agent flow.
Do not use the official Bitwarden window as proof of either candidate's behavior.
The official signed app, profile and existing Keychain enrollment stay intact.

### Agent connection

1. Launch one compiled isolated instance and verify that its browser transport
   responds. An available backend alone is not browser or authentication proof.
2. Use the approved registered account and explicit owned tab. The first
   coordinated acceptance uses the isolated Incognito profile; it does not prove
   persistent profiles or login on another Mac.
3. Start one protected login job and check its account and provider label. The
   agent operates non-secret continuation controls. Do not place passwords or
   codes in ordinary browser typing calls, transcripts or logs.
4. If no usable local enrollment exists, the owner supplies Vault authentication
   privately once. The host seals a CLI unlock key, not the master password.
   Fingerprint-only normal unlock can be accepted only after enrollment succeeds.
5. The owner approves native Touch ID. The host fills the provider login and
   advances its supported normal controls. Provider MFA or CAPTCHA can still
   require the owner. Do not retry a rejected password blindly.
6. Verify the destination's signed-in account identity without reading inbox
   content. A transferred session or ready-to-verify state alone is not success.
7. Record the result. Later restore-after-restart and revocation checks are
   separate acceptance steps. Do not infer them from one successful enrollment.

If a status request times out, its state is unknown. Stop auth actions until
supported status is restored. If a job expires, report it rather than silently
creating another. A submit click that leaves enrollment unchanged does not prove
whether the fields were populated or native input was delivered.

### Desktop candidate

Use the latest artifact and instructions in `docs/desktop-build-2026-10-22.md`
on branch `work/vault-desktop-build`. Launch through normal macOS `open`. Stop
if macOS blocks it; do not bypass Gatekeeper or change security settings.

Check the selected self-hosted server before private sign-in. Keep browser
pairing, SSH, system AutoFill and autotype disabled. Do not copy the official
app's profile or export decrypted vault data. Accept desktop Touch ID, lock,
cancellation, restart and sync separately under the candidate's own identity.

## End the session

Stop the captured isolated instance and the standalone candidate. Verify the
test listener and exact processes are gone. Preserve data and enrollment. Save
only non-secret results, distinguishing source checks, observed native behavior
and pending acceptance. No VPS deployment or official-app replacement is part
of this session.
