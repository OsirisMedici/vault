# Imported account credential provider

This branch adds metadata lookup and private credential consumption for the
first imported Bitwarden snapshot. It lets the trusted host choose a distinct
account and pass its credential to the browser consumer. It does not import,
unlock, synchronize, deploy, register tools, or perform a website login.

## Owned source

- `integrations/agent-vault/credentials/provider.mjs`
- `integrations/agent-vault/credentials/smoke.mjs`
- `docs/agent-vault-credentials-handoff.md`

The only module export is `createCredentialProvider`. It uses Node built-ins
with no package installation. The frozen engine and browser modules are injected
and are not modified on this branch. Original source remains GPL-3.0-only under
the repository license; no upstream implementation was copied.

## Instantiate inside the trusted host

```js
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createEngineClient } from '../engine/client.mjs';
import { createCredentialProvider } from './provider.mjs';

// These values come from the manager's private, validated engine configuration.
// Never log engineConfig or its capability files.
const engine = createEngineClient(engineConfig);
const credentials = createCredentialProvider({
  engine,
  manifestPath: join(homedir(), '.config/osiris-agent-vault/integration-v1/import-manifest.json'),
});
const controller = createLoginController({ credentials, driver });
```

The import specifiers above are relative to a host entrypoint in `credentials/`.
`createLoginController`, `driver`, and `engineConfig` are supplied by integration.
No real runtime file is required for the fixture command below. A manifest path
must be absolute. The reader checks the immediate parent is an owner-owned
mode700 directory, and the file is an owner-owned mode600 regular file. It
rejects file and immediate-parent symlinks, opens with `O_NOFOLLOW`, checks inode
identity, and bounds the read to 16 MiB. File replacement or modification during
the read fails closed. This is a same-user workflow boundary, not isolation
against unrestricted host code or protection against every ancestor-directory
rename race.

The accepted manifest has version 1, vaultName `bitwarden-import-20261022`, at
most 20,000 rows, and the frozen metadata fields. Unknown fields fail validation,
including password, notes, tokens, and cookies. Optional `sourceItemId` and
`loginUrl` stay internal and are never returned. A loginUrl must be HTTPS without
embedded credentials and belong to one of that row's origins. It grants no
additional permission. Empty origin lists are accepted for imported logins that
have no approved HTTPS origin; those rows cannot resolve for browser use.
References must match `VW_` followed by 1 to 128 uppercase ASCII letters/digits.
Duplicate account IDs or credential references fail validation; distinct source
records with the same name and username remain separate candidates.

## Host calls and bounded failures

```js
const status = await credentials.status();
const matches = await credentials.findAccounts({
  query: 'example', origin: 'https://app.example.invalid',
});
// The controller requires explicit selection when several candidates match.
// This callback runs only in trusted host code. Return bounded status only.
const result = await credentials.withCredential({
  accountId: selectedAccountId, origin: 'https://app.example.invalid',
}, (login) => driver.fillLogin({ ...boundBrowserRequest, ...login }));
```

`status()` returns only `ready`, `import_required`, or `engine_unavailable`.
It checks the manifest before calling engine health. Missing/unsafe/malformed
metadata never becomes a ready status. Metadata search does not need engine
health; it can return approved candidates while the engine is unavailable.
Queries are case-insensitive substrings of name, username, and approved origins,
bounded to 256 characters. An empty query lists candidates only for the required
exact origin. HTTPS origins normalize host case and default ports. Paths other
than `/`, queries, fragments, credentials, backslashes, and wildcards are denied.
There is no suffix or subdomain matching.

`findAccounts` returns projected AccountMetadata with accountId, name, username,
origins, and credentialRef. On manifest failure it returns
`{state:'import_required', reasonCode}`. Invalid search inputs throw a bounded
error. `withCredential` validates membership and origin before invoking
`engine.withLogin`. It requires an exact, case-sensitive engine username match
to the manifest. There is no email/provider normalization at this boundary.
It invokes the consumer once and returns the consumer's result, as required by
the frozen contract. It never forwards an engine return object. The trusted
consumer is responsible for returning bounded status, never a credential.

Failures have only static messages and stable `state` and `reasonCode` fields;
the provider removes stacks and never attaches upstream errors or causes.
Serialize only `state` and `reasonCode` at the MCP boundary.

| reasonCode | state | Meaning/action |
| --- | --- | --- |
| manifest_missing | import_required | No absolute manifest path configured, or file/parent missing. Complete the separate authorized import/configuration. |
| manifest_unavailable | import_required | Private read failed. Inspect access locally without printing file contents. |
| manifest_unsafe | import_required | Owner/mode/type or read consistency check failed. Correct the private file outside source. |
| manifest_too_large | import_required | Manifest exceeds 16 MiB. |
| manifest_invalid | import_required | Version, vault name, schema, reference, duplicate ID/reference, or origin is invalid. |
| invalid_query | denied | Query is not a bounded string. |
| invalid_origin | denied | Destination is not an exact normalized HTTPS origin. |
| account_not_found | denied | Selected account is not in the snapshot. |
| origin_not_allowed | denied | Selected account does not include that exact origin. |
| username_mismatch | denied | Engine username differs from imported metadata. Explicit refresh/reconciliation is required. |
| credential_invalid | engine_unavailable | Incomplete credential or invalid engine callback behavior. |
| engine_unavailable | engine_unavailable | Missing engine interface, failed read, or denied engine capability. |
| invalid_consumer | failed | No trusted consuming function supplied. |
| consumer_failed | failed | Consumer failed; its exception is suppressed. |

The first successful metadata load is cached for this provider instance. Failed
loads are retried on a subsequent call. The optional `now` argument is accepted
for interface compatibility; this snapshot has no time-based expiry. Imported
snapshots can become stale until explicitly refreshed. After refresh, instantiate
a new provider or restart its future host through the normal reviewed process.
There is no automatic Bitwarden synchronization or source mutation.

Manifest origins constrain account resolution. They do not authorize new web
providers. The controller must continue enforcing the fixed ClickUp/GoDial routes,
thread/tab binding, selection expiry, and observed identity checks. A manifest
credentialRef by itself is never authority.

## C03 run and result

From the repository root, with Node supporting ESM and the used built-ins:

```sh
node integrations/agent-vault/credentials/smoke.mjs
```

This single acceptance exercise creates an owner-private temporary manifest
outside the checkout, injects a fake engine, preserves two matching source
records, explicitly selects one, checks its exact reference and origin, and
checks that only the trusted consumer sees the dummy credential. It confirms
that public metadata and the returned bounded result contain no password and
that the engine's own return object is discarded. The fixture removes its owned
temporary directory on exit. The command prints one bounded PASS/FAIL receipt.

On 22 October 2026, C03 passed on its first run with Node v26.12.0, exit code 0.
Both modules passed `node --check`; the owned staged diff passed
`git diff --cached --check`. A narrow source scan found no private-key blocks or
recognized token literals. These source checks do not add acceptance cases.
No historical upstream suite, real engine read, private import action, or real
website login was run. There is no known fixture interface blocker. Real private
configuration and assembled engine/browser behavior remain unverified until
later integration and the manager-owned acceptance cases.
