# Bitwarden bulk import handoff

## Outcome and scope

Osiris can test account selection against a private metadata manifest backed by
the existing local Infisical Agent Vault trial. The dedicated destination is
`bitwarden-import-20261022`. It contains one username/password pair for each
active, password-bearing individual login in the source export. Source records
remain intact. Live Bitwarden synchronization is deferred.

The manifest plus Agent Vault is the MVP credential source. No provider login,
password injection rule, wildcard host permission, externally exposed listener,
installed-app change, or production deployment was part of this import.

## Verified result on 22 October 2026

The official Bitwarden desktop app was unlocked. Its visible app settings
identified the expected owner. Its nonsecret active-account and per-account
environment metadata matched the expected owner and
`https://vault.scaleadvertisement.com`. No tokens, session state, Keychain
material, or decrypted desktop caches were extracted. The unauthenticated CLI
was not used for export or unlocked through an alternate authentication flow.

Normal desktop JSON export required master-password confirmation. Osiris
completed the private interaction and exported to Downloads. The helper moved
the single recent Bitwarden JSON file immediately into a private staging
directory, set its mode to 600, and consumed it without displaying its contents.

The present export had 256 records. The importer selected 253 active,
password-bearing individual login records and skipped 3 without passwords.
It imported 253 account mappings and 506 credential values, with zero errors.
All selected source records had UUIDs. No fallback identifiers were needed.

Only two acceptance cases were run:

| Case | Batch assertion | Result |
| --- | --- | --- |
| C06 | Eligible source count equals imported manifest account count | PASS, 253 equals 253 |
| C07 | Private destination readback equals every source username/password pair | PASS, 253 of 253 pairs |

The importer verified `unmatched_host_policy=deny` before writing credentials.
It created no service rules and did not write to `real-pilot`. Its management
requests used the existing loopback API at port 18431. It did not restart the
trial. The inspected upstream checkout was clean and pinned to
`d5836ec3bb2315de38043d742ae5daca11a4944a`.

## Private runtime artifacts

These files are outside all checkouts and must never be attached to a report or
committed:

- Manifest: `~/.config/osiris-agent-vault/integration-v1/import-manifest.json`,
  mode 600, parent directory mode 700.
- Staging directory:
  `~/.local/share/osiris-agent-vault-trials/bitwarden-import-20261022-staging`,
  mode 700.
- Aggregate receipt: `receipt.json` inside staging, mode 600.
- Nonsecret source-verification receipt: `source-verification.json` inside
  staging, mode 600.
- Destination ownership marker: `destination.json` inside staging, mode 600.

The temporary `export.json` was removed after the import. The Downloads copy was
moved, not duplicated. Removal is ordinary file deletion, not secure erase.
The preexisting trial backup was not restored, expanded, or acceptance-tested.

The manifest has exactly this top-level contract:

```json
{"version":1,"vaultName":"bitwarden-import-20261022","accounts":[]}
```

Each account has `accountId`, `name`, `username`, `origins`, `credentialRef`,
`sourceItemId`, `importedAt`, and an optional `loginUrl`. UUID source item IDs
remain the account reference. Credential references are `VW_` followed by the
uppercase UUID without hyphens. Values live in Agent Vault at the reference
plus `_USERNAME` and `_PASSWORD`. Duplicate source records remain separate.

Only valid HTTPS origins are retained. The optional login URL uses the first
valid HTTPS origin plus `/`; query strings, fragments and paths are discarded
to avoid carrying URL-embedded secrets into metadata. An origin is selection
metadata, not permission to inject a credential. Accounts without HTTPS origins
remain in the manifest with an empty origins array.

No passwords, TOTP seeds, passkeys, recovery fields, attachments, password
history, custom secret fields, cards, identities or secure notes are copied to
the manifest. The importer never reads those unrelated fields for transfer.

## Implementation and repeat procedure

Owned helper: `integrations/agent-vault/import/import_bitwarden.py`. It uses only
the Python standard library and keeps credential values inside the host process.
It reads the existing owner capability internally, ignores HTTP proxy settings,
refuses redirects, suppresses response bodies and tracebacks, writes at most ten
accounts per request, and retries transient local API failures at most twice.
The local script has mode 600 and runs through `python3`.

The successful command was:

```sh
python3 integrations/agent-vault/import/import_bitwarden.py
```

Do not rerun it for routine acceptance. C06 and C07 have already consumed this
worker's two-case budget. The aggregate receipt contains their results without
account inventory or secret values.

For a separately authorized retry after an interrupted import, use the same
source account and a fresh normal unencrypted JSON export at the exact private
staging `export.json` path with mode 600. Check current source identity privately
before updating the source-verification receipt. Run the command above from
the owning worktree. The helper rejects unrelated existing vaults, unrelated
manifests, unexpected credential keys, and any conflicting stored value. Equal
values are left intact. It can finish missing pairs after a partial write.
It does not replace or remove existing credentials. On success or failure it
unlinks the staged export and prints only the bounded receipt.

If a future export omits valid UUIDs, the helper records that count and derives
an opaque SHA-256 identifier from name, username, valid HTTPS origins and the
duplicate occurrence number. Passwords never participate. Such fallback IDs
depend on metadata and duplicate ordering, so future synchronization must not
assume they remain stable after source edits.

## Handoff and remaining acceptance

The manager can use the manifest's account reference and credential prefix to
implement explicit account selection against the trial. Reuse the existing
private runtime and deny policy. Do not publish the manifest or enumerate its
accounts in chat. Browser connector behavior and real provider sign-ins remain
separate acceptance work. No private interaction remains for this import.

This is a same-user local trial. It does not establish production isolation,
restore-tested backup recovery, or permission for future account actions.
The importer has a brief create-then-deny configuration interval before any
passwords are written because the upstream create API has no deny-policy
argument. No credentials were present in the new vault during that interval.
