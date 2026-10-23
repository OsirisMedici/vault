# Vault project contract

Bun is Osiris's global default for JavaScript/TypeScript dependencies and
scripts. Apply `~/.config/osiris-agent-rules/javascript-tooling.md` when working
on owned tooling. Pinned upstream build requirements remain compatibility
exceptions until a generated candidate is verified with Bun.

Vault is the durable home for this app. Reuse this repository and the existing
`OsirisMedici/vault` remote. Inspect current behavior, source, data boundaries,
licenses and Git state before proposing product changes.

Establish who the change serves, what they can do, why it matters and how success
will be recognized. Ask product questions only when their answers materially
change the result; discover repository facts locally. Explain plans in this order:
what we are building, why, the finished experience, included/excluded scope,
implementation, then testing and handoff. Correct scope or UX drift during work.

For desktop naming, packaging, Touch ID, updates or release work, first read
`docs/desktop.md`. For web releases or rollback, read `docs/operations.md`.
Keep original upstream checkouts pinned and clean; apply Vault changes to a
generated candidate. Preserve license and attribution boundaries.

The working official Bitwarden desktop app is separate from Vault's web branding.
Keep that signed installation, its data and its Keychain enrollment intact.
A candidate does not count as accepted until its own signing, security and human
Touch ID checks pass. Fingerprint-only CLI/agent unlock is not implemented.

Protected browser-login integration remains in Karen's
`infrastructure/vaultwarden/t3-agent-browser`. Coordinate with its owner before
changing it. This repository does not own that active checkout or its user data.
Keep passwords, MFA, cookies, sessions, vault data, exports, backups and T3 state
outside source control and transcripts.

Discover purpose-built tools before UI automation. Use T3 preview tools or the
in-app Browser for browser work. Keep personal Chrome outside automation.
Source pushes authorize source publication; deployment and installed-app
replacement require their own reviewed scope. Push explicit branches only,
never all refs or local T3 checkpoints. Verify the remote commit after pushing.

Finish with what Osiris can do, exact test steps, verified results and pending
acceptance. End every final user-facing response with the exact words
`over and out`, only when the turn is complete or a terminal blocker is explained.
