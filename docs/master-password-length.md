# Master-password length development candidate

Prepared on 2026-10-26 in an isolated clone of `OsirisMedici/vault`, based on
`40cd48c`, branch `dev/master-password-length`. No production state, deployment,
push, merge, real account, installed client or Keychain enrollment was changed.

## Requested behavior

Vault's web client accepts newly chosen master passwords of 1–12 characters
inclusive, with letters, numbers, spaces and symbols. Empty input and new choices
longer than 12 produce validation errors. Inputs remain password fields. There
is no numeric-only pattern, truncation, trimming or normalization of passwords.
Length uses the existing Angular/JavaScript UTF-16 length convention.

Login accepts any nonempty existing password, including those longer than 12.
The current-password field, unlock flow, key derivation and account cryptography
retain the full password. Existing users are not required to change a password
because of the new length range. The upper bound applies to new choices, not to
existing passwords or cryptographic APIs. The reset-password generator produces
12 characters without changing saved generator preferences.

Osiris explicitly chose to override organization master-password requirements.
The candidate ignores their minimum length, complexity, character requirements
and enforce-on-login evaluations. It removes the contradictory organization
requirements callout from the password-choice form. Stored organization policies
are not rewritten; unrelated organization policies, MFA and explicit admin reset
flows retain their existing behavior. Weak and breached-password warnings remain
and cancellation still prevents submission.

## Existing authentication, encryption and validation

The repository identifies Vault as a branded Vaultwarden password manager, not
the separate Agent Vault evaluation. Source is pinned in `upstream.lock.json`:

- Web: `d2a095eb800fe80a9bc524579b974796eae51994`.
- Server: `7c188967e7a467b19b2757bc3326f9cf3ccae327`.

The original web `InputPasswordComponent` requires at least 12 characters, not
exactly 12. `LoginComponent` separately requires at least 8. The password-choice
form also checks confirmation, weak/breached passwords and organization policy.
The existing master-password unlock form only requires nonempty input.

The master password participates in encryption-key derivation. In the pinned
client, the account KDF (PBKDF2 or Argon2id), password and salt derive a master
key. The legacy path derives the salt from normalized email. The newer master
password service preserves the stored salt/KDF unlock data. The password-derived
key protects a random account user key; that user key protects vault items.
The client derives an authentication hash, and Vaultwarden salts and hashes that
value for storage. The raw master password is not sent to Vaultwarden in this
password-authentication protocol. Authentication tokens and MFA remain separate
from local decryption.

Relevant source:

- `upstream/web/libs/auth/src/angular/input-password/input-password.component.ts`
- `upstream/web/libs/auth/src/angular/login/login.component.ts`
- `upstream/web/libs/key-management-ui/src/lock/components/master-password-lock/master-password-lock.component.ts`
- `upstream/web/libs/key-management/src/key.service.ts`
- `upstream/web/libs/common/src/key-management/master-password/services/master-password.service.ts`
- `upstream/web/libs/common/src/key-management/crypto/key-generation/default-key-generation.service.ts`
- `upstream/web/libs/angular/src/auth/password-management/change-password/default-change-password.service.ts`
- `upstream/server/src/db/models/user.rs`
- `upstream/server/src/api/core/accounts.rs`

The compatible implementation changes form validation and client-side master
password policy evaluation only. No server, cryptographic service, KDF defaults,
salt, authentication protocol, encrypted format, stored hash or database schema
is changed. Normal password changes continue verifying the current password and
rewrapping the existing user key; optional key rotation retains upstream behavior.
Existing ciphertext requires no migration. The server sees derived authentication
material, so a raw-password length limit cannot be enforced there without a
protocol change. Other clients retain their own password rules.

## Security consequences

A very short master password is easy to guess and weakens the confidentiality
of the whole vault. With a stolen encrypted vault and its wrapped key, an attacker
can attempt password guesses offline. MFA, login rate limits and proxy gates do
not protect that offline copy. PBKDF2/Argon2id slow each guess but cannot supply
missing password entropy. A random one-character printable ASCII password has
at most 95 possibilities; human choices may be easier still. Restricting new
passwords to at most 12 also removes the option of a longer passphrase in this
candidate. Existing long passwords continue working in full.

A later password change does not strengthen copies already stolen under an
older weak password. The candidate keeps weak/breached warnings and adds an
inline explanation of the short-password risk and organization-policy override.
The new copy is in English; other locales rely on the client's English fallback.

