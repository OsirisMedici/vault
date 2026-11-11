# Only the OSS web files change. Retain the accepted server and configuration.
ARG BASE_IMAGE=osiris-vault:0.1.1-f9a2511
FROM ${BASE_IMAGE}
COPY web/ /web-vault/
COPY LICENSE NOTICE.md /usr/share/doc/vault/
LABEL org.opencontainers.image.title="Vault" \
      org.opencontainers.image.description="Vault with authenticated agent access"
