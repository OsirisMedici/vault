#!/bin/sh
set -eu
umask 077
secret=/run/secrets/master_password
# Compose bind secrets retain host ownership. Require host uid 65532, mode600.
[ -f "$secret" ] && [ ! -L "$secret" ] && [ -s "$secret" ] || exit 70
[ "$(stat -c '%u:%g:%a' "$secret")" = "$(id -u):$(id -g):600" ] || exit 70
[ "$(wc -c < "$secret")" -le 4096 ] || exit 70
# Fail before upstream can initialize a missing database or generate a new CA.
for directory in /data /data/.agent-vault /data/.agent-vault/ca; do
  [ -d "$directory" ] && [ ! -L "$directory" ] || exit 70
  [ "$(stat -c '%u:%g:%a' "$directory")" = "$(id -u):$(id -g):700" ] || exit 70
done
for file in /data/.vault-companion-staged /data/.agent-vault/agent-vault.db \
  /data/.agent-vault/ca/ca.crt.pem /data/.agent-vault/ca/ca.key.enc; do
  [ -f "$file" ] && [ ! -L "$file" ] && [ -s "$file" ] || exit 70
  [ "$(stat -c '%u:%g:%a' "$file")" = "$(id -u):$(id -g):600" ] || exit 70
done
[ "$(cat /data/.vault-companion-staged)" = 'linux:65532:65532' ] || exit 70
# A Mac PID has no identity in this dedicated container's PID namespace.
# Only process markers are disposable; all credential/key/CA files stay intact.
for file in /data/.agent-vault/agent-vault.pid /data/.agent-vault/agent-vault.pid.tmp; do
  [ ! -L "$file" ] || exit 70
  if [ -e "$file" ]; then
    [ -f "$file" ] || exit 70
    [ "$(stat -c '%u:%g:%a' "$file")" = "$(id -u):$(id -g):600" ] || exit 70
    rm -f "$file"
  fi
done
unset AGENT_VAULT_MASTER_PASSWORD AGENT_VAULT_EVAL_HOME DATABASE_URL _AGENT_VAULT_DETACHED
export HOME=/data AGENT_VAULT_TELEMETRY=false
exec /usr/local/bin/agent-vault server --host 0.0.0.0 --port 14321 \
  --mitm-port 14322 --password-stdin < "$secret"
