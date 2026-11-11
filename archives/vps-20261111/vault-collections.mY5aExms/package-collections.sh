#!/usr/bin/env bash
set -euo pipefail
stage="$1"
previous=/home/canvasadmin/vault-menu-copy.yJjyt76a
base=osiris-vault:0.2.3-menu-copy-40d0a0738eac
base_id=sha256:0a20cfac0155e296bb0be2e1bc88a78f954ff483d56fa364d98ac4bdae76daeb
cd "$stage"
test "$(cat build.status)" = 0
test "$(sudo -n docker image inspect "$base" --format '{{.Id}}')" = "$base_id"
mkdir -p scripts branding .cache image/web source-notice
cp "$previous/scripts/prepare-agent-web-release.py" scripts/
cp "$previous/branding/"{icon,wordmark}.svg branding/
cp -a source/apps/web/build .cache/compiled
python3 scripts/prepare-agent-web-release.py .cache/compiled --output .cache/packaged
tar --exclude='*.map' -cf - -C .cache/packaged . | tar -xf - -C image/web
cp "$previous/source-notice/"{LICENSE,NOTICE.md,BUILD.txt,web-copy-login.patch,web-password-discovery.patch,web-mac-menu-copy.patch} source-notice/
cp web-collections-toolbar.patch source-notice/
cat >> source-notice/BUILD.txt <<'NOTICE'

Apply web-collections-toolbar.patch after web-mac-menu-copy.patch.
The Collections toolbar reuses the Vault filter and samples the spring from
Cult UI Toolbar Expandable (https://www.cult-ui.com/docs/components/toolbar-expandable).
It is implemented in Angular and CSS.
NOTICE
tar -czf image/web/vault-collections-toolbar-source.tar.gz -C source-notice .
python3 - <<'PY'
from pathlib import Path
import json
import re
web = Path('image/web')
main = re.search(r'app/main\.[a-f0-9]+\.js', (web / 'index.html').read_text()).group()
data = (web / main).read_bytes()
for expected in (b'vault-collection-unfold', b'VaultMacMenu/1'):
    assert expected in data
css = re.search(r'styles\.[a-f0-9]+\.css', (web / 'index.html').read_text()).group()
assert b'vault-collection-spring' in (web / css).read_bytes()
locale = json.loads((web / 'locales/en/messages.json').read_text())
assert locale['copyLoginCredentials']['message'] == 'Copy username and password'
assert not list(web.rglob('*.map'))
print(main)
PY
cat > image/Dockerfile <<DOCKER
FROM $base
COPY web/ /web-vault/
LABEL org.opencontainers.image.description="Vault web Collections toolbar"
DOCKER
identity="$(cat web-collections-toolbar.patch image/Dockerfile | sha256sum | cut -c1-12)"
image="osiris-vault:0.2.4-collections-$identity"
sudo -n docker build --pull=false --tag "$image" image > image-build.log 2>&1 || { tail -25 image-build.log; exit 1; }
printf '%s\n' "$image" > image-name
sudo -n docker image inspect "$image" --format '{{.Id}}'
printf '%s\n' "$image"
