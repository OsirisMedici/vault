#!/bin/bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/../../.." && pwd)"
bun="$(command -v bun)"
out="$repo/.cache/vault-launcher/Vault Launcher.app"
vault_origin=""
if [[ -n "${VAULT_LAUNCHER_URL:-}" ]]; then
  vault_origin="$("$bun" -e '
    const url = new URL(process.env.VAULT_LAUNCHER_URL);
    if (url.protocol !== "https:" || url.href !== url.origin + "/" ||
        url.port || !/^[a-z0-9.-]+$/.test(url.hostname)) {
      throw new Error("VAULT_LAUNCHER_URL must be an HTTPS origin without a path, port, or credentials");
    }
    console.log(url.origin);
  ')"
fi
mkdir -p "$out/Contents/MacOS"
if [[ -n "${VAULT_LAUNCHER_ICON_DIR:-}" ]]; then
  mkdir -p "$out/Contents/Resources/AppIcons"
  cp "$VAULT_LAUNCHER_ICON_DIR/"*.png "$out/Contents/Resources/AppIcons/"
fi
plist="$out/Contents/Info.plist"
plutil -create xml1 "$plist"
plutil -insert CFBundleIdentifier -string com.osirismedici.vault-launcher-pilot "$plist"
plutil -insert CFBundleExecutable -string VaultLauncher "$plist"
plutil -insert CFBundleName -string "Vault Launcher" "$plist"
plutil -insert CFBundlePackageType -string APPL "$plist"
plutil -insert CFBundleVersion -string 1 "$plist"
plutil -insert LSUIElement -bool YES "$plist"
if [[ -n "$vault_origin" ]]; then
  plutil -insert VaultAccountURL -string "$vault_origin" "$plist"
  plutil -insert WKAppBoundDomains -json "[\"${vault_origin#https://}\",\"127.0.0.1\"]" "$plist"
fi
plutil -insert VaultBunExecutable -string "$bun" "$plist"
xcrun swiftc "$repo/integrations/agent-access-pilot/macos/Launcher.swift" \
  -framework AppKit -framework WebKit -o "$out/Contents/MacOS/VaultLauncher"
codesign --force --sign - "$out"
codesign --verify --strict "$out"
printf '%s\n' "$out"
