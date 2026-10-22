# Agent Vault evaluation

Dummy-only evaluation of Infisical Agent Vault at commit
`d5836ec3bb2315de38043d742ae5daca11a4944a`, tagged `v0.40.1`.
This is a test harness, not an enabled Vault integration.

The intended outcome is scoped API access without giving an agent the underlying
API key. Agent Vault does not provide Vault's pending protected T3 website-login
adapter. Read the [assessment](../../docs/agent-vault-evaluation-2026-10-22.md)
and [source review](../../docs/agent-vault-research-2026-10-22.md) before integration.

## Run

Requires Python 3, Git, network access for pinned source/dependencies, and Go
1.26.10 or newer. Run from the Vault root:

```sh
python3 integrations/agent-vault-eval/run.py \
  --go /absolute/path/to/go \
  --results /tmp/agent-vault-results.json
```

An optional `--source /path/to/checkout` reuses a clean checkout at exactly the
pinned revision. `--cache-dir /tmp/vault-evaluation-cache` reuses Go build and
module caches. The runner never changes the source checkout. It runs six upstream
package suites, then copies the source into a disposable candidate and adds the
Vault-owned evaluation fixture there. Build/test execution uses upstream code;
review a new pin before changing it.

The fixture uses actual HTTP handlers, SQLite credential storage, credential
resolution, session authorization and the forward proxy. Only local listeners
and fake credentials are used. It grants the test process access to
`127.0.0.1/32` through the network guard and resolves its mock hostname with a
process-local DNS server. It does not change system DNS, hosts files, trust
stores, application registration, Keychain, installed apps or Vault data.
The generated CA and encryption key stay inside the disposable test.

The custom test uses local HTTP so the real store, API and proxy can be tested
together without installing a trusted CA. The upstream proxy suite separately
tests HTTPS CONNECT, injection and upstream certificate rejection. This is not
acceptance of a production HTTPS deployment, browser integration or container
isolation. Telemetry is disabled and live provider integration-test flags are
removed from the runner's environment.

Successful execution closes listeners and removes temporary candidates, test
databases and CAs. By default the Go caches are also temporary. If requested, the
JSON artifact records test identities, counts and outcomes, excluding arbitrary
test output and response bodies. Tests that deliberately reproduce limitations
count as passing checks, not as security acceptance.

## Scope of the 11 checks

- Inject the dummy bearer credential and strip broker authorization upstream.
- Observe default passthrough for an unmatched path.
- Explicitly deny unmatched paths without contacting upstream.
- Block proxy-role reveal, credential mutation, token minting and settings changes.
- Reject access to another vault.
- Return credential names without values in discovery.
- Store a ciphertext credential record.
- Demonstrate that an allowed path also permits POST.
- Demonstrate an allowed upstream echoing the credential back to the caller.
- Keep the dummy credential and scoped token out of captured structured logs.
- Revoke the scoped token and reject a subsequent plain HTTP proxy request.

Expiry, established CONNECT/WebSocket revocation, restart/key wrapping,
container egress, real providers, native approval and website sign-in remain
outside this trial. No real credential should be added to this harness.
