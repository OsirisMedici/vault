#!/usr/bin/env bash
set -euo pipefail
base=/home/canvasadmin/vault-password-ui.6IpCeJAF
prev=/home/canvasadmin/vault-copy-login.YXbjs2kK
stage=/home/canvasadmin/vault-menu-copy.yJjyt76a
cd "$stage"
mkdir -p scripts branding .cache image/web source-notice
cp "$base/scripts/prepare-agent-web-release.py" scripts/
cp "$base/branding/"{icon,wordmark}.svg branding/
cp -a source/apps/web/build .cache/compiled
python3 scripts/prepare-agent-web-release.py .cache/compiled --output .cache/packaged
tar --exclude='*.map' -cf - -C .cache/packaged . | tar -xf - -C image/web
cp "$prev/source-notice/"{LICENSE,NOTICE.md,BUILD.txt,web-copy-login.patch,web-password-discovery.patch} source-notice/
cp mac-copy.patch source-notice/web-mac-menu-copy.patch
cat >> source-notice/BUILD.txt <<'NOTICE'

Apply web-mac-menu-copy.patch after web-copy-login.patch. The Mac launcher
uses this bridge to copy a saved login from the active, unlocked web client.
NOTICE
tar -czf image/web/vault-mac-menu-copy-source.tar.gz -C source-notice .
python3 - <<'PY'
from pathlib import Path
assert any(b'VaultMacMenu/1' in p.read_bytes() for p in Path('image/web').rglob('*.js'))
PY
cat > image/Dockerfile <<'DOCKER'
FROM osiris-vault:0.2.2-copy-login-0e82014d106b
COPY web/ /web-vault/
LABEL org.opencontainers.image.description="Vault Mac menu copy actions"
DOCKER
identity="$(cat mac-copy.patch image/Dockerfile | sha256sum | cut -c1-12)"
image="osiris-vault:0.2.3-menu-copy-$identity"
sudo -n docker build --pull=false --tag "$image" image > image-build.log 2>&1 || { tail -25 image-build.log; exit 1; }
printf '%s\n' "$image" >image-name
sudo -n docker image inspect "$image" --format '{{.Id}}'
printf '%s\n' "$image"
