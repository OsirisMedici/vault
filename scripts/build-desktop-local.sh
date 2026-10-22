#!/bin/bash
# Build a separate local arm64 candidate. Never install, launch, or publish it.
set -euo pipefail
vault_root="$(cd "$(dirname "$0")/.." && pwd -P)"
vault_candidate="${1:-$vault_root/.cache/desktop-source}"
if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  echo 'This local candidate requires macOS arm64.' >&2
  exit 1
fi
cd "$vault_root"
command -v cargo >/dev/null
xcode-select -p >/dev/null

# Keep Node separate from the host runtime. Verify before extracting or executing.
vault_node_version=24.22.1
vault_node_archive="node-v${vault_node_version}-darwin-arm64.tar.gz"
vault_node_sha=89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7
vault_runtime="$vault_root/.cache/runtime"
vault_node_dir="$vault_runtime/node-v${vault_node_version}-darwin-arm64"
mkdir -p "$vault_runtime"
if [ ! -x "$vault_node_dir/bin/node" ]; then
  curl --fail --location --retry 2 \
    "https://nodejs.org/dist/v${vault_node_version}/${vault_node_archive}" \
    --output "$vault_runtime/$vault_node_archive"
  (cd "$vault_runtime" && printf '%s  %s\n' "$vault_node_sha" "$vault_node_archive" | shasum -a 256 -c -)
  tar -xzf "$vault_runtime/$vault_node_archive" -C "$vault_runtime"
fi
export PATH="$vault_node_dir/bin:$PATH"
export HUSKY=0
test "$(node --version)" = "v$vault_node_version"

# Preparation refuses existing outputs and requires the pinned, clean source.
git submodule update --init --depth 1 upstream/desktop
python3 scripts/prepare-desktop.py --output "$vault_candidate"
bash scripts/build-desktop-icons.sh "$vault_candidate"
python3 scripts/verify-desktop.py "$vault_candidate"
vault_candidate="$(cd "$vault_candidate" && pwd -P)"
cd "$vault_candidate"
npm ci --no-audit --no-fund
cd apps/desktop
npm run build --workspace @bitwarden/desktop-napi -- --release
npm run build:oss
CSC_IDENTITY_AUTO_DISCOVERY=false npx --no-install electron-builder \
  --config electron-builder.vault.json --mac --arm64 --dir --publish never
printf 'Local candidate: %s\n' "$PWD/dist-vault/mac-arm64/Vault.app"
