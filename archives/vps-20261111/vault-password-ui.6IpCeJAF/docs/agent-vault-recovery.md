# Private local Agent Vault recovery snapshots

The recovery helper gives Osiris a consistent local engine snapshot and checks
an independent offline copy before reporting success. It does not restore or
start an engine. It never calls a website, Keychain, Bitwarden, T3 or the VPS.
The existing engine can keep running while SQLite takes its read snapshot.

Use Python 3.9 or newer with its standard-library SQLite module. This follows
the existing runtime manager's Python implementation and adds no dependencies
or JavaScript tooling changes.

## Create one snapshot

From the Vault checkout, choose a new, explicit absolute path directly below
the existing private backup directory. Substitute a unique name if this one
already exists. The helper refuses existing output paths and never overwrites.

```sh
python3 integrations/agent-vault/runtime/recovery.py create \
  --destination "$HOME/.local/share/osiris-agent-vault/engine/backups/recovery-20261022-01"
```

A successful invocation creates these owner-only paths below the destination:

- `snapshot/` contains the selected runtime files and a consistent SQLite backup.
- `verification-copy/` contains a separate byte copy of that snapshot. The helper
  opens this copied database read-only with SQLite's immutable option, with no
  service, network listener or decryption attempt.
- `receipt.json` records only fixed booleans and aggregate counts. The same
  bounded result goes to stdout. It contains no paths, identities, file contents
  or hashes of secret material.

Directories must be owned by the current user with mode 700. Files have mode
600, except the engine binary and manager, which have mode 700. Required input
files must already have those permissions and a single hard link. The helper
rejects symlinks in selected input paths, any symlink or extra entry in a saved
snapshot, unsafe ancestors, and output paths outside the existing
`~/.local/share/osiris-agent-vault/engine/backups/` tree. Ancestors above the
private root may allow reading/traversal but cannot allow group/other writes.
It does not resolve symlinks or repair permissions to bypass these checks.

File copies, SQLite backup progress and SQL checks have a cooperative
120-second deadline, with a three-second SQLite busy timeout. Each file is
limited to 128 MiB and the database to 512 MiB. Copy/query failures return
`ok: false` and a fixed reason code with exit status 1. Partial output stays
private. Treat exit status 1 as incomplete even if a receipt exists after a
final flush failure. Review or remove that exact new output directory privately
before trying a different unique destination.
The helper never deletes runtime files or recursively cleans backup storage.

## Exact snapshot scope

Paths below refer to the existing private engine root,
`~/.local/share/osiris-agent-vault/engine/`:

| Included path | Purpose |
| --- | --- |
| `bin/agent-vault` | Existing engine executable, matched to the public pinned binary identity in `runtime/manage.py`. |
| `bin/manage.py` | Installed runtime manager, retained as bytes without executing it. |
| `runtime.json` | Existing runtime settings and identity. Its absolute paths remain unchanged. |
| `keys/master-password` | Existing unlock input, copied privately without printing it. |
| `runtime/.agent-vault/agent-vault.db` | Entire SQLite database, including encrypted credentials, master-key wrapping, owner enrollment, grants, sessions, audit state and all older trial records. |
| `runtime/.agent-vault/ca/ca.crt.pem` | Existing CA certificate. |
| `runtime/.agent-vault/ca/ca.key.enc` | Existing encrypted CA key. |
| `runtime/owner-login.json` | Existing private owner recovery login used by the configuration helper. |
| `runtime/control.json` | Existing private enrollment/control settings used by the configuration helper. |

The database uses SQLite's backup API through one read transaction, so counts,
key wrapping and committed WAL data come from the same database view. The
output uses DELETE journal mode and has no WAL, SHM or PID files. The source
files and service configuration are never rewritten. Normal live requests can
continue to change the live database after the read snapshot.

The helper explicitly excludes the duplicate `runtime/dummy-master-password`,
clipboard sentinel, trial-agent file, pilot results, import receipt, PID, copied
WAL/SHM, installation receipt, previous backups and any other unlisted file.
Old trial database rows remain in the whole-database backup because deleting
or filtering them would change the preserved database.

