# Operations and acceptance

## Release boundary

The initial release uses the unmodified Vaultwarden 1.37.4 server binary and
the compatible bundled web-vault 2026.7.0. Display-name string replacements in
the compiled client match the small source patch in `branding/web-source.patch`.
Only that bundle, index metadata, logo labels, logo assets, manifest and the
supported CSS template are changed. Authentication and encryption code is not
rewritten. The inherited upstream browser compatibility remains relevant.

The web theme intentionally renders charcoal for both existing upstream theme
choices. Its original information architecture, form controls, keyboard focus,
warnings, error states and authorization remain. CSS is never an access policy.

## Before a release

1. Record the running image, exact source revision and current image ID.
2. Verify a fresh encrypted backup and retain the pre-release Compose file.
   Keep both outside source control. A backup integrity check is not a live
   restore test.
3. Build from the pinned base image. Compare original and changed client
   JavaScript; reversing the display-name and loading-label replacements must
   reproduce the original bytes. Keep a generated file/hash receipt privately.
4. Check the generated overlay and every new commit with a secret scanner.
   Review filenames and text for private operational metadata too. Submodule
   histories are upstream-owned and retain upstream licensing.

## Live acceptance

- Confirm HTTPS and `/alive`, and that `/api/config` retains the intended API,
  identity and notification destinations.
- Confirm `/admin` remains blocked and the registration gate stays closed.
- Confirm Vault title, wordmark, favicon, charcoal surfaces, readable form
  labels, focus indicators and status colors. Test a desktop and phone viewport.
- Exercise Remember email and empty/invalid-email validation without using a
  real password. Check relevant console errors and failed asset requests.
- Have the owner privately sign in with MFA and unlock. Verify a known existing
  item, then lock and unlock again. Inspect sidebar, search, list and settings.
  Do not put master passwords or decrypted item values into an agent transcript.
- Verify a compatible desktop client still syncs against the same server.
  Team collections, item edits, attachments and a second Mac require their own
  acceptance when used. Do not infer those checks from a login-page screenshot.

## Rollback

Retain the last working image and pre-release Compose file. For this visual-only
release the server version and database schema do not change. Restore the
previous Compose image and recreate only its service, preserving its data and
other settings. Reload the browser to discard the custom index and bundle.
Never delete or replace vault data to undo a theme. A later backend upgrade may
require a database restore and needs a separate rollback plan.

## Future changes

Track server and web-client security releases together. The current CSS and
strict string checks need revalidation when upgrading either version. A full
client fork adds dependency updates, build and security review responsibilities.
The installed desktop app requires a separate fork/release for desktop branding.
Protected agent credential use requires a scoped trusted connector or browser
host integration; this theme does not install one.
