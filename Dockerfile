# The server, cryptography and API implementation are unchanged upstream code.
FROM vaultwarden/server:1.37.4@sha256:efb3cde962015fcc036b2ea625242248611943b27212ebf4392841fb30fad055
COPY dist/overlay/ /web-vault/
COPY templates/ /vault-templates/
COPY LICENSE NOTICE.md /usr/share/doc/vault/
ENV TEMPLATES_FOLDER=/vault-templates
LABEL org.opencontainers.image.title="Vault" \
      org.opencontainers.image.description="Charcoal web branding for Vaultwarden" \
      org.opencontainers.image.source="https://github.com/OsirisMedici/vault" \
      org.opencontainers.image.licenses="GPL-3.0-only AND AGPL-3.0-only"
