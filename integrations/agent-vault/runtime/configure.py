#!/usr/bin/env python3
"""Configure the trusted host from the preserved private engine enrollment."""
import json
import os
from pathlib import Path
import stat
import sys
import urllib.error
import urllib.request

ROOT = Path.home() / '.local/share/osiris-agent-vault/engine'
PRIVATE = Path.home() / '.config/osiris-agent-vault/integration-v1'
VAULT = 'bitwarden-import-20261022'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError('redirect_denied')

def read(path):
    s = path.lstat()
    if path.is_symlink() or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != 0o600 or not stat.S_ISREG(s.st_mode):
        raise RuntimeError('unsafe_private_file')
    return json.loads(path.read_text())

def save(path, text):
    temporary = path.with_name(path.name + '.pending')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(text)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)

def main():
    os.umask(0o077)
    try:
        PRIVATE.mkdir(mode=0o700, parents=True, exist_ok=True)
        s = PRIVATE.lstat()
        if PRIVATE.is_symlink() or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != 0o700:
            raise RuntimeError('unsafe_private_directory')
        control = read(ROOT / 'runtime/control.json')
        token_path = PRIVATE / 'member-token'
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        def api(path, body=None):
            req = urllib.request.Request('http://127.0.0.1:18431' + path,
                data=json.dumps(body).encode() if body is not None else None,
                headers={'Authorization': 'Bearer ' + control['ownerToken'], 'Content-Type': 'application/json'})
            with opener.open(req, timeout=8) as response:
                data = response.read(65537)
                if len(data) > 65536:
                    raise RuntimeError('oversized_response')
                return json.loads(data)
        refreshed = False
        try:
            api('/v1/sessions?vault=' + VAULT)
        except urllib.error.HTTPError as e:
            if e.code != 401:
                raise
            account = read(ROOT / 'runtime/owner-login.json')
            response = api('/v1/auth/login', {'email': account['email'], 'password': account['password']})
            if not isinstance(response.get('token'), str) or not response['token']:
                raise RuntimeError('owner_login_required')
            control['ownerToken'] = response['token']
            save(ROOT / 'runtime/control.json', json.dumps(control))
            api('/v1/sessions?vault=' + VAULT)
            refreshed = True
        save(token_path, control['ownerToken'])
        save(PRIVATE / 'engine.json', json.dumps({'version': 1, 'address': 'http://127.0.0.1:18431',
             'vaultName': VAULT, 'tokenFile': str(token_path)}))
        print(json.dumps({'configured': True, 'capability_refreshed': refreshed}))
        return 0
    except Exception:
        print('{"configured":false,"reasonCode":"private_configuration_unavailable"}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
