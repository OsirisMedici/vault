#!/usr/bin/env python3
"""Activate only Vault's compiled web image, retaining a private rollback file."""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

COMPOSE = Path('/opt/vaultwarden/compose.yaml')
BASE = 'osiris-vault:0.2.3-menu-copy-40d0a0738eac'
BASE_ID = 'sha256:0a20cfac0155e296bb0be2e1bc88a78f954ff483d56fa364d98ac4bdae76daeb'
BACKUP = Path('/opt/vaultwarden/backups/vaultwarden-20261022T184241808398Z.tar.age')


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE, timeout=120)


def inspect(image):
    return json.loads(run('docker', 'image', 'inspect', image))[0]


def config(path):
    return json.loads(run('docker', 'compose', '-f', str(path), 'config', '--format', 'json'))


def write(path, data):
    meta = path.stat()
    fd, name = tempfile.mkstemp(prefix='.compose-collections-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            os.fchown(stream.fileno(), meta.st_uid, meta.st_gid)
            os.fchmod(stream.fileno(), meta.st_mode & 0o777)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)



ORIGIN = 'https://vault.scaleadvertisement.com'

def public_checks(expect_discovery=False):
    def get(path, expected=200, data=None):
        request = urllib.request.Request(ORIGIN + path, data=data, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                if response.status != expected or not response.url.startswith(ORIGIN + '/'):
                    raise ValueError('Unexpected public response')
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != expected:
                raise
            return b''

    get('/alive')
    get('/admin', 404)
    get('/identity/accounts/register', 403, b'{}')
    get('/api/accounts/register', 403, b'{}')
    configuration = json.loads(get('/api/config'))
    if expect_discovery:
        html = get('/')
        main = re.search(rb'app/main\.[a-f0-9]+\.js', html)
        if not main:
            raise ValueError('Vault main bundle was not served')
        bundle = get('/' + main.group().decode())
        if not all(marker in bundle for marker in
                   (b'VaultMacMenu/1', b'vault-collection-unfold')):
            raise ValueError('The Collections toolbar or Mac bridge was not served')
        css = re.search(rb'styles\.[a-f0-9]+\.css', html)
        if not css or b'vault-collection-spring' not in get('/' + css.group().decode()):
            raise ValueError('The Collections spring was not served')
        if b'<title page-title>Vault</title>' not in html:
            raise ValueError('Vault index was not served')
        if json.loads(get('/manifest.json')).get('name') != 'Vault':
            raise ValueError('Vault manifest was not served')
        if not re.search(rb'--color-background-alt\s*:\s*23\s+23\s+25\s*[;}]', get('/css/vaultwarden.css')):
            raise ValueError('Vault theme was not served')
        if configuration.get('settings', {}).get('suppressOnboardingInterstitials') is not True:
            raise ValueError('Vault still advertises extension onboarding')
        locale = json.loads(get('/locales/en/messages.json?release=copy-login'))
        if locale.get('searchVault', {}).get('message') != 'Search by name, site, or username':
            raise ValueError('Search locale was not served')
        if locale.get('copyLoginCredentials', {}).get('message') != 'Copy username and password':
            raise ValueError('Credential copy locale was not served')
    return configuration['environment']

def main(image, expected_image, expected_image_id, verified_backup):
    os.umask(0o077)
    changed = False
    original = None
    pending = None
    try:
        if os.geteuid() != 0 or not re.fullmatch(r'osiris-vault:0\.2\.4-collections-[a-f0-9]{7,40}', image):
            raise ValueError()
        backup_path = Path(verified_backup)
        if (not re.fullmatch(r'osiris-vault:[A-Za-z0-9_.-]+', expected_image) or
                not re.fullmatch(r'sha256:[a-f0-9]{64}', expected_image_id) or
                backup_path.parent != BACKUP.parent or backup_path.is_symlink() or
                not backup_path.is_file() or backup_path.stat().st_size < 1024 or
                time.time() - backup_path.stat().st_mtime > 1800 or COMPOSE.is_symlink()):
            raise ValueError()
        base, candidate = inspect(BASE), inspect(image)
        if base['Id'] != BASE_ID:
            raise ValueError()
        layers = base['RootFS']['Layers']
        if candidate['RootFS']['Layers'][:len(layers)] != layers:
            raise ValueError()
        expected_env = dict(item.split('=', 1) for item in base['Config'].get('Env', []))
        actual_env = dict(item.split('=', 1) for item in candidate['Config'].get('Env', []))
        if actual_env != expected_env:
            raise ValueError('Candidate image environment differs from the approved change')
        for field in ['Entrypoint', 'Cmd', 'WorkingDir', 'Volumes', 'User', 'ExposedPorts']:
            if candidate['Config'].get(field) != base['Config'].get(field):
                raise ValueError()
        public_before = public_checks()
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
        backup = COMPOSE.with_name('compose.pre-collections-' + image.rsplit('-', 1)[1] + '.yaml')
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(original)
            stream.flush()
            os.fsync(stream.fileno())
        pending = COMPOSE.with_name('.compose.collections-candidate.yaml')
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
        if not ready or public_checks(expect_discovery=True) != public_before:
            raise ValueError()
        print(json.dumps({'activated': True, 'image': image, 'imageId': candidate['Id'],
                          'serverLayersPreserved': True, 'composeOnlyImageChanged': True,
                          'rollbackCompose': str(backup)}))
        return 0
    except Exception as error:
        print('Release check failed: ' + type(error).__name__, flush=True)
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
