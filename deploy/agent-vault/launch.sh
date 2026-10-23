#!/bin/sh
set -eu
umask 077
secret=/run/secrets/master_password
# Compose bind secrets retain host ownership. Require host uid 65532, mode600.
[ -f "$secret" ] && [ ! -L "$secret" ] && [ -s "$secret" ] || exit 70
[ "$(stat -c '%u:%a' "$secret")" = "$(id -u):600" ] || exit 70
[ "$(wc -c < "$secret")" -le 4096 ] || exit 70
exec /usr/local/bin/agent-vault server --host 0.0.0.0 --port 14321 \
  --mitm-port 14322 --password-stdin < "$secret"
