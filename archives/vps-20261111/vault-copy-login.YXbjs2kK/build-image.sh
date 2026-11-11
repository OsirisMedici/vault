#!/usr/bin/env bash
set -euo pipefail
stage=/home/canvasadmin/vault-copy-login.YXbjs2kK
cd "$stage"
test -f image/web/vault-copy-login-source.tar.gz
test "$(sudo -n docker image inspect osiris-vault:0.2.1-discovery-abfaf119a452 --format '{{.Id}}')" = 'sha256:62af77fe664307d41e932a8ab24a4809f953f8d6428a8cec0e2e9369d6d4e4b2'
cat > image/Dockerfile <<'DOCKER'
FROM osiris-vault:0.2.1-discovery-abfaf119a452
COPY web/ /web-vault/
ENV CLIENT_SUPPRESS_ONBOARDING=true
LABEL org.opencontainers.image.description="Vault login copy and extension-free onboarding"
DOCKER
identity="$(cat copy.patch image/Dockerfile | sha256sum | cut -c1-12)"
image="osiris-vault:0.2.2-copy-login-$identity"
sudo -n docker build --pull=false --tag "$image" image > image-build.log 2>&1 || { tail -28 image-build.log; exit 1; }
printf '%s\n' "$image" >image-name
sudo -n docker image inspect "$image" --format '{{.Id}}'
printf '%s\n' "$image"
