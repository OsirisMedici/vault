# Agent Vault VPS deployment and first login

Osiris authorized the native Linux build, encrypted snapshot transfer, additive
VPS activation and first saved-account login test in this chat on 22 October
2026. The earlier readiness documents describe the state before this deployment.

## Verified result

The pinned full upstream engine and its web UI built on the existing x86_64
VPS. The companion is running and healthy, uses `unless-stopped`, and survived
an explicit service restart. Docker logging remains disabled. Its API and
proxy bind only VPS loopback ports 19431 and 19432. Existing Vault retained its
running image and service; no Vaultwarden migration or desktop replacement ran.

All 253 imported account pairs, 506 imported fields and 519 total fields are
present. Database integrity and actual Linux uid/gid65532 ownership passed.
The existing master unlocked the restored state. The running proxy's CA endpoint
returned the same certificate as the source snapshot. Its listening status
also confirms the CA provider loaded; no CA was installed into host trust.
The existing owner's normal password login succeeded privately, and the
refreshed member capability stayed in the protected local host configuration.

Vault's assembled engine client, imported-account provider, browser controller
and chat relay now use the VPS through the managed private SSH tunnel. A fresh
GoDial login completed from the login form, using the selected imported account
and VPS-held credential. Exact current email verification passed. No password,
session, cookie, MFA or key value entered the tool arguments or transcript.
The owned host session was closed and its clipboard cleanup was confirmed.

## Deployment identity and custody

- Host architecture: Linux amd64.
- Upstream: `v0.40.1`, commit `d5836ec3bb2315de38043d742ae5daca11a4944a`.
- Image: `osiris-agent-vault:d5836ec3bb2315de38043d742ae5daca11a4944a`.
- Image ID: `sha256:da4f8215ffb14b1c4be0c497863acf2842b399282b67983474e8563802765039`.
- Deployment recipe source: Vault integration commit `a815057`.
- Release directory: `/opt/osiris-agent-vault-release-a815057`.
- Compose file: `deploy/agent-vault/compose.yaml` below that release directory.
- New state root: `/opt/osiris-agent-vault`, with its private staging receipt.
- Container: `osiris-agent-vault-engine-1`.

The existing verified recovery snapshot supplied the input. Only `keys/` and
`runtime/.agent-vault/` crossed the authenticated SSH channel, without an
intermediate tar archive or Mac executable. A root-private input copy remains
under `/opt/osiris-agent-vault-import-20261022`. It is not an independently
encrypted off-host backup. The original snapshot, independent verification copy
and working Mac engine remain available for rollback. No credential import,
new enrollment, key rotation or source Bitwarden update was needed.

## Host client and private access

The Mac LaunchAgent `com.osirismedici.agent-vault-vps-tunnel` forwards only
`127.0.0.1:19431` to the VPS API loopback port through `hostinger-osiris`.
It starts at user login and reconnects after SSH exits. Its plist contains only
SSH options and the registered host alias, no engine capability or password.
Registration and live access were checked; a real Mac reboot was not tested.

The private integration directory retains the existing account manifest and
now uses a separate `member-token-vps` and `vps-control.json`. The Mac engine's
private control/session stays intact. Runtime configuration is not in Git.

```sh
python3 integrations/agent-vault/runtime/install-vps-tunnel.py
python3 integrations/agent-vault/runtime/configure.py --target vps
bun integrations/agent-vault/runtime/status.mjs
```

`configure.py` with no target retains the current target. An expired capability
triggers at most one normal existing-owner login. `--refresh-session` explicitly
performs that private login when required for an owner-authentication check.
It never changes provider website passwords or source Bitwarden data.

The backend's private management console was checked in this chat's in-app
Browser at `https://osiris.tailf4bdfc.ts.net:19443/`. The page identified as
Agent Vault and HTTPS health returned 200. Tailscale Serve proxies that unused
dedicated port to the SSH tunnel. The existing Mac-engine mapping on 18443 was
preserved. This console link currently depends on this Mac being awake/online;
the VPS engine itself does not. It is not a new public app URL.

For daily use, ask this chat to log into GoDial or ClickUp using the intended
saved account. Keep the in-app Browser active for native paste. The newly
accepted VPS login case is GoDial; ClickUp's earlier acceptance used the Mac
engine and was not repeated after cutover.

## Status and rollback

The following commands affect only the companion:

```sh
ssh hostinger-osiris 'sudo -n docker compose -f /opt/osiris-agent-vault-release-a815057/deploy/agent-vault/compose.yaml ps engine'
ssh hostinger-osiris 'sudo -n docker compose -f /opt/osiris-agent-vault-release-a815057/deploy/agent-vault/compose.yaml restart engine'
```

Return the host client to the preserved Mac engine first if the VPS path fails:

```sh
python3 integrations/agent-vault/runtime/configure.py --target local
bun integrations/agent-vault/runtime/status.mjs
```

Then stop only the companion if needed:

```sh
ssh hostinger-osiris 'sudo -n docker compose -f /opt/osiris-agent-vault-release-a815057/deploy/agent-vault/compose.yaml stop engine'
```

Keep its state, master material, input snapshot and release directory. Do not
delete data or pass `--volumes`, prune Docker, restore Vaultwarden or reset
Tailscale mappings. The tunnel and its dedicated 19443 mapping may remain for
recovery; their removal is separate cleanup, not a database rollback.

## Product boundary

This deployment connects the assembled Vault host integration to a live VPS
engine and proves one fresh website sign-in. The original Vault web/desktop
screens still use their existing implementation. A unified app UI, automatic
Bitwarden synchronization and the installed native MCP/Touch ID adapter are
not accepted by this deployment. The imported snapshot remains a separate
agent-engine copy, not one shared encrypted database or live sync.

Unattended external browser transport still lacks T3's supported per-thread
capability. The approved chat-assisted relay remains the working browser route.
Do not announce the complete team application as launched based on backend
deployment or this first login alone. No team message or source push was made.
