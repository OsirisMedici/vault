#!/usr/bin/env python3
"""Add only Vault's authenticated bridge route, preserving every other site."""
from pathlib import Path
import json
import os
import subprocess

CONFIG = Path('/opt/canvas-cloud/releases/f3d0edd-publish-ages/deploy/cloud/Caddyfile')
CONTAINER = 'canvas-cloud-pilot-caddy-1'
SITE = 'vault.scaleadvertisement.com {\n'
ROUTE = '''    handle_path /api/agent-vault/* {
        @agentWorker path /worker /worker/*
        respond @agentWorker 404
        reverse_proxy osiris-vault-agent-web:19433
    }
'''


def command(*args, data=None):
    return subprocess.run(args, input=data, capture_output=True, timeout=30).returncode == 0


def write_bound_file(text):
    # Preserve the existing bind-mounted inode. The running Caddy is reloaded
    # explicitly only after a complete flush, never from a partial candidate.
    with CONFIG.open('w') as stream:
        stream.write(text)
        stream.flush()
        os.fsync(stream.fileno())


def main():
    os.umask(0o077)
    original = None
    changed = False
    try:
        if os.geteuid() != 0 or CONFIG.is_symlink():
            raise RuntimeError()
        original = CONFIG.read_text()
        if original.count(SITE) != 1:
            raise RuntimeError()
        if ROUTE in original:
            print('{"configured":true,"existing":true}')
            return 0
        if '/api/agent-vault' in original:
            raise RuntimeError()
        candidate = original.replace(SITE, SITE + ROUTE, 1)
        if candidate.replace(ROUTE, '', 1) != original:
            raise RuntimeError()
        if not command('docker', 'exec', '-i', CONTAINER, 'caddy', 'validate',
                       '--config', '/dev/stdin', '--adapter', 'caddyfile', data=candidate.encode()):
            raise RuntimeError()
        backup = CONFIG.with_name('Caddyfile.pre-agent-web-20261023')
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(original)
            stream.flush()
            os.fsync(stream.fileno())
        changed = True
        write_bound_file(candidate)
        if not command('docker', 'exec', CONTAINER, 'caddy', 'reload',
                       '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'):
            raise RuntimeError()
        print(json.dumps({'configured':True,'other_sites_preserved':True,'worker_routes_publicly_blocked':True}))
        return 0
    except Exception:
        if changed and original is not None:
            write_bound_file(original)
            command('docker','exec',CONTAINER,'caddy','reload','--config','/etc/caddy/Caddyfile','--adapter','caddyfile')
        print('{"configured":false,"reasonCode":"proxy_configuration_failed"}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
