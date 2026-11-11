# Short master passwords

Vault's web users can choose any nonempty master password in this source
candidate. One through twelve digits, letters, symbols, mixed text and longer
passwords are accepted. This removes the inherited twelve-character creation
minimum and eight-character sign-in minimum. It does not impose a twelve-character
maximum or a digits-only rule.

A master password protects the encryption key, even in a private app. Automated
attackers try short passwords too. A one-digit numeric password has ten possible
values and a three-digit numeric password has one thousand. Server rate limiting
and MFA do not protect an encrypted vault copy from offline guessing. Short
passwords are a deliberate convenience choice, not protection through an unusual
length. The existing strength meter, weak/breached-password confirmation and
unrecoverable-password warning stay visible.

## Scope

`patches/web-short-master-passwords.patch` changes only the two minimum constants
in `libs/common/src/platform/misc/utils.ts` and the policy editor's minimum tests.
The shared input component uses the creation minimum for registration, initial
password setup, password changes, recovery and takeover. Its minimum hint reads
the same constant. The login component uses the other constant. The unlock form
already requires only a nonempty value.

Organization policy editors can now choose a minimum of one. Existing policies
are not rewritten. An explicit policy can still require twelve characters or
other complexity rules. If a user remains blocked by an organization policy,
the owner must review that policy separately. Weak-password confirmation alone
cannot override it.

Vaultwarden receives a derived authentication hash and wrapped encryption key,
not the plaintext master password or its length. No server modification is
needed for this client minimum. Key derivation, encryption, account keys, MFA,
proxy gates, invitations and protected browser integration are unchanged.
Official desktop, extension and mobile clients retain their own validation rules.
They may refuse short passwords. Users must verify every client they need before
changing an established account. This candidate changes only the web app.

## Prepare and verify

Use Python 3.9 or newer and Node 24, as pinned by upstream `.nvmrc`. Source and
build outputs stay in ignored `.cache`; the original submodule remains clean.

```sh
python3 scripts/test-web-preparation.py
python3 scripts/prepare-web.py
cd .cache/web-short-passwords
npm ci --ignore-scripts --include=optional --no-audit --no-fund
npx jest --config libs/auth/jest.config.js --runInBand --coverage=false --runTestsByPath \
  libs/auth/src/angular/input-password/input-password.vault.spec.ts \
  libs/auth/src/angular/login/login.vault.spec.ts
npx jest --config apps/web/jest.config.js --runInBand --coverage=false --runTestsByPath \
  apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/master-password.component.spec.ts
npm run dist:oss:selfhost --workspace apps/web
```

Preparation refuses an unexpected commit, dirty upstream, another remote,
existing output or a destination outside `.cache`. Its receipt records the pinned
source and patch/test hashes. Tests use synthetic values only and mock network
services. They exercise the actual Angular form classes and submit method. They
do not sign in to the live server or inspect user vault data.

## Release and human acceptance

### Existing release-branch work

[PR #1](https://github.com/OsirisMedici/vault/pull/1) was previously merged into
`work/vault-v2-release-pranshi`, not `main`. Its source is also on
`dev/master-password-release`. That implementation caps newly chosen passwords
at twelve characters, overrides organization password policies, preserves its
Agent access UI and includes a completed build/packaging handoff. Its document is
`docs/master-password-length.md` on those branches.

The candidate here is independently based on `main`. It permits longer passwords
and retains explicit organization policies. Do not apply both implementations
together or replace a release containing Agent access with this candidate without
reconciling that source. Choose the intended behavior and release base before
deployment. The existing release branch may be the better continuation point if
the twelve-character cap and policy override are still intended.

### Verified results and remaining work

On 2026-11-09, Node 24.22.2 ran 180 passing web tests: 45 new password form and
sign-in tests, 10 policy editor tests, 93 existing policy/master-password service
tests and 32 existing lock tests. Six Python preparation/isolation checks also
passed. The new TypeScript tests passed Prettier. The pinned web/server source
checkouts remained clean.

The OSS production build was started with a 6 GiB heap. The VPS became
unresponsive under memory pressure, so the build was stopped for this handoff.
There is no successful compiler receipt or accepted release artifact from this
run. Repeat the complete production build on the continuation computer. Retain
upstream minification and check available memory before building. No live
deployment, real account lifecycle or cross-client acceptance was performed.

### Activation boundary

This is a local source candidate. The existing image and `scripts/build-branding.py`
still produce the display-only release and do not enable short passwords. A
source build produces the complete client under `apps/web/build`. A release must
package that complete asset set with Vault's theme/assets and preserve upstream
licenses and notices. Do not patch minified authentication code or copy only a
new main bundle into the old overlay. Review the resulting image and resolved
deployment separately under [operations.md](operations.md) before activation.

Use a disposable account in a reviewed test deployment. Keep all chosen passwords,
MFA, keys and decrypted content outside transcripts and source control.

1. Register with a privately chosen one-character password and matching
   confirmation. Verify the one-character minimum hint and acknowledge the weak
   password warning. Verify blank inputs and mismatched confirmation are rejected.
2. Create a dummy vault item, lock, unlock, sign out and sign in again with that
   password. Confirm the dummy item still decrypts.
3. In Security > Master password, change to another short password. Acknowledge
   the warning, sign in again and confirm the same dummy item decrypts. Repeat
   with three and twelve digits, mixed characters and more than twelve characters.
4. Decline the weak-password warning and verify no password change occurs. Verify
   a deliberately configured twelve-character organization policy still blocks
   a short replacement. Restore only the disposable fixture's policy afterward.
5. Verify MFA, proxy restrictions and compatible client behavior. Do not infer
   desktop or mobile support from successful web validation.

Deployment and these human checks remain separate acceptance. Rolling back to
the old web client restores its eight-character sign-in restriction. Before a
rollback, users with shorter passwords must change them using a client that
accepts the current password, or retain access to this reviewed candidate until
they do. Never edit password hashes or remove data to work around validation.
