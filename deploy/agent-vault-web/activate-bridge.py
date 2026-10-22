#!/usr/bin/env python3
"""Upgrade only the existing bridge image with exact preconditions and rollback."""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import time


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE, timeout=120)


def inspect(kind, value):
    return json.loads(run('docker', kind, 'inspect', value))[0]


def config(path):
    return json.loads(run('docker', 'compose', '-f', str(path), 'config', '--format', 'json'))


def write(path, data, exclusive=False):
    flags = os.O_WRONLY | os.O_NOFOLLOW | (os.O_CREAT | os.O_EXCL if exclusive else os.O_TRUNC)
    with os.fdopen(os.open(path, flags, 0o600), 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def main(args):
    os.umask(0o077)
    original = None
    compose = None
    pending = None
    changed = False
    try:
        if os.geteuid() != 0 or not re.fullmatch(r'osiris-vault-agent-web:v2-[a-f0-9]{7,40}', args.image):
            raise ValueError()
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', args.expected_image_id):
            raise ValueError()
        state = inspect('container', 'osiris-vault-agent-web')
        if (state['Config']['Image'] != args.expected_image or state['Image'] != args.expected_image_id or
                state['State'].get('Health', {}).get('Status') != 'healthy'):
            raise ValueError()
        compose = Path(state['Config']['Labels']['com.docker.compose.project.config_files'])
        if (not compose.is_absolute() or not str(compose).startswith('/opt/osiris-vault-agent-web-release-') or
                compose.is_symlink() or compose.resolve() != compose):
            raise ValueError()
        previous, candidate = inspect('image', args.expected_image), inspect('image', args.image)
        if previous['Id'] != args.expected_image_id:
            raise ValueError()
        for field in ['Env', 'Entrypoint', 'Cmd', 'WorkingDir', 'Volumes', 'User', 'ExposedPorts']:
            if previous['Config'].get(field) != candidate['Config'].get(field):
                raise ValueError()
        original = compose.read_bytes()
        before = config(compose)
        if set(before['services']) != {'bridge'} or before['services']['bridge']['image'] != args.expected_image:
            raise ValueError()
        pattern = rb'(?m)^(\s*image:\s*)' + re.escape(args.expected_image.encode()) + rb'(\s*)$'
        data, count = re.subn(pattern, lambda m: m[1] + args.image.encode() + m[2], original)
        if count != 1:
            raise ValueError()
        suffix = args.image.rsplit('-', 1)[1]
        rollback = compose.with_name('compose.pre-v2-' + suffix + '.yaml')
        write(rollback, original, True)
        pending = compose.with_name('.compose.v2-' + suffix + '.yaml')
        write(pending, data, True)
        expected = copy.deepcopy(before)
        expected['services']['bridge']['image'] = args.image
        if config(pending) != expected:
            raise ValueError()
        changed = True
        write(compose, data)
        run('docker', 'compose', '-f', str(compose), 'up', '-d', '--no-deps', 'bridge')
        for _ in range(45):
            state = inspect('container', 'osiris-vault-agent-web')
            if state['Image'] == candidate['Id'] and state['State'].get('Health', {}).get('Status') == 'healthy':
                print(json.dumps({'activated': True, 'image': args.image, 'imageId': candidate['Id'],
                                  'composeOnlyImageChanged': True, 'rollbackCompose': str(rollback)}))
                return 0
            time.sleep(2)
        raise ValueError()
    except Exception:
        restored = False
        if changed and original is not None:
            try:
                write(compose, original)
                run('docker', 'compose', '-f', str(compose), 'up', '-d', '--no-deps', 'bridge')
                restored = True
            except Exception:
                pass
        print(json.dumps({'activated': False, 'rollbackApplied': restored, 'reasonCode': 'bridge_activation_failed'}))
        return 1
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image')
    parser.add_argument('--expected-image', required=True)
    parser.add_argument('--expected-image-id', required=True)
    raise SystemExit(main(parser.parse_args()))
