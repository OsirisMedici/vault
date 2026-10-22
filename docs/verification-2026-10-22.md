# Desktop source preparation verification, 2026-10-22

## Inspected baseline

- Workspace: existing Vault project on `osiris.local`, macOS 26.2, arm64.
- Origin: public `https://github.com/OsirisMedici/vault.git`.
- Local and remote `main` initially matched
  `f9a25119782ba61ffa55e79bf65bbd7d081add6d`, with five project commits.
- The root tracked project code, documentation, branding and upstream gitlinks.
  Build caches and overlays were ignored. A local T3 checkpoint ref was outside
  the publication scope. Publication uses explicit `HEAD:refs/heads/main` only.
- Server/web revisions remain those in the existing lock file. Official clients
  desktop 2026.10.0 is added as a pinned source dependency, not a replacement
  project or a deployed binary. License mapping and attribution were reviewed.

## Passed

- `python3 scripts/prepare-desktop.py` exported tracked pinned source and applied
  the patch into an ignored candidate without changing the upstream checkout.
- `bash scripts/build-desktop-icons.sh` generated a macOS ICNS and PNG resources
  from the original Vault SVG. The 512px key icon was visually inspected.
- `python3 scripts/verify-desktop.py .cache/desktop-candidate-verified` checked
  all 9,157 upstream files, six reviewed patch files and 66 product-label locales.
  Reversing the patch reproduces upstream bytes. All other upstream files match
  except the explicitly generated logo and icon resources. Mac biometric and
  Keychain implementation hashes match upstream exactly.
- Five preparation guardrail tests passed, including existing output, dirty
  source, wrong pin, unexpected remote and output outside the ignored cache.
- A deliberate candidate-only biometric source change was rejected by the
  verifier, then restored and verified again. A stubbed packaging-hook test
  confirmed fuse settings are forwarded and unsupported architecture is refused.
  This did not run Electron, sign a binary or prompt for biometrics.
- Shell, Python and packaging-hook syntax checks passed; the entitlement plist
  parsed successfully. `git diff --check` passed.
- A separate read-only review found no blocking defect in the source-only route.
- Public GET checks on the existing Vault website passed for title, hashed main
  bundle, icons, manifest, charcoal CSS, health and matching API origin. Browser
  DOM inspection confirmed Vault title and the charcoal body background.
- Official Bitwarden's strict signature verification passed. Its Info.plist
  digest was recorded before work for comparison, without reading account data.

## Pending or intentionally outside scope

- Full JavaScript/Rust compilation, dependency/license inventory, packaged launch,
  application isolation under runtime conditions and security acceptance.
- Vault's own Apple signing identity, notarization and human Touch ID acceptance.
  The Mac reported zero valid signing identities. The installed shell Node was
  26.12.0, while upstream requests Node 24.
- Fingerprint-only normal agent unlock and automated login are owned by the
  separate parent integration task. This work added no broker implementation
  and ran no private enrollment or repeated password/email/MFA test loops.
- No VPS, database, browser credential session, official app, official Keychain
  enrollment or Karen protected-login checkout was changed.

The root Git history and staged project source snapshot passed redacted secret
scans. Publication also requires a scan of the resulting commit history.
Upstream fixture histories and ignored generated assets are outside the source
publication snapshot; a broad scan of those is not a project cleanliness claim.
