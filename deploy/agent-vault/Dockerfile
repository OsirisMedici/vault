ARG UPSTREAM_IMAGE=osiris-agent-vault-upstream:d5836ec3bb2315de38043d742ae5daca11a4944a
FROM ${UPSTREAM_IMAGE}
COPY --chmod=0555 launch.sh /usr/local/bin/vault-companion-launch
COPY LICENSE.upstream NOTICE.md /usr/share/licenses/agent-vault/
LABEL org.opencontainers.image.source="https://github.com/Infisical/agent-vault" \
      org.opencontainers.image.revision="d5836ec3bb2315de38043d742ae5daca11a4944a"
ENTRYPOINT ["/usr/local/bin/vault-companion-launch"]
CMD []
