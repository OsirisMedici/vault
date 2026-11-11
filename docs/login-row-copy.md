# Login row copy actions

Osiris can copy a login's username and password together, username alone, or
password alone from three icons beside the row's options menu. The icons use
the existing copy, user and key symbols, with accessible labels and tooltips.
They remain visible at viewport widths of 640px and above. Narrower screens
retain the options menu so the fixed-height virtual list does not clip rows.

The combined action writes the username, a newline, then the password in one
clipboard operation. Both fields must exist. It uses the existing protected
copy service, including the master-password reprompt, success toast and password
copy audit event. Hidden-password permissions suppress both password buttons.
The directive rechecks permissions after decrypting SDK list items. Empty fields
and disabled rows cannot be copied. No credential values enter source, logs or
network calls. Clipboard handling remains the inherited web implementation.

## Source and verification

`patches/web-login-row-copy.patch` contains the UI, combined copy handling,
English labels and focused regression tests. `scripts/prepare-web.py` applies it
to an ignored export of the pinned web source after the existing branding and
short-master-password patches. Upstream checkouts and license notices remain
intact. The patch can be reviewed independently of the password-minimum work.

```sh
python3 scripts/test-web-preparation.py
python3 scripts/prepare-web.py --output .cache/web-row-copy
cd .cache/web-row-copy
# Use upstream's Node 24 and install dependencies if this is a fresh candidate.
npm ci --ignore-scripts --include=optional --no-audit --no-fund
npx jest --config apps/web/jest.config.js --runInBand --coverage=false --runTestsByPath \
  apps/web/src/app/vault/components/vault-items/vault-cipher-row.component.spec.ts
npx jest --config libs/vault/jest.config.js --runInBand --coverage=false --runTestsByPath \
  libs/vault/src/components/copy-cipher-field.directive.spec.ts \
  libs/vault/src/services/copy-cipher-field.service.spec.ts
```

On 2026-11-10, these three suites passed all 83 tests using synthetic credentials
with Node 24.22.2. Coverage includes full and SDK list ciphers, missing values,
permission checks, cancelled and approved reprompts, one clipboard write, audit
events, both feature-flag states, and exclusion of archived/deleted/non-login
items. Six Python preparation and upstream-isolation checks also passed.
The fresh export's eight patched files match the tested candidate byte for byte.
ESLint could not complete because the reduced upstream checkout's aggregate
Tailwind configuration references absent browser/desktop apps. A web-only
override also failed Tailwind resolution with the reused dependency directory.
This is a tooling limitation, not a passing lint result.

## Pending acceptance

Publishing this source does not deploy it. The complete OSS production build
and rendered browser acceptance remain pending. The original
candidate above starts from pinned upstream. Use the release continuation below
to preserve the currently deployed workspace instead. Follow
`docs/operations.md` for release review; the display-only overlay script does
not activate this feature.

### Deployment continuation, 2026-11-11

The running workspace identifies release source
`ed810261b2c51b0c65841014602bce1f313e646f`. Its combined copy action already
handles clipboard failures and always honors the protected-field reprompt.
`patches/web-login-row-copy-release.patch` reuses that action and adds only row
controls, disabled-row handling and tests. Do not apply both row-copy patches
to the same candidate.

```sh
python3 scripts/prepare-row-copy-release.py --output .cache/row-copy-release
```

The script exports public tooling from its exact Git commit, prepares a fresh
candidate from clean pinned upstream, applies all six existing workspace patches
in documented order, then applies the release-specific row-copy patch. It keeps
the existing Agent access UI, compact filters, collections toolbar, Mac menu
copy support, password discovery and password rules. A JSON receipt records the
source commits and patch hashes. Build scripts come from the previously reviewed
bounded-memory continuation, without applying that branch's password-policy
changes. Bun 1.4.4 and Node 26.12.0 remain required.

```sh
PATH=/path/to/node-26.12.0/bin:$PATH bun \
  .cache/row-copy-release/build-tools/scripts/build-agent-web-bun.mjs \
  .cache/row-copy-release/build-tools/.cache/source
python3 .cache/row-copy-release/build-tools/scripts/prepare-agent-web-release.py \
  .cache/row-copy-release/build-tools/.cache/source/apps/web/build \
  --output .cache/row-copy-release/build-tools/.cache/packaged-web
```

On 2026-11-11, the release candidate passed 84 Angular copy/row/service tests
and two compiler memory-budget tests. Frozen dependency installation passed,
and Gitleaks found no secrets in the patch directory. The production build
refused to start because only 8022 MiB RAM was available, below its required
8192 MiB. The memory guard was retained, and unrelated applications were not
stopped. No compiled release artifact was produced.

Deployment remains pending because the release session lacked image build/import
and backup-verification privileges. A release operator must finish the compile
with sufficient memory, package and scan the assets, verify a fresh encrypted
backup, then follow `docs/operations.md` to activate with rollback retained.
The running service was left unchanged. Live clipboard behavior and browser
acceptance still need the checks below.

In a reviewed test release, use a dummy login with known synthetic fields:

1. At desktop width, confirm three icons appear before the options menu without
   hovering. Hover and Tab through them to check tooltips and focus.
2. Click each icon and paste privately into a disposable text field. Confirm
   the combined action gives username then password on separate lines, and the
   other actions give only their named field. Confirm the item dialog stays shut.
3. Enable the item's master-password reprompt. Cancel the combined copy and
   confirm the clipboard stays unchanged; approve it and confirm one copy.
4. Check a hidden-password shared login, missing fields, archived/deleted items,
   a long item name and a non-login item. Passwords must remain inaccessible
   when permission is absent, and empty actions must be disabled.
5. At phone width, confirm readable rows and all three actions in the menu.
   Repeat with keyboard activation and reduced motion enabled. Copy feedback
   must be immediate; no new animation is introduced.

Real credentials, clipboard contents and private account data must remain
outside test reports and transcripts.
