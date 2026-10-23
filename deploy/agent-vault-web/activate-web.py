#!/usr/bin/env python3
"""Activate only Vault's compiled web image, retaining a private rollback file."""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import time

COMPOSE = Path('/opt/vaultwarden/compose.yaml')
BASE = 'osiris-vault:0.1.1-f9a2511'
BASE_ID = 'sha256:ff0c06e75d79882681707de4fc1ce22eaa40324dab805033d1ba62073142be05'
BACKUP = Path('/opt/vaultwarden/backups/vaultwarden-20261022T184241808398Z.tar.age')


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE, timeout=120)


def inspect(image):
    return json.loads(run('docker', 'image', 'inspect', image))[0]


def config(path):
    return json.loads(run('docker', 'compose', '-f', str(path), 'config', '--format', 'json'))


def write(path, data):
    with path.open('wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def main(image, expected_image, expected_image_id, verified_backup):
    os.umask(0o077)
    changed = False
    original = None
    pending = None
    try:
        if os.geteuid() != 0 or not re.fullmatch(r'osiris-vault:0\.2\.0-agent-web-[a-f0-9]{7,40}', image):
            raise ValueError()
        backup_path = Path(verified_backup)
        if (not re.fullmatch(r'osiris-vault:[A-Za-z0-9_.-]+', expected_image) or
                not re.fullmatch(r'sha256:[a-f0-9]{64}', expected_image_id) or
                backup_path.parent != BACKUP.parent or backup_path.is_symlink() or
                not backup_path.is_file() or backup_path.stat().st_size < 1024 or COMPOSE.is_symlink()):
            raise ValueError()
        base, candidate = inspect(BASE), inspect(image)
        if base['Id'] != BASE_ID:
            raise ValueError()
        layers = base['RootFS']['Layers']
        if candidate['RootFS']['Layers'][:len(layers)] != layers:
            raise ValueError()
        for field in ['Env', 'Entrypoint', 'Cmd', 'WorkingDir', 'Volumes', 'User', 'ExposedPorts']:
            if candidate['Config'].get(field) != base['Config'].get(field):
                raise ValueError()
        original = COMPOSE.read_bytes()
        before = config(COMPOSE)
        if set(before['services']) != {'vaultwarden'} or before['services']['vaultwarden']['image'] != expected_image:
            raise ValueError()
        running = json.loads(run('docker', 'inspect', 'osiris-vaultwarden'))[0]
        if running['Image'] != expected_image_id or inspect(expected_image)['Id'] != expected_image_id or running['State'].get('Health', {}).get('Status') != 'healthy':
            raise ValueError()
        pattern = rb'(?m)^(\s*image:\s*)' + re.escape(expected_image.encode()) + rb'(\s*)$'
        data, count = re.subn(pattern, lambda m: m[1] + image.encode() + m[2], original)
        if count != 1:
            raise ValueError()
        backup = COMPOSE.with_name('compose.pre-agent-web-' + image.rsplit('-', 1)[1] + '.yaml')
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(original)
            stream.flush()
            os.fsync(stream.fileno())
        pending = COMPOSE.with_name('.compose.agent-web-candidate.yaml')
        fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        expected = copy.deepcopy(before)
        expected['services']['vaultwarden']['image'] = image
        if config(pending) != expected:
            raise ValueError()
        changed = True
        write(COMPOSE, data)
        run('docker', 'compose', '-f', str(COMPOSE), 'up', '-d', '--no-deps', 'vaultwarden')
        ready = False
        for _ in range(45):
            state = json.loads(run('docker', 'inspect', 'osiris-vaultwarden'))[0]
            if state['Image'] == candidate['Id'] and state['State'].get('Health', {}).get('Status') == 'healthy':
                ready = True
                break
            time.sleep(2)
        if not ready:
            raise ValueError()
        print(json.dumps({'activated': True, 'image': image, 'imageId': candidate['Id'],
                          'serverLayersPreserved': True, 'composeOnlyImageChanged': True,
                          'rollbackCompose': str(backup)}))
        return 0
    except Exception:
        restored = False
        if changed and original is not None:
            try:
                write(COMPOSE, original)
                run('docker', 'compose', '-f', str(COMPOSE), 'up', '-d', '--no-deps', 'vaultwarden')
                restored = True
            except Exception:
                pass
        print(json.dumps({'activated': False, 'rollbackApplied': restored, 'reasonCode': 'web_activation_failed'}))
        return 1
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image')
    parser.add_argument('--expected-image', required=True)
    parser.add_argument('--expected-image-id', required=True)
    parser.add_argument('--verified-backup', required=True,
                        help='Fresh encrypted backup already checked by the release owner')
    args = parser.parse_args()
    raise SystemExit(main(args.image, args.expected_image, args.expected_image_id, args.verified_backup))
