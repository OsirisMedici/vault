# Phase-two assembly status

Current release and pending acceptance are recorded in
[the v2 release ledger](agent-vault-v2-release-2026-10-23.md).
All five source assignments are assembled and the web/bridge are deployed.
The original browser-only status below is historical. Osiris requested that
Pranshi take over the remaining production work on Raven; the VPS stays live.
Seven of ten aggregate cases passed; three authenticated/browser cases remain.

Shared implementation base: `9598603d763dd2e092da7da78a4f346e2d3aca98`.
The original manager owns assembly and live acceptance. Workers keep their
assigned base even when this integration branch advances.

## Browser access: source accepted, live regression pending

Worker: `work/vault-v2-browser`, clean source handoff
`efca9403ad69e874584aa738a232c4865237ac0a`; remote SHA independently matched.
Cherry-picked into the integration branch as `e1cf42a`.

The manager reviewed all ten changed owned files against the common base. The
existing provider origins, selectors, identity rules, public response shapes,
chat-session and relay protocol remain compatible. Tab/thread/control checks
now precede credential retrieval and queued web-request claim. Additional
checks after engine I/O prevent filling after a tab changes. A preclaim denial
leaves the web job queued for explicit retry in a valid owned tab.

One aggregate acceptance case `B2` passed again in the assembled tree: 18 stale
selections caused zero credential reads/fills; 18 changes during synthetic
engine I/O caused zero fills; both retained provider identity rules passed.
The same case covers takeover/clipboard cleanup, exact account selection and
preclaim rejection. No real engine, clipboard, T3 browser or website calls ran.
Diff checks and the assembled commit's redacted Gitleaks scan passed.

No VPS deployment, UI rebuild, runtime configuration change or service restart
was necessary for this source assembly. The accepted live UI/GoDial result in
the web delivery record predates this hardening; it is not a live regression
claim for the new commit. Standalone transport still needs the supported T3
endpoint/authorization capability. The approved chat relay remains the path.

## Other assignments

- Credential sync is assigned to the isolated local `work/vault-v2-sync` chat.
- Pranshi's UI, permissions and CI work require startup through her coordinator.
  The detailed coordinator prompt is published, but remote startup has not
  been verified by this manager. Do not report those three workers as running
  without their actual host/worktree receipts.

The release budget remains ten focused acceptance cases. `B2` is one case,
including its assembly recheck, rather than a new website-login allocation.
