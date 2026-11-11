#!/usr/bin/env python3
"""Root-owned server snapshot. Encrypt before retaining a backup."""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile

BASE = Path('/opt/vaultwarden')


def compose(*args):
    subprocess.run(['docker', 'compose', '-f', str(BASE / 'compose.yaml'), *args],
                   cwd=BASE, check=True, stdout=subprocess.DEVNULL)


def main():
    os.umask(0o077)
    with (BASE / '.backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        recipient = (BASE / 'backup-recipient.txt').read_text().strip()
        if not recipient.startswith('age1'):
            raise RuntimeError('Missing public backup recipient')
        if shutil.disk_usage(BASE).free < 1024 ** 3:
            raise RuntimeError('Less than 1 GiB free; no backup or cleanup attempted')
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        directory = BASE / 'backups'
        directory.mkdir(mode=0o700, exist_ok=True)
        target = directory / f'vaultwarden-{stamp}.tar.age'
        partial = target.with_suffix('.age.partial')
        service = json.loads(subprocess.check_output(['docker', 'inspect', 'osiris-vaultwarden'], text=True))[0]
        if not service['State']['Running']:
            raise RuntimeError('Vaultwarden must be running before snapshot')
        try:
            with tempfile.TemporaryDirectory(prefix='.snapshot-', dir=BASE) as tmp:
                stage = Path(tmp)
                try:
                    compose('stop', 'vaultwarden')
                    data = BASE / 'data'
                    shutil.copytree(data, stage / 'data', ignore=shutil.ignore_patterns(
                        'db.sqlite3', 'db.sqlite3-wal', 'db.sqlite3-shm', 'icon_cache', 'tmp'))
                    with sqlite3.connect(f'file:{data / "db.sqlite3"}?mode=ro', uri=True) as source:
                        with sqlite3.connect(stage / 'data' / 'db.sqlite3') as dest:
                            source.backup(dest)
                            if dest.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                                raise RuntimeError('Snapshot database failed integrity check')
                finally:
                    compose('start', 'vaultwarden')
                deploy = stage / 'deployment'
                deploy.mkdir()
                for name in ['compose.yaml', 'runtime.env', 'Caddyfile.fragment',
                             'backup.py', 'owner-invite.py', 'proxy.py', 'README.md', 'backup-recipient.txt']:
                    source = BASE / name
                    if source.exists():
                        shutil.copy2(source, deploy / name)
                # Bootstrap admin access must never become part of a retained backup.
                config = deploy / 'runtime.env'
                config.write_text('\n'.join(x for x in config.read_text().splitlines()
                                             if not x.startswith('ADMIN_TOKEN=')) + '\n')
                (stage / 'manifest.json').write_text(json.dumps({
                    'format': 1, 'created_at': stamp, 'domain': 'https://vault.scaleadvertisement.com',
                    'image': service['Config']['Image'], 'database_integrity': 'ok',
                    'snapshot_method': 'service pause, SQLite backup API, full data directory',
                }, indent=2) + '\n')
                tar = subprocess.Popen(['tar', '-cf', '-', '-C', str(stage), '.'], stdout=subprocess.PIPE)
                try:
                    encrypted = subprocess.run(['age', '-r', recipient, '-o', str(partial)],
                                               stdin=tar.stdout, check=False)
                    tar.stdout.close()
                    tar_status = tar.wait()
                    if encrypted.returncode or tar_status:
                        raise RuntimeError('Backup encryption/archive failed')
                finally:
                    if tar.poll() is None:
                        tar.terminate()
                        tar.wait()
                partial.rename(target)
        finally:
            partial.unlink(missing_ok=True)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        target.with_suffix(target.suffix + '.sha256').write_text(digest + '  ' + target.name + '\n')
        print(json.dumps({'backup': str(target), 'sha256': digest, 'bytes': target.stat().st_size}))


if __name__ == '__main__':
    main()
