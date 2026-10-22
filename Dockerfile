# The server, cryptography and API implementation are unchanged upstream code.
FROM vaultwarden/server:1.37.4@sha256:efb3cde962015fcc036b2ea625242248611943b27212ebf4392841fb30fad055
COPY dist/overlay/ /web-vault/
COPY templates/ /keyflow-templates/
COPY LICENSE NOTICE.md /usr/share/doc/keyflow/
ENV TEMPLATES_FOLDER=/keyflow-templates
LABEL org.opencontainers.image.title="Keyflow" \
      org.opencontainers.image.description="Charcoal web branding for Vaultwarden" \
      org.opencontainers.image.source="https://github.com/OsirisMedici/keyflow" \
      org.opencontainers.image.licenses="GPL-3.0-only AND AGPL-3.0-only"
