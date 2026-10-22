# Vault 2 web candidate

Vault 2 is a branding candidate based on the complete pinned Infisical Agent
Vault source. The clean upstream clone stays separate. This directory owns the
reproducible patch, source pin and retained upstream license; it contains no
database, runtime credentials or browser state.

The patch changes the web name, geometric V mark, favicon and shared palette
to warm graphite and champagne gold. It preserves the existing information
architecture, with a scrollable navigation rail and table on narrow screens.
Bundled fonts replace the blocked external font import. Upstream attribution
remains visible, and the actual Agent Vault CLI retains its upstream name.
The header hides the external resource links and signed-in account menu.
The Go server, API client, authorization, encryption and credential storage
implementation are unchanged.

## Prepare and build

Use a clean clone of `https://github.com/Infisical/agent-vault.git` checked out
at the exact commit in `upstream.json`, then run from this Vault repository:

```sh
python3 scripts/prepare-vault2.py --upstream /absolute/path/to/agent-vault
cd .cache/vault2/source/web
~/.bun/bin/bun install --frozen-lockfile --ignore-scripts
~/.bun/bin/bun run build
```

Preparation refuses a dirty or mismatched upstream, an existing candidate, or
output outside `.cache`. It neither installs dependencies nor starts a runtime.
The candidate retains upstream's `package-lock.json`; the patch adds a Bun
1.4.4 lockfile imported from it without dependency version changes.
Build output goes to the candidate's `internal/server/webdist`.

## Private local preview

The preview uses the installed upstream engine's existing API and state; it is
not a second engine, a database migration or a production deployment. The local
API target can be selected explicitly:

```sh
VITE_API_URL=http://127.0.0.1:14321 ~/.bun/bin/bun run preview
```

The preview binds only `127.0.0.1:14421`, refuses a different port if occupied,
permits the Raven tailnet hostname and retains the upstream UI security
headers. Follow the shared private-preview rule before adding a private Serve
mapping. Do not expose the credential proxy or alter existing Serve handlers.
The preview process and its engine must stay alive; candidate preparation
does not install any runtime service. The separately reviewed
[Raven operations workflow](../../docs/vault2-operations.md) installs per-user
startup/readiness controls and serves an immutable copy of this built frontend
without Vite. Its backup and restore checks preserve the existing engine data.

Verify the actual title/logo, signed-in owner identity, sample service after
reload, Add Service open/cancel and a desktop/narrow viewport. Real credential
onboarding, provider login, engine rebuild/replacement and deployment each need
their own selected scope and acceptance. The separately authorized real import
and scoped proxy agent do not establish website login. Existing custom Vault, its deployment,
the signed Bitwarden client and private state remain separate.

## Attribution

Infisical's original copyright, MIT Expat terms, enterprise-directory exceptions
and third-party notices remain in the complete candidate source. See
`LICENSE.upstream`. Vault 2 branding does not claim upstream authorship or
rename upstream technical identifiers.
