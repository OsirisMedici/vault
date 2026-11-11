# Incremental credential synchronization

This trusted-host API lets the manager review and explicitly apply changes to
already imported accounts. It keeps their account IDs, credential references,
source IDs and original import timestamps. It updates only changed username or
password fields and approved metadata. Missing source items remain intact.
New source IDs are counted as unowned and never imported by this pipeline.

The owner should be able to refresh a changed credential without rerunning the
253-account importer. A successful operation means that the destination matches
the reviewed source, private receipts and metadata have committed, and no secret
has appeared in the result. It does not mean a website has accepted the new
credential. Live synchronization is **not accepted** by this delivery.

## Supported source and authorization prerequisite

The implemented adapter reads an owner-created, normal, unencrypted Bitwarden
JSON export at one explicit private path. It does not extract browser storage,
Keychain, Electron internals, desktop caches, process memory or session tokens.
It never logs in, unlocks, exports, deletes the export or invokes Bitwarden.

Bitwarden documents normal [JSON exports](https://bitwarden.com/help/export-your-data/)
and private owner confirmation. Its [CLI documentation](https://bitwarden.com/help/cli/)
also documents server configuration, login, unlock, session keys, `bw sync` and
`bw list items`. Login with an API key still requires unlock to read vault data.
The CLI route requires separate integration and is not implemented here.
Neither route establishes unattended unlock. Documentation was inspected on
23 October 2026. No live source was acquired during implementation.

Before live enrollment or sync, the manager must arrange all of these:

1. The owner uses the normal Vault/Bitwarden interface to sync the correct
   individual vault and authorize a fresh JSON export, completing any private
   confirmation personally. Do not paste passwords, exports or sessions into chat.
2. The trusted host privately verifies the exact source server origin and owner
   UUID against the existing import's source-verification record and destination
   ownership marker. Those records are described in
   [the import handoff](agent-vault-import-handoff.md). Do not display them.
3. A trusted host callback attests that identity, the export method and actual
   acquisition time. JSON exports do not contain authenticated owner identity.
   The attestation is an owner-custody prerequisite, not identity discovered
   from export contents. Do not manufacture a fresh timestamp for an old export.
4. Keep the export outside all source/worktrees, mode600 in a canonical mode700
   owner-owned directory. The default acquisition window is ten minutes. Arrange
   private retention/cleanup after apply or reconciliation. Deletion is not
   secure erase. This API deliberately leaves source custody with the manager.
5. Supply the existing engine member/admin capability privately and coordinate
   exclusive access before apply. No other consumer, importer or writer may
   operate on these pairs until the operation finishes.

No authenticated source session or fresh export was configured for this worker.
The initial export was removed after the import. An unlocked official desktop
app is not a CLI session or permission to extract its data. The exact remaining
owner action is a fresh normal export and private server/owner verification.

## Integration API

New source lives only in `integrations/agent-vault/sync/`. There are no packages,
dependencies, new endpoints, MCP tools, timers or runtime registrations. Original
source is GPL-3.0-only under the repository license. No upstream code was copied.
Use Bun 1.4.4. The existing Node 26.12.0 full Angular compiler exception remains
unchanged; no Angular build is needed for these modules.

The manager supplies the private paths, already validated engine configuration,
source identity, source attestation callback and exclusive-access callback:

```js
import { createPrivateExportSource } from './integrations/agent-vault/sync/source.mjs';
import { createSyncEngine } from './integrations/agent-vault/sync/engine.mjs';
import { createCredentialSync } from './integrations/agent-vault/sync/sync.mjs';

const source = createPrivateExportSource({
  exportPath: privateExportPath,
  expectedIdentity: verifiedSourceIdentity, // {vaultOrigin: HTTPS origin, ownerId: UUID}
  authorizeSource: async () => ({
    method: 'bitwarden-json-export',
    identity: verifiedSourceIdentity,
    acquiredAt: actualExportAcquisitionTime, // ISO timestamp, not the current request time
  }),
});
const sync = createCredentialSync({
  source,
  engine: createSyncEngine(privateEngineConfig),
  manifestPath: existingImportManifestPath,
  statePath: privateSyncStatePath,
  journalPath: privateSyncJournalPath,
  withExclusiveAccess: managerCoordinatedExclusiveAccess,
});

// First use only. Plan enrollment, review counts, then explicitly approve.
const enrollment = await sync.plan({ mode: 'enroll' });
// Only proceed when enrollment.state === 'planned' and the owner approved it.
const enrolled = await sync.apply({ planId: enrollment.planId, approved: true });

// Later, with a newly authorized export, review the next plan before applying.
const plan = await sync.plan();
// Only proceed when plan.state === 'planned' and the owner approved it.
const result = await sync.apply({ planId: plan.planId, approved: true });
```

`plan` returns `state: 'planned'`, a random `planId`, `mode` and aggregate
`counts`. Counts are `enrolled`, `changedAccounts`, `credentialFields`,
`metadataAccounts`, `unchanged`, `missing`, `unowned` and `skipped`. `apply` and
`resume` return `state: 'applied'` with the same bounded projection. Failures
return only `{state:'blocked', reasonCode}`. No account inventory, paths, field
values, native errors or hashes leave these methods. Plan results are not
accepted as apply arguments other than their opaque plan ID. The plan remains
inside that API instance for five minutes. A new plan replaces the old one.
Recreate the API instance with the newly authorized source for a later export.

`withExclusiveAccess` is a trusted host function that must establish the
manager's real exclusion, invoke its callback exactly once, await it, and keep
other readers/writers quiesced until it settles. It must release exclusion in
`finally`. A function that simply invokes the callback is suitable only for the
isolated fixture. No lock protocol exists in the old importer or consumers, so
the local sync lock alone cannot exclude them. Do not run live apply until the
manager has implemented or operationally established this exclusion. This
delivery changes no consumer or runtime configuration.

The engine adapter uses the existing transport, its private capability reader,
TLS/address validation, redirect denial, response bounds and timeout. It targets
only `bitwarden-import-20261022`. It reveals exactly the two keys for each
manifest-owned reference and writes only the changed subset of those keys.
It never lists credentials, provisions a vault, changes settings or deletes
anything. The pinned upstream is v0.40.1,
`d5836ec3bb2315de38043d742ae5daca11a4944a`. Its
[credential handler](https://github.com/Infisical/agent-vault/blob/d5836ec3bb2315de38043d742ae5daca11a4944a/internal/server/handle_credentials.go)
offers single-key reveals and sequential field writes, without a transaction or
compare-and-swap. The new adapter handles its omitted empty static username
value and rejects OAuth/dynamic credentials. The existing engine client is
unchanged.

## Ownership, baseline and preserved data

Enrollment creates only a private synchronization baseline and receipt. It
does not reimport or write engine credentials. Every existing manifest row must
have a stable source UUID, its engine username must equal manifest metadata,
and both engine fields must exactly match the authorized source. If a password
has already changed before enrollment, stop at `baseline_source_mismatch`.
The manager must reconcile that specific source/destination discrepancy under
separate owner authority. There is no option to trust and overwrite an unknown
baseline. Historical fallback IDs cannot enroll through this route. The import
handoff records that the existing 253 accounts all had UUIDs; this worker did
not reread their private manifest.

The baseline contains private keyed HMACs for each owned field, a manifest HMAC,
the verified source identity, revision and aggregate receipt. Its random key
and all hashes remain private. They are never public fingerprints of passwords.
The key shares the same private-file boundary as the baseline, so unrestricted
same-user code can alter both. This is a practical trusted-host workflow, not
isolation from that code. JavaScript strings cannot promise memory erasure.

Every plan compares all current owned pairs to the baseline. Any unexpected
destination change blocks the entire plan, even for an item omitted from the
source. Apply repeats that check and checks each pair directly before writing.
An unrecognized manifest change also blocks rather than adopting new ownership.
Unrelated engine keys are neither read nor written. A missing destination field
is a conflict, not permission to recreate the pair.

Only individual, active, password-bearing login records participate. Organization
items, archived/deleted items, non-login types and passwordless items are skipped.
An omitted or skipped formerly imported account is retained without deletion or
revocation. A separate manager-owned revocation process is required if desired.
Eligible source items need unique UUIDs. Duplicate or malformed UUIDs fail
closed; no metadata/password-derived replacement ID is generated.

For matched accounts, synchronization owns `name`, `username`, valid HTTPS
`origins` and the optional `loginUrl`. It preserves account IDs, references,
source IDs, import times and account ordering. Only a retained approved origin
can keep an existing login URL. Changed origins receive an origin-root URL;
URI paths, queries, fragments and embedded credentials from source are dropped.
Manifest fields stay within the existing strict schema. Notes, TOTP, custom
fields, attachments, passkeys and other source fields are never transferred.
Changed origins do not authorize new browser providers or expand team grants.

## Atomic files and interrupted applies

Use the existing private manifest and two new sibling files, for example
`sync-state.json` and `sync-journal.json`, in its canonical mode700 directory.
All three paths must be distinct. Files are mode600, owner-owned, regular,
single-link files. Readers reject symlinks, unsafe modes/ownership, canonical
parent mismatches, malformed UTF-8/JSON, oversized input and mid-read changes.
The maximum is 16 MiB per file and 20,000 source/manifest items. The journal
includes before/after metadata, so that byte bound may be reached sooner.

Apply first fsyncs a private journal containing before/after field HMACs,
before/after metadata, the planned source HMAC and next baseline/receipt. No
password or username/password pair is staged in the journal. Metadata still
contains approved usernames and names and must remain private. It then writes
changed engine fields, verifies readback, and replaces manifest and baseline
files through separate temporary files, fsync and atomic rename. The receipt
commits inside the baseline file, not as an independently replaced artifact.

Two file renames are not a cross-file transaction. The durable journal remains
until both metadata and baseline are committed. Sync refuses new plans while
it exists. Readers may briefly see either complete manifest during publication;
the required exclusion prevents consumers using the pair during that interval.
An upstream write failure can leave a partial pair. There is no automatic retry,
rollback or delete, and no claim of a transactional engine update.

To continue an interrupted apply after the manager has examined the bounded
failure, privately reacquire the **same planned source contents**, reestablish
exclusive access, and explicitly call:

```js
const result = await sync.resume({ planId: originalPlanId, approved: true });
```

Resume survives a new API instance. It requires the recorded source identity
and source HMAC, accepts only recorded before/after manifest and baseline
versions, and validates every engine field against its planned before/after
HMAC. It writes only fields still at their before values, then completes the
private commit. An unrelated third value stops reconciliation. Source changes
after interruption require private manual reconciliation, not a fresh plan
that discards the journal. Never delete that journal to force a retry.

The exclusive-create `.lock` beside the baseline prevents concurrent sync
instances. After a process crash a stale lock deliberately blocks further work.
The manager must establish that no holder is alive before privately removing
that one lock. This API does not auto-expire it. It also cannot recover from
disk loss, a malicious same-user process or a non-cooperating engine writer.

Important reason codes include `source_authorization_required`,
`source_identity_mismatch`, `source_expired`, `baseline_required`,
`baseline_source_mismatch`, `destination_conflict`, `exclusive_access_required`,
`plan_expired`, `plan_stale`, `pending_reconciliation`, `sync_busy`,
`private_file_unsafe`, `invalid_source`, `invalid_manifest`, `invalid_state`,
`engine_unavailable`, `apply_required`, `no_pending_apply`, `invalid_config` and
`sync_failed`. A bounded error can follow an uncertain engine write. Check for
the journal privately before deciding the next action.

## Focused verification and manager handoff

Run the single aggregate synthetic case from the source root:

```sh
bun test integrations/agent-vault/sync/acceptance.test.mjs
```

It uses owner-private temporary fixtures and an injected HTTP implementation
matching the pinned engine shapes. It never contacts an engine or browser. The
case covers initial matching-baseline enrollment without credential writes,
password-only and metadata-only changes, stable mappings, omitted/unowned item
preservation, unchanged-field preservation, safe public output, source/identity
guards, stale plans, foreign destination changes, a partial write, explicit
restart/resume, no-op apply and private-source symlink refusal. It removes its
synthetic private files afterward. This is one aggregate case, not live engine
or source authorization acceptance.

On 23 October 2026, that case passed on its first run with Bun 1.4.4: one test,
zero failures. Bun static bundling of the module graph and test passed. Scoped
Gitleaks scans of the new sync directory and this document found no leaks.
No additional runtime acceptance cases or full Angular builds were run.

Implementation host was `osiris.local`, arm64, model `Mac14,15`. T3 confirmed
the binding to `/Users/osirismedici/.t3/worktrees/Vault/work-vault-v2-sync`, branch
`work/vault-v2-sync`. The initial checkout was clean at
`9598603d763dd2e092da7da78a4f346e2d3aca98`, which also matched the published
`work/agent-vault-integrated` ref. The final handoff supplies the new commit and
verified remote SHA.

Manager assembly still needs a fresh authorized source, baseline enrollment,
real exclusive access, and review of existing metadata readers. The credential
provider caches its first successful snapshot. Consumers must obtain a new
provider instance after a changed manifest through the manager's reviewed
activation procedure. This worker changes no provider, bridge, credentials,
importer, engine or runtime module and restarts no service.

Physical-host, Git, source-push and actual focused-check results are recorded in
the final worker handoff. No live 253-account read/import, provider login,
deployment, private config mutation, engine initialization, heavy build or
installed-app replacement is included in this source delivery.
