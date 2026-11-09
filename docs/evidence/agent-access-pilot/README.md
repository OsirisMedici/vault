# Vault #2 fixture evidence

Verified on 9 November 2026 IST. [Issue](https://github.com/OsirisMedici/vault/issues/2) and [runbook](../../../integrations/agent-access-pilot/README.md).

The execution host was `osiris.local`, Darwin arm64, Mac14,15, macOS 26.2 (25C56), with 8 GiB RAM. This matched the earlier Mac evaluation host. Osiris selected a fresh disposable environment on this Mac for implementation. The source checkout began clean at Vault `40cd48c5e10d2c585c6f438bfd445d295f0d8546`; it did not reuse the prior trial's data or profiles.

The host ran Bun 1.4.4, Bitwarden CLI 2026.10.0, OpenSSL 4.0.3, BetterWright 2.9.1, and a separate Chrome for Testing 152.0.7977.42. The Colima 0.10.3 context used Docker CLI 29.6.2, daemon 29.5.2 and an Ubuntu 24.04.4 LTS arm64 guest with 2 CPUs and approximately 2.8 GiB RAM. Vaultwarden 1.37.4 and the Karen worker ran in that guest. The runbook pins both container image digests. The pinned Bitwarden SDK 0.2.0-main.1075 supplied the fixture bootstrap crypto; the Bitwarden CLI handled saving and retrieving items.

[Demo receipt](demo.json), from `bun run pilot demo`:

| Check | Observed |
| --- | --- |
| Restricted worker | UID 65532, loopback only, no effective capabilities, no privilege gain, read-only root, no Docker socket. The worker could not read the host canary, inherit the vault session, or reach test owner and browser control listeners. |
| Effective access | Empty before the owner grant, only A afterward. A direct B request and a nonexistent ID both returned a generic denial. Raw fill, origin override, actor spoofing, owner revoke, and browser debug requests were also denied. |
| Private login | Fresh browser started signed out, retrieved A via the trusted credential adapter, verified the exact expected identity, and read two fixture records. |
| Restart | The SQLite grant survived reopening the broker. A new worker and browser repeated the fresh-login flow. |
| Revocation | The test revoked A after authentication, before the read. The audit and read counter show that use was denied and no report was read. The already-issued site session still identified the same account. After reopening the broker, new A requests were denied and discovery was empty. Both owner's items remained. |
| Audit and capture | Sixteen metadata events, including grant, denied use, successful use, and revoke. The runner checked generated passwords and the CLI session key against captured browser results, worker responses, audit, and receipt. Gitleaks scanned staged source and evidence. |

The [owner console transcript](owner-console.txt) comes from a separate run of
`bun run pilot console`. The owner listed both items, granted A, saw only A
through Karen, ran a successful A read, denied B, revoked A, saw the next A
request denied, and inspected audit. An earlier console run failed at browser
use. The executor now fetches the granted item before opening the fill request,
then waits for the actual sign-in redirect without starting a new navigation.
The recorded console run uses the updated executor.

This is one Mac fixture with a Linux container worker, not standalone Linux, a second machine, a real provider, MFA, an installed T3/MCP path, or evidence of protection against the Mac owner or Docker administrator. The code does not change any running Vault, Vault 2, profile, or client. No preview server is left running.
