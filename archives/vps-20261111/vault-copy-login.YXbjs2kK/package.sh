#!/usr/bin/env bash
set -euo pipefail
base=/home/canvasadmin/vault-password-ui.6IpCeJAF
stage=/home/canvasadmin/vault-copy-login.YXbjs2kK
cd "$stage"
mkdir -p scripts branding .cache image source-notice
cp "$base/scripts/prepare-agent-web-release.py" scripts/
cp "$base/branding/"{icon,wordmark}.svg branding/
if [ ! -f .cache/compiled/index.html ]; then cp -a source/apps/web/build .cache/compiled; fi
python3 scripts/prepare-agent-web-release.py .cache/compiled --output .cache/packaged
mv .cache/packaged image/web
cp "$base/.cache/discovery-source-notice/"{LICENSE,NOTICE.md,web-password-discovery.patch} source-notice/
cp copy.patch source-notice/web-copy-login.patch
cat "$base/.cache/discovery-source-notice/BUILD.txt" > source-notice/BUILD.txt
cat >> source-notice/BUILD.txt <<'NOTICE'

For the Vault copy-login release, apply web-copy-login.patch after
web-password-discovery.patch before compiling. The extra patch changes the
client's login copy controls. It does not change the server binary.
NOTICE
tar -czf image/web/vault-copy-login-source.tar.gz -C source-notice .
python3 - <<'PY'
import json
from pathlib import Path
locale=json.loads(Path('image/web/locales/en/messages.json').read_text())
assert locale['copyLoginCredentials']['message'] == 'Copy username and password'
assert any(b'copyLoginCredentialsFailed' in path.read_bytes() for path in Path('image/web').rglob('*.js'))
print('Compiled web contains the credential copy action and its locale.')
PY