It also excludes the LaunchAgent plist, private integration configuration and
import metadata manifest under `~/.config/osiris-agent-vault/`, browser profiles,
cookies, T3 state, source checkouts and Bitwarden data. This is an engine-state
snapshot, not a complete backup of the chat/browser integration or this Mac.
Rebuilding that integration requires its separately preserved metadata and a
reviewed configuration step. This helper does not modify shared private config.

## What successful verification proves

The source backup and independent copy must both pass SQLite `quick_check`.
The import must contain exactly 253 complete username/password pairs and 506
fields in the expected import vault. All 519 current fields must remain,
including the older trials. This fixed baseline deliberately rejects a changed
inventory instead of silently accepting a partial or different dataset.

The helper compares every selected non-database file to the live source during
creation, and every copied snapshot file to the saved snapshot during offline
verification. It checks the public pinned engine binary identity without
printing its digest. It checks that the existing encrypted master-key wrapping
is present, with no plaintext DEK, and compares the entire master-key and
CA-state records between source, backup and verification copy. Secret-file
hashes are used only inside the process for equality and are never printed or
saved. The master password and CA key/certificate bytes must be unchanged.

Known key, enrollment or runtime-file changes during creation cause refusal.
Avoid planned master-password rotation, CA rotation, enrollment changes or
runtime upgrades during this short operation. There is no cross-file/SQLite
transaction or protection against a hostile process running as the same user.

## Recheck an existing snapshot

Choose another fresh output location. This command never contacts the live
engine or compares against its current credential data. It checks the saved
snapshot against the pinned binary and inventory contract, makes a new copy,
and checks that copy against the saved snapshot.

```sh
python3 integrations/agent-vault/runtime/recovery.py verify \
  --snapshot "$HOME/.local/share/osiris-agent-vault/engine/backups/recovery-20261022-01/snapshot" \
  --copy-to "$HOME/.local/share/osiris-agent-vault/engine/backups/recovery-recheck-20261022-01"
```

Exit status 0 requires `ok`, `database_ok`, `offline_copy_verified`,
`binary_identity_ok`, `required_files_equal` and `unlock_material_equal` to be
true, with counts 253/506/519. `create` also reports
`consistent_sqlite_backup: true`. A recheck does not claim comparison to the
live runtime or authenticate a historical snapshot against an external trust
anchor. Editing both copies could defeat equality checks.

## Restore boundary and repeatable recovery steps

1. Keep the original snapshot and its receipt private. Recheck it into a new
   directory with the command above before planning recovery.
2. Use the verified copy for a separately reviewed isolated-engine recovery
   exercise. Choose a private directory, independent ports and an explicit
   startup plan before running anything. `runtime.json` and the manager still
   name the original live root. **Do not execute the copied manager as a way to
   test the snapshot.** It can target the live engine.
3. Obtain approval for a decryption/startup exercise that privately supplies
   the copied master material through stdin, verifies a credential through a
   trusted consumer, checks CA usability, and leaves the live service alone.
   Those actions are not implemented or performed by this helper.
4. Treat production replacement, LaunchAgent changes, and chat/browser
   integration rebuilding as separate reviewed work after isolated acceptance.

A controlled SQLite-copy check is not complete disaster recovery, cryptographic
decryption acceptance or service-restoration acceptance. The snapshot includes
the master password beside encrypted data; owner-only permissions do not make
it an independently encrypted archive or a new isolation boundary. Both copies
are on the same disk. Disk loss, hostile same-user access, off-host transfer,
backup encryption, retention and recovery on another Mac remain untested.
Do not commit or attach this snapshot, its keys, or any private runtime files.

## Local acceptance on 22 October 2026

The single allocated case passed with exit status 0. The private result remains
outside source at:

```text
~/.local/share/osiris-agent-vault/engine/backups/recovery-20261022-worker-c1fa579e/
```

Its `snapshot/`, independent `verification-copy/` and mode-600 `receipt.json`
remain preserved. The result reports `consistent_sqlite_backup`,
`offline_copy_verified`, `database_ok`, `binary_identity_ok`,
`required_files_equal` and `unlock_material_equal` as true. Counts are 253
imported accounts, 506 imported fields and 519 total fields. Decryption,
service restore and off-host recovery report false, meaning untested.

The command read the existing engine files and made new private backup output.
It did not restart a service, restore production data, change shared config,
perform a website login or transfer data off-host. Python AST parsing and
`git diff --check` also passed. No second backup case, failure matrix or
standalone recheck invocation was run.
