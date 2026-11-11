# Agent Vault transport readiness

22 October 2026. Scoped transport follow-up from committed `f079cb3`.

## Result

Unattended external browser transport remains an external host dependency.
This worker did not obtain a supported per-thread ACP capability. The installed
CLI recognizes `acp-mcp-call`, but the worker inherits neither its endpoint nor
its authorization. The single metadata-only acceptance probe exited 2 with
the expected missing-capability error. No browser tab or website was opened.

The manager can now check that boundary with a reusable command that emits only
environment-presence flags, fixed outcome codes, a process exit code and an
optional browser-availability boolean. It never prints raw CLI output, URLs,
tab metadata or authorization values. Configuration presence alone does not
mean the host is reachable or authorized for the intended tab.

The existing explicit chat relay remains the accepted route from the integration
handoff. This change does not alter or retest that relay, ClickUp or GoDial.

## Current supported-interface evidence

- The injected T3 tool catalog exposes `preview_status` and the other preview
  controls. A focused search found no external ACP capability provisioning tool.
  Catalog presence is not an external connector acceptance result.
- The installed public CLI reports `t3 v0.1.2-nightly.20261022.3512`.
  `t3 --help` lists the available public commands.
- `t3 browser --help` exposes only `setup`, described as Linux browser setup.
  It does not expose an alternative tab-control connector.
- `t3 auth --help`, `t3 auth session --help` and
  `t3 auth session issue --help` expose bearer session management, including
  `preview:operate`. Issuing a session creates app authorization and prints
  bearer material. It was not invoked. These help pages do not establish a
  per-thread ACP endpoint/authorization provisioning procedure.
- `t3 thread --help` exposes thread list/start/send/show, rather than an external
  browser tool transport.
- The installed public launcher invokes the bundled CLI through Electron's
  Node mode. No internal app implementation, database, tokens, private auth
  files or T3 session state were read.

This bounds the current worker's capability. It does not establish that every
T3 host or future version lacks an external provisioning mechanism.

## Owned implementation

`browser/transport.mjs` now exports `getT3TransportReadiness({env})`. It returns
only the four ACP variable presence flags and `configured`, which requires both
endpoint and authorization. It does not contact T3 or load the credential engine.
The runtime/provider status contract is unchanged.

`createT3CallTool({env})` now selects its default executable and optional
entrypoint from that supplied environment. Previously these defaults came from
`process.env`, even when a caller supplied a different environment for the child.
Explicit executable/entrypoint overrides still work. The tool allowlist,
missing-capability guard, private inherited authorization, output bound and
timeout remain intact. The inherited Electron launch form was not exercised
because this worker has no corresponding capability or launcher variables.

`browser/check-transport-readiness.mjs` runs exactly one external
`acp-mcp-call preview_status '{}'` probe with a 20-second timeout and bounded
captured output. It recognizes the installed CLI's fixed missing-capability
error without printing the captured output. It does not load the runtime,
credential provider, clipboard driver or engine. It also supports the documented
inherited Node/optional entrypoint launch form when the host actually supplies it.

## Required host prerequisite

The integration owner needs a supported T3 host launch mechanism that privately
supplies `T3_ACP_MCP_ENDPOINT` and `T3_ACP_MCP_AUTHORIZATION` to the trusted
connector, with authority bound to the intended thread and browser tab. If that
mechanism uses `T3_ACP_MCP_NODE` and `T3_ACP_MCP_ENTRYPOINT`, those launch settings
must come from the same host context. The host must own capability lifecycle
and renewal. A generic newly minted bearer session is not demonstrated to be
an interchangeable ACP capability.

No supported provisioning route within this worker's authorization was found.
Do not fill the gap by scraping app state, copying a token, changing active MCP
registration, patching the app or restarting sessions. Continue using the
explicit chat relay until the integration owner has that supported host path.

After provisioning, the manager can run the same command from the connector's
actual inherited environment. A `transport_reachable` result proves only that
the external status call returned a boolean `available`. It does not establish
control of a particular tab, identity verification or login acceptance. Those
remain separate manager-owned checks.

## Verification and reproduction

From the repository root:

```sh
bun integrations/agent-vault/browser/check-transport-readiness.mjs
```

The single live case `T01` produced:

```json
{"case":"T01","transport":"acp-mcp-call","configured":false,"environmentPresence":{"T3_ACP_MCP_ENDPOINT":false,"T3_ACP_MCP_AUTHORIZATION":false,"T3_ACP_MCP_NODE":false,"T3_ACP_MCP_ENTRYPOINT":false},"outcome":"blocked_external_dependency","cliExitCode":2,"browserAvailable":null}
```

The helper exited 2, as did the installed CLI. The captured CLI error matched:

```text
acp-mcp-call requires T3_ACP_MCP_ENDPOINT and T3_ACP_MCP_AUTHORIZATION.
```

Bun 1.4.4 bundled both transport modules with `--target=bun` into a temporary
directory, and `git diff --check` passed. No other acceptance case was run.

No installed service, engine data, account field, Keychain enrollment, shared
private configuration, protected Karen checkout, Bitwarden source/installation,
VPS deployment or active app session was changed. The previously reported
253 imported accounts, 506 imported fields and 519 total fields were not reread
or independently reverified by this transport-only task.
