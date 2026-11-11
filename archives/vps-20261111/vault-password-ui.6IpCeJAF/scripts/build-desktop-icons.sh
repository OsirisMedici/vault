#!/bin/bash
# Convert Vault's original SVG with macOS tools. Writes only into a prepared source candidate.
set -euo pipefail
vault_root="$(cd "$(dirname "$0")/.." && pwd)"
vault_candidate="${1:-$vault_root/.cache/desktop-source}"
vault_candidate="$(cd "$vault_candidate" && pwd -P)"
case "$vault_candidate" in
  "$vault_root"/.cache/*) ;;
  *) echo 'Candidate must be inside this project .cache' >&2; exit 1 ;;
esac
test -f "$vault_candidate/vault-source-receipt.json"
vault_desktop="$vault_candidate/apps/desktop"
vault_iconset="$(mktemp -d "$vault_root/.cache/vault-icons.XXXXXX")"
trap 'rm -rf "$vault_iconset"' EXIT
mkdir "$vault_iconset/Vault.iconset"
for vault_size in 16 32 128 256 512; do
  sips -s format png -z "$vault_size" "$vault_size" "$vault_root/branding/icon.svg" \
    --out "$vault_iconset/Vault.iconset/icon_${vault_size}x${vault_size}.png" >/dev/null
  vault_double=$((vault_size * 2))
  sips -s format png -z "$vault_double" "$vault_double" "$vault_root/branding/icon.svg" \
    --out "$vault_iconset/Vault.iconset/icon_${vault_size}x${vault_size}@2x.png" >/dev/null
done
iconutil -c icns "$vault_iconset/Vault.iconset" -o "$vault_desktop/resources/vault.icns"
cp "$vault_iconset/Vault.iconset/icon_512x512.png" "$vault_desktop/src/images/icon.png"
cp "$vault_iconset/Vault.iconset/icon_512x512.png" "$vault_desktop/src/images/icon_dev.png"
# macOS template images need an opaque black mark and transparent background.
sed -e '/<rect /d' -e 's/#ededee/#000000/g' "$vault_root/branding/icon.svg" > "$vault_iconset/template.svg"
for vault_size in 22 44; do
  vault_suffix=''
  if [ "$vault_size" -eq 44 ]; then vault_suffix='@2x'; fi
  sips -s format png -z "$vault_size" "$vault_size" "$vault_iconset/template.svg" \
    --out "$vault_desktop/src/images/icon-template${vault_suffix}.png" >/dev/null
done
echo 'Vault macOS candidate icons generated.'
