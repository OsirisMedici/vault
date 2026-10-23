#!/bin/sh
set -eu
# Exact-source build; no submodules, trial state or credential files enter context.
revision=d5836ec3bb2315de38043d742ae5daca11a4944a
script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/vault-companion-build.XXXXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
git init -q "$build_dir/source"
git -C "$build_dir/source" fetch --depth=1 https://github.com/Infisical/agent-vault.git "$revision"
git -C "$build_dir/source" checkout -q --detach FETCH_HEAD
[ "$(git -C "$build_dir/source" rev-parse HEAD)" = "$revision" ]
docker build --build-arg VERSION=v0.40.1 --build-arg COMMIT="$revision" \
  --build-arg BUILD_DATE=2026-10-22T00:00:00Z \
  -t "osiris-agent-vault-upstream:$revision" "$build_dir/source"
docker build --build-arg "UPSTREAM_IMAGE=osiris-agent-vault-upstream:$revision" \
  -t "osiris-agent-vault:$revision" "$script_dir"
docker image inspect --format '{{.Id}}' "osiris-agent-vault:$revision"
