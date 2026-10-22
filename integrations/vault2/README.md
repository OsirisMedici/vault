# Vault 2 browser handoff

Active product development has moved to the independent public repository
[OsirisMedici/vault2](https://github.com/OsirisMedici/vault2) and its registered
Vault 2 T3 project. This directory preserves the original Vault-side helper
source and focused cleanup checks. It does not modify the frozen custom Vault
deployment, existing engine, T3 state, signed Bitwarden app or private data.

## Verified browser result

A real owner-assisted GHL run on Raven selected the intended saved account,
privately filled username/password, submitted once and reached email OTP
verification. Full sign-in and exact signed-in identity remain unverified.
The fill-and-submit command took 21.698 seconds, not a 1–3 second login result.
The clipboard was compare-and-cleared, temporary owner session revoked with a
rejected follow-up auth request, helper closed and lock released.

Earlier form/snapshot/input failures are historical platform findings. A fresh
owned tab and harmless input test subsequently worked. This publication is not
a new login attempt, and should not trigger another submission or OTP resend.

## Private account binding

The fixed GHL account selection is loaded from owner-only `ghl-selection.json`
inside the existing private runtime root. It contains version 1, fixed origin,
selected source ID and exact expected username. Actual values remain outside
source. Missing/unsafe configuration fails closed before engine access.
The helper pins thread, tab, profile, URL/control generation, origin, form and
account; its selection is single-use and expires in five minutes.

This is trusted local owner-assisted code using the shared clipboard, not a
strong isolation boundary against unrestricted same-user programs. It does not
use the proxy agent's token to reveal passwords or elevate its role.

Before any later authorized attempt, discover the current browser profiles and
open a fresh owned tab, establish readiness and prove harmless input. Never
operate an old thread's tab or inspect browser storage/cookies/session tokens.
Stop for owner MFA/CAPTCHA/recovery in the working page; no codes in chat or
email-code retrieval. Only exact website identity can establish signed-in.

Always close the helper. Logout followed by a rejected session check is required
for a revoked-session receipt; cleanup uncertainty must remain visible.

## Verification

Run `~/.bun/bin/bun test integrations/vault2/cleanup.test.mjs` for focused cleanup
fixtures. Syntax/bundling and fixtures do not establish live login acceptance.
The private-config extraction was checked without repeating authentication.
No dependency install, runtime restart, browser action or deployment is part of
this source publication. Future work belongs in the separate Vault 2 project.
