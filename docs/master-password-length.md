# Master-password length candidate

Newly chosen web master passwords accept 1–12 characters, including letters,
numbers, spaces and symbols. Empty input, confirmation mismatches and choices
longer than 12 are rejected. Passwords are not trimmed, truncated or normalized;
length follows the existing Angular/JavaScript UTF-16 convention. Inputs remain
password fields, and the reset-password generator produces 12 characters without
changing saved generator preferences.

Login accepts all nonempty existing passwords, including those longer than 12.
The current-password and unlock paths keep the complete value. No existing user
is forced to change a password because of the new range.

Organization master-password requirements are deliberately overridden at the
product owner's request: minimum length, complexity, required character classes
and enforce-on-login checks no longer prevent these choices. Stored policies
are not rewritten. Unrelated organization policies, MFA and administrator reset
flows retain their behavior. The contradictory organization requirements callout
is removed from the password-choice form. Weak and breached-password warnings
remain, and canceling a warning still prevents submission.

## Authentication and encryption compatibility

The original client requires at least 12 characters when choosing a password,
not exactly 12. Its login form separately requires at least eight. The master
password unlock form already requires only nonempty input.

The master password participates in encryption-key derivation. The account's
PBKDF2 or Argon2id configuration, password and salt derive the master key, which
protects a random user key used to encrypt vault items. The legacy path derives
the salt from normalized email; the newer master-password service preserves
stored salt/KDF unlock data. The client sends a derived authentication hash,
which the server salts and hashes again for storage. This password protocol does
not transmit the raw master password to the server.

This candidate changes form validation and client-side master-password policy
evaluation only. It changes no server code, key derivation, KDF parameters,
authentication protocol, encrypted format, stored hash or database schema. Normal
password changes still verify the current password and rewrap the existing user
key, with upstream's optional key-rotation flow intact. Existing ciphertext
requires no migration.

The raw-password bounds apply to new choices in this web client. The server sees
derived authentication material, so other clients retain their own password rules.
Unmodified official clients may reject short passwords in their own UI. Cross-
client access must be tested before relying on a short password across devices.

Relevant pinned source:

- `libs/auth/src/angular/input-password/input-password.component.ts`
- `libs/auth/src/angular/login/login.component.ts`
- `libs/key-management-ui/src/lock/components/master-password-lock/master-password-lock.component.ts`
- `libs/common/src/key-management/master-password/services/master-password.service.ts`
- `libs/common/src/key-management/crypto/key-generation/default-key-generation.service.ts`
- `libs/angular/src/auth/password-management/change-password/default-change-password.service.ts`
- Server: `src/db/models/user.rs` and `src/api/core/accounts.rs`.

## Security consequences

Very short master passwords weaken protection of the whole vault. Someone with
stolen encrypted data and its wrapped key can guess passwords offline; MFA and
login rate limits do not protect that copy. PBKDF2/Argon2id slow guesses but cannot
supply missing entropy. The new 12-character upper bound also prevents choosing a
longer passphrase in this web form, while existing longer passwords keep working.
Changing a password later does not strengthen copies already stolen under the
older password.

The candidate retains weak/breached warnings and adds inline guidance about the
short-password risk and organization-policy override. New guidance is in English
with the client's existing English fallback for other locales.

Background: [Bitwarden security FAQs](https://bitwarden.com/help/security-faqs/)
and [key derivation](https://bitwarden.com/help/kdf-algorithms/). The pinned source
in `upstream.lock.json` remains authoritative for this candidate.

## Reproduce and validate

Preparation preserves the existing Agent access UI, source patches, upstream
licenses and frozen Bun tooling. The password patch is applied only to a fresh
ignored candidate; pinned upstream checkouts remain clean.

```sh
git submodule update --init --depth 1 upstream/web upstream/server
python3 scripts/test-web-password-preparation.py
python3 scripts/prepare-web-password.py --output .cache/password-source
bun scripts/build-agent-web-bun.mjs --check-lock .cache/password-source
```

Use Bun 1.4.4. The full Angular compiler retains the existing documented Node
26.12.0 exception; keep that runtime on PATH. A production build uses:

```sh
bun scripts/build-agent-web-bun.mjs .cache/password-source
```

Linux builds require at least 8 GiB available RAM and use a bounded 6 GiB Node
heap. A 4 GiB heap exhausted memory during asset optimization. Minification runs
in the compiler process to avoid a second module graph. Source maps remain off,
production minification remains enabled, and no dependencies or pins are upgraded.
Bun's copyfile install backend preserves candidate isolation without dependency
cache hardlinks. The translation cache key includes the password receipt, and a
compiler success receipt is written only after the compiler closes successfully.

From the prepared candidate, after its frozen dependency install:

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

From the owning checkout:

```sh
bun test scripts/web-build-resources.test.mjs
bun test scripts/check-agent-web-ci.test.mjs
bun branding/agent-web/check-contract.ts
```

Verified: 61 authentication tests, 96 policy/master-password service tests, nine
real SDK/lock checks, three preparation cases, two build-memory cases, the existing
packaging safeguard case and the synthetic agent UI contract fixture passed.
The real crypto cases use PBKDF2 at 600,000 iterations and Argon2id at three
iterations / 64 MiB / four lanes. They cover short and long passwords, rejected
truncation, and rewrapping a legacy user key while retaining the original encrypted
dummy item. No real credentials or account state are used.

Formatting and targeted lint passed for the password patch apart from a confirmed
pre-existing restricted-import violation in the unchanged policy service import.

The full OSS production compile completed with the 6 GiB heap and Node 26.12.0.
The packaging checks retained all 29 compiled JavaScript files unchanged. All
production password files in the current candidate match that successful build;
the subsequent scanner fix changes only a synthetic unit-test fixture.

Rendered proof used the built app with a local HTTPS fixture and account
persistence disabled. The form rejects empty input, accepts a one-character
letter and a 12-character choice through the cancellable weak-password warning,
and rejects 13 characters while retaining the full input. Login accepts one and
80 characters in full. The 390-pixel form has no horizontal overflow. No page
exceptions occurred. T3 preview provided the initial form checks; its local TLS
navigation failed twice with `ERR_CERT_AUTHORITY_INVALID`, so an isolated
Playwright context accepted the fixture certificate with networking restricted
to the local fixture. This is UI validation, not live account authentication.

Cross-client and real-account lifecycle acceptance remain pending. No deployment
or operational configuration is included in this source change.
