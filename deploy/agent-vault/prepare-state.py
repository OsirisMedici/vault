#!/usr/bin/env python3
"""Manager-run first activation only. Never overwrite an existing master key."""
import os
from pathlib import Path
import secrets


def main():
    if os.geteuid() != 0:
        raise RuntimeError()
    base = Path('/opt/osiris-agent-vault')
    base.mkdir(mode=0o700, exist_ok=True)
    if base.is_symlink() or base.stat().st_uid != 0:
        raise RuntimeError()
    os.chmod(base, 0o700)
    private = base / 'private'
    data = base / 'data'
    for folder in (private, data):
        folder.mkdir(mode=0o700, exist_ok=True)
        if folder.is_symlink() or not folder.is_dir():
            raise RuntimeError()
    # Refuse nonempty state: changing the encryption password is never a restart step.
    if any(private.iterdir()) or any(data.iterdir()):
        raise RuntimeError()
    os.chown(private, 0, 0)
    os.chmod(private, 0o700)
    os.chown(data, 65532, 65532)
    os.chmod(data, 0o700)
    descriptor = os.open(private / 'master-password', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        os.fchown(output.fileno(), 65532, 65532)
        os.fchmod(output.fileno(), 0o600)
        output.write(secrets.token_urlsafe(48) + '\n')
        output.flush()
        os.fsync(output.fileno())


if __name__ == '__main__':
    try:
        main()
        print('private_state_prepared')
    except Exception:
        print('private_state_not_prepared')
        raise SystemExit(1)
