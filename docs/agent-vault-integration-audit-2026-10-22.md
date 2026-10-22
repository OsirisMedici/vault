# Agent Vault integration audit after independent delivery

22 October 2026. Read-only review of the three engineering handoffs, the
fourth import/login chat, committed source and current runtime metadata.
No engineer was contacted or restarted. No credential values were read,
website login repeated, code merged, service restarted or deployment performed.

## Outcome

The bulk-imported engine plus private host helper has demonstrated useful real
website sign-ins. The three implementation branches contain separate source
deliverables, not an assembled or installed integration. Preserve the working
engine/helper workflow while finishing that integration. No further password
migration or desktop rebuild is needed to resume the demonstrated workflow.

## Delivered source and evidence

| Chat | Committed result | Acceptance evidence | Remaining |
| --- | --- | --- | --- |
| 01 engine | 4cc918733fdb1b57ca63a1ec1386b189db05950b: engine client, private config loader, provisioning and pinned companion deployment package | C01 dummy restart/persistence and C02 proxy-only reveal denial passed | Container build, real config, assembly and VPS deployment not performed |
| 02 credentials | ca54859300f0105874fa2d11758127cf9384921d: manifest lookup, distinct account selection and private consuming callback | C03 injected fixture passed | Real manifest compatibility and engine/browser assembly not accepted |
| 03 browser | d6635b4dfcb51d7353b8df84848f00f5d6c3e1f7: controller, guarded clipboard driver, fixed routes, MCP and supported-transport adapter | C05 wrong-origin denial passed; C04 real private fill blocked | Supported external host transport, real runtime factory and live provider-rule acceptance |
| 04 import | fca63da importer, followed by ef5d2bd demonstration helper/handoff | C06 count and C07 all-pair private readback passed | Durable runtime and integration; imported snapshot is not automatic Bitwarden sync |

The original planned cases stand at six passed, one blocked and three
manager-integration cases not run. Later owner-requested provider demonstrations
were separate authorizations. This audit did not rerun acceptance suites.

Root main remains 40cd48c. None of the three implementation commits is assembled
there. The root has the planning/contract files untracked; preserve them. The
import worktree also reports a modified upstream/desktop submodule; this audit
does not own or reset that source.

## Bulk import and website demonstrations

The import receipt records 256 source records, 253 eligible login accounts,
three passwordless records skipped, 253 imported account mappings, 506 stored
credential values, zero errors and 253 verified username/password pairs. The
temporary plaintext export was removed. Current private manifest metadata
confirms 253 accounts, mode600, correct owner and no password field. Its parent
is the dedicated private integration directory.

The fourth chat recorded these provider outcomes using one browser tab:

- Canva opened the existing design dashboard after saved-credential sign-in.
- ClickUp opened the Scale workspace after saved-credential sign-in.
- Kit required new-device email approval and was skipped at the owner's request.
- GitHub required passkey/security-key two-factor authentication and was skipped.
- GoDaddy presented its unusual-browser check before password submission.

Those demonstrations used demo_login.py to move one selected field at a time
from Agent Vault through the native clipboard into the observed browser form.
They did not use the unassembled standalone MCP from engineer 03. The handoff
does not establish exact-profile identity checks for every demonstration, nor
five fully completed sign-ins. Earlier historical ClickUp exact-email proof is
separate evidence. Source records were unchanged.

## Current live state

- The local trial API on 127.0.0.1:18431 refuses connections; no listening
  process was found. This review did not restart it.
- The existing binary, private master file and database/WAL remain present.
  A read-only SQL aggregate confirms the import vault and all 506 stored fields.
  This is data presence, not a new decryption/readback or restore test.
- Private engine.json and browser-runtime.mjs are absent from integration-v1.
- The current host process inherits neither T3_ACP_MCP_ENDPOINT nor
  T3_ACP_MCP_AUTHORIZATION. The standalone transport requires both.
- On the VPS, osiris-vaultwarden is healthy. The filtered running-container
  inventory contains no Agent Vault companion. Engineer 01 prepared files only.

## Concrete compatibility findings

1. Importer importedAt uses Python datetime.isoformat(), including a UTC offset
   and microsecond precision. The provider accepts only a Z suffix with at most
   three fractional digits. All 253 current metadata timestamps fail that
   provider regex. Broaden the provider's strict RFC3339 handling or normalize
   the manifest metadata without reimporting passwords. The passwords are not
   the cause. Evidence: credentials/provider.mjs lines 78-80 and
   import/import_bitwarden.py line 268 on their respective branches.
2. Browser MCP defaults to import_required unless a trusted runtime factory
   wires the engine client and credential provider. The template still has
   placeholder module and capability paths. No such private runtime exists yet.
3. Browser transport fails closed without the supported external T3 endpoint
   and authorization. The engineer's observed error was:
   acp-mcp-call requires T3_ACP_MCP_ENDPOINT and T3_ACP_MCP_AUTHORIZATION.
   Do not scrape T3 tokens or describe injected model-tool access as proof that
   an ordinary external MCP process has that capability.
4. New provider rules are unaccepted candidates. ClickUp verification assumes
   exact /settings/profile, while prior actual evidence included a workspace
   ID before /settings/profile. GoDial assumes /profile even though the earlier
   app navigation used hash routes. These rules need correction against the
   real pages before the connector can reliably assert exact identity.

## Shortest next step in this chat

First restore the existing credential-bearing engine from its preserved state
without resetting it, reimporting passwords or replacing the original apps.
Give that exact runtime a durable private home/startup mechanism and a
consistent backup procedure. Preserve database/WAL consistency and key custody.
No backup restore acceptance is claimed by the earlier directory copy.

For immediate use, retain the demonstrated chat-tool/private-helper route.
It can support observed website forms and private owner challenges after the
engine is running. State its same-user clipboard limitation plainly.

For a reusable Vault integration, combine only the owned commits in a manager
integration branch, correct the timestamp compatibility, wire the real private
engine/manifest/runtime factory, and correct the fixed provider rules. Resolve
the supported host transport before claiming autonomous standalone MCP login.
Then use only the remaining allocated manager cases C08-C10 for the assembled
lookup and two exact-account sign-ins. Do not repeat the completed upstream or
import suites.

VPS companion activation and changing the installed desktop app are separate
release decisions. The former can follow the reviewed additive deployment
package; the latter is unnecessary for the first usable workflow.