Background: [Bitwarden security FAQs](https://bitwarden.com/help/security-faqs/),
[encryption key derivation](https://bitwarden.com/help/kdf-algorithms/).
The pinned source above is the authority for this implementation.

## Reproduce the source candidate

Keep the pinned upstream checkouts clean. Changes are carried in
`patches/web-password/source.patch`, with a Bun lockfile alongside it.

```sh
git submodule update --init --depth 1 upstream/server upstream/web
python3 scripts/test-web-password-preparation.py
python3 scripts/prepare-web-password.py --output .cache/web-password-source
cd .cache/web-password-source
bun ci --ignore-scripts
```

Choose a new output directory if that path exists. Preparation applies the
existing web branding patch and then the password patch to an exported copy.
It records the upstream commit, patch hashes and lockfile hash. It refuses an
unexpected pin, dirty upstream, unexpected remote or existing output directory.
It does not build, start or install an application.

Bun 1.4.4 is pinned for the generated candidate. Its lock was migrated from the
upstream npm lock: all 2,959 registry package entries use versions already in
that lock. The reduced web checkout omits desktop, so the candidate removes the
missing desktop workspace and its local native dependency from its manifest.
The original npm lock stays available for the migration audit. Dependency
lifecycle scripts are disabled for these tests; no Electron installation runs.

Compatibility exception: upstream Angular/Jest fails under Bun's runtime with
`Must use import to load ES Module` for Angular core. Keep its existing Jest
runner and run it through `bun run test` with Node 24.17.0 available on PATH.
On this VPS the runtime was installed privately using Bun, without changing the
system Node/npm setup:

```sh
# From the owning Vault checkout, only if Node is unavailable:
mkdir -p .cache/node-runtime
bun add --cwd .cache/node-runtime --ignore-scripts --exact node-linux-x64@24.17.0
# Include that directory's node_modules/.bin on PATH for the Jest commands below.
```

From the prepared candidate, with that Node runtime on PATH:

```sh
bun run test --config libs/auth/jest.config.js --runInBand --runTestsByPath \
  libs/auth/src/angular/input-password/input-password.component.spec.ts \
  libs/auth/src/angular/login/login.component.spec.ts \
  libs/auth/src/common/login-strategies/password-login.strategy.spec.ts
bun run test --config libs/common/jest.config.js --runInBand --runTestsByPath \
  libs/common/src/admin-console/services/policy/default-policy.service.spec.ts \
  libs/common/src/key-management/master-password/services/master-password.service.spec.ts
bun test scripts/vault-password-crypto.test.ts
```

## Verified results and acceptance still pending

- Authentication/form suites: 61 tests passed.
- Policy and existing master-password service suites: 96 tests passed.
- Real pinned SDK crypto and lock migration: 9 tests passed. PBKDF2 at 600,000
  iterations and Argon2id at 3 iterations / 64 MiB / 4 lanes wrap and unwrap
  short and long passwords. Rewrapping a legacy user key under a one-character
  password still decrypts the original dummy encrypted item. Wrong passwords
  and truncation to twelve characters fail. Test cases allow 30 seconds rather
  than reducing KDF work to fit Bun's default five-second limit.
- Preparation: 5 tests passed, including deterministic output and a comparison
  proving only the reviewed source files change; all other tracked web files
  retain their original bytes. Both initialized upstream checkouts remain clean.
- Frozen Bun install succeeds in the newly prepared candidate.
- Formatting passes for the changed candidate files. Targeted lint passes except
  for a pre-existing `import/no-restricted-paths` violation at line 7 of
  `default-policy.service.ts`. Rechecking the unchanged pinned version reproduces
  that same violation. The new code adds no new lint violations.

Tests use public dummy input and local cryptography only. They do not contact
a real vault, submit real passwords or read account/session data.

This is a web source candidate, not a built or accepted release. Full OSS build,
browser UI acceptance, isolated server account lifecycle tests and cross-client
acceptance remain pending. No live environment or credentials were used.
Unmodified official desktop/mobile/extension clients may reject short passwords
in their own UI. They are not changed or accepted by this patch. Do not promise
cross-client access after choosing a short password until those clients have
been tested or compatible candidates prepared. Existing long passwords remain
unchanged and are not subject to the new upper bound at login/unlock.

A future release must deliberately build and package this source candidate:
the existing display-only overlay/Dockerfile does not pick up password changes.
No deployment, push, merge or installed-app replacement is authorized here.
