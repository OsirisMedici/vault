# Agent Vault trial and integration decision

Latest outcome: the later real-account pilot below supersedes the earlier
dummy-only scope statements. Five copied login pairs now exist in the isolated
trial. Website sign-ins used a privileged private-paste helper, not the generic
proxy or the registered proxy-only agent. See the
[next-step proposal](plans/agent-vault-next-steps-2026-10-22.md).

22 October 2026. Outcome: useful for a bounded API-broker experiment, with conditions.
Do not merge its storage, cryptography or proxy core into Vault. Keep the existing
protected website-login implementation and its owners separate.

## What we evaluated and why

Osiris asked whether [Infisical Agent Vault](https://github.com/Infisical/agent-vault)
can help Vault and requested a trial before merging code. The useful capability
is an agent making an authorized API request while the broker supplies the API
key. The agent receives a short-lived proxy capability rather than the API key.
This could extend Vault's agent access to selected APIs.

The finished experience would be approving a particular API operation, running
it through a trusted broker, and receiving an approved response. A useful result
must also reject unauthorized operations and keep credentials and sessions out
of ordinary agent output. Simply hiding outbound credentials does not meet that
whole contract.

The trial included source review, six upstream package suites and a Vault-owned
11-check integration fixture using fake credentials. It excluded real providers,
browser sign-in, Touch ID, installed apps, deployment, real vault data, container
isolation and production security acceptance. No production integration or
source merge was made.

## Exact source and environment

- Vault baseline `adf6d29dd68b59eb10fe51975844a7018d0a49d6`, branch `main`, initially clean.
- Agent Vault tag `v0.40.1`, commit
  [`d5836ec3bb2315de38043d742ae5daca11a4944a`](https://github.com/Infisical/agent-vault/commit/d5836ec3bb2315de38043d742ae5daca11a4944a).
- macOS arm64, temporary Go `1.26.10` toolchain. Official archive SHA-256
  `0b5183492292ada170f9b561a834863808dd02edba599e4ad0e89899330020b3`
  was checked against the [Go download metadata](https://go.dev/dl/?mode=json).
  No global Go installation was made. Docker was unavailable because its daemon
  was stopped, so no container or firewall acceptance is claimed.
- Upstream remained a clean, pinned external checkout. The fixture ran in a
  generated copy. Real server handlers, SQLite storage, credential resolution,
  session authorization and a forward proxy communicated over local listeners.
  The fixture's encryption key, database and CA were temporary.
- Telemetry was disabled. The local mock was reachable through a process-only
  loopback network exception and DNS resolver. No system trust or DNS changes
  were needed. The custom integration used HTTP locally; upstream's MITM suite
  separately exercised HTTPS CONNECT and certificate validation.

## Observed results

The six upstream suites passed: `internal/broker`, `internal/mitm`,
`internal/server`, `internal/store`, `internal/crypto`, and `internal/auth`.
The [machine-readable results](../integrations/agent-vault-eval/results-2026-10-22.json)
record their test counts and skips. Live provider tests are outside acceptance.

All 11 custom checks passed. Several intentionally confirm limitations:

1. The broker injected the fake bearer credential. Its own proxy authorization
   did not reach the mock API.
2. An unmatched path reached the mock under the default passthrough policy.
3. After selecting `unmatched_host_policy=deny`, that path returned HTTP 403
   without contacting the mock.
4. A proxy-only token could not reveal or replace credentials, mint a token,
   or change vault settings.
5. That token could not access another vault's credential list.
6. Discovery exposed the credential key name without its value.
7. The stored credential record contained ciphertext rather than the fake value.
   This checks the record, not master-password wrapping or a complete disk audit.
8. POST reached an allowed path. Service matching did not supply action approval.
9. The allowed mock echoed its injected Authorization value, and the caller
   received it. Outbound injection does not enforce response non-disclosure.
10. Captured structured logs omitted the fake credential and scoped token.
11. Revoking the scoped token caused a subsequent plain HTTP proxy request to
    return HTTP 407 without contacting upstream.

Token expiry and revocation inside an established CONNECT tunnel or WebSocket
remain untested. The source review flags authentication captured at tunnel
creation. Do not extend result 11 to those cases. Restart/key wrapping, isolation,
direct egress prevention and real provider behavior also remain untested.

## Integration decision

Agent Vault supplies useful API credential injection, vault-bound proxy tokens,
management, service matching and revocation. Use its supported external API/CLI
or SDK if a specific API pilot warrants it. Keeping it separate preserves a
clear upstream update path and avoids maintaining a second cryptographic store
inside this repository.

The first pilot should expose one named read operation through a Vault-owned
adapter. The trusted adapter should validate the destination, method and input,
then reconstruct a narrow response. Use a dedicated API identity with provider
permissions limited to that operation, a separate vault, explicit host/port/path
rules, strict unmatched denial, and a short-lived proxy-only session. Keep token
minting and administrative credentials outside the agent. For stronger protection,
put the broker and its state outside an unrestricted agent's host access.

This adapter is a proposal, not code implemented by the trial. Prove it with a
dummy provider before considering a real API identity. Existing GHL mutation
approval requirements remain applicable; broker access is not action permission.

Agent Vault does not supply the pending T3 browser adapter, private native
approval, protected session handoff or verified website identity. Its generic
response channel can return secrets, and its response filter removes Set-Cookie.
It therefore does not solve the current GoDaddy website-login acceptance.
The [source assessment](agent-vault-research-2026-10-22.md) explains these findings,
same-host risks, TLS interception, licensing and the lack of a documented
Vaultwarden credential-store backend, with pinned primary-source links.

The upstream core is MIT-covered subject to its enterprise-directory and
third-party exceptions. This trial copied no upstream implementation into Vault.
Any later reuse must retain upstream notices and respect Vault's existing
component licenses.

## Reproduce and handoff

The reusable [trial instructions](../integrations/agent-vault-eval/README.md)
explain the test scope and prerequisites. From the Vault root, use Go 1.26.10
or newer:

```sh
python3 integrations/agent-vault-eval/run.py \
  --go /absolute/path/to/go \
  --results /tmp/agent-vault-results.json
```

During this session the checked toolchain remains temporarily available at
`/tmp/vault-agent-vault-eval.rIoisH/go/bin/go`. The clean source is beside it in
`/tmp/vault-agent-vault-eval.rIoisH/upstream`. These are temporary paths, not an
installed service. The reusable runner removes its generated candidate and all
test state after completion. Optional explicit Go caches remain reusable.

Only this assessment, the source-review document and the dummy-only harness and
result artifact were added to Vault. Existing Vault runtime code, upstream
submodules, Karen integration, installed clients and real credentials were not
changed. Nothing was pushed, deployed or installed.

## Standalone app follow-up

Osiris subsequently separated this Infisical trial from native T3 adapter work.
The standalone web UI and Go binary were built in an external generated copy.
A small trial-only path override isolates database, CA, PID, session and server
log defaults. The pinned original remains clean; authentication and proxy logic
were not changed. The four affected storage/CA/PID/session package suites passed.

The standalone demo runs with a dummy owner, three dummy credentials, two
service rules, a password-wrapped data key and strict unmatched denial. Its UI
was opened through a private Tailscale HTTPS mapping in this chat's Incognito
app browser. Normal UI sign-in succeeded and both service rules rendered.
The broker listener remains loopback-only. No real Vault credentials were used.

Five live checks passed against the running binary: HTTPS bearer authentication,
HTTPS Basic authentication, unmatched-destination denial, proxy-role credential
reveal denial and revocation on a new CONNECT request. The successful auth tests
used httpbin's test endpoints and dummy values, not real website accounts.
See the [standalone result artifact](../integrations/agent-vault-eval/standalone-results-2026-10-22.json).

The temporary demo remains running for inspection. Its private URL, exact process
receipt and cleanup instructions are in the ignored standalone-scope handoff.
It requires this Mac and the owned process to remain online. Npm reported two
high-severity dependency findings; this trial did not remediate them or establish
production security acceptance. An optional external font was blocked by the
app's CSP; primary UI behavior worked. No native T3 adapter installation or
browser website-session acceptance is part of this standalone test.

## Later real-account browser pilot

Osiris explicitly authorized selecting five saved accounts, copying their
credentials from the official desktop Bitwarden app, registering a test agent,
and trying the website logins in this chat's app browser. Five username/password
pairs were copied into the isolated `real-pilot` vault and privately read back
for equality. Original Bitwarden entries were unchanged. No plaintext export,
password, cookie, owner capability or agent token was added to this repository.
The trial owner's initial dummy password was replaced with a random private one
before real credentials were imported.

The registered agent has instance role `no-access` and vault role `proxy`.
Runtime checks confirmed credential-name discovery, denial of password reveal,
denial of credential writes and settings changes, and denial of another vault.
The agent successfully used a dummy HTTPS API credential. No service rule was
configured to inject the real pilot passwords into a public echo endpoint.

The browser tests used an additional trusted local helper with privileged
credential access. It moved one selected password through the native clipboard
into the app browser without returning its value to the model, then cleared the
clipboard. This proved a working private-fill mechanism, not a production
authorization boundary. The unrestricted same-user agent could access the
helper and its administrative state; the proxy-only token was not sufficient
to perform these website sign-ins.

| Website | Observed result |
| --- | --- |
| ClickUp | Signed in and verified the expected account email in profile settings. |
| GoDial | Reached the signed-in dashboard. Exact account identity was not independently checked. |
| Cal.com | One attempt returned incorrect email/password. No further attempt. |
| Kit | Requested new-device email verification. Osiris identified the email as obsolete and stopped this attempt. |
| Closebot | Saved V1 URL redirected to the retirement notice. Old credentials were not submitted to V2. |

A separate dummy cookie test reproduced that direct access can establish the
session while the generic broker strips `Set-Cookie`. Do not route a normal
browser session through that proxy and assume cookie login will work.

Osiris stopped live login testing, then requested an explanation and next-step
recommendation. No further login attempts, migration, source merge, production
deployment or installed-app replacement were performed. The earlier private
scope note contains runtime custody and must no longer be treated as disposable
dummy-only state. A copied runtime directory exists privately, but a restore
test has not established recovery acceptance.
