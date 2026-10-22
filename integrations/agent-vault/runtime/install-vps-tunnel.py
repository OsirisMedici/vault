#!/usr/bin/env python3
"""Install the owned private VPS API tunnel without changing engine data."""
import json
import os
from pathlib import Path
import plistlib
import socket
import stat
import subprocess
import time
import urllib.request

LABEL = 'com.osirismedici.agent-vault-vps-tunnel'
PLIST = Path.home() / 'Library/LaunchAgents' / (LABEL + '.plist')


def main():
    os.umask(0o077)
    try:
        arguments = ['/usr/bin/ssh', '-N', '-T', '-o', 'BatchMode=yes',
                     '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=15',
                     '-o', 'ServerAliveCountMax=3', '-o', 'ConnectTimeout=10',
                     '-L', '127.0.0.1:19431:127.0.0.1:19431',
                     '-L', '127.0.0.1:19433:127.0.0.1:19433', 'hostinger-osiris']
        data = {'Label': LABEL, 'ProgramArguments': arguments,
                'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 15,
                'StandardOutPath': '/dev/null', 'StandardErrorPath': '/dev/null',
                'ProcessType': 'Background', 'Umask': 0o077}
        domain = 'gui/' + str(os.getuid())
        loaded = subprocess.run(['/bin/launchctl', 'print', domain + '/' + LABEL],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if PLIST.exists() or PLIST.is_symlink():
            info = PLIST.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600:
                raise RuntimeError()
            existing = plistlib.loads(PLIST.read_bytes())
            if existing != data:
                legacy = {**data, 'ProgramArguments': [*arguments[:-3], arguments[-1]]}
                if existing != legacy:
                    raise RuntimeError()
                with socket.socket() as sock:
                    sock.settimeout(.3)
                    if sock.connect_ex(('127.0.0.1', 19433)) == 0:
                        raise RuntimeError()
                if loaded:
                    subprocess.run(['/bin/launchctl', 'bootout', domain + '/' + LABEL], check=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    loaded = False
                pending = PLIST.with_suffix('.pending')
                fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(fd, 'wb') as stream:
                    plistlib.dump(data, stream)
                os.replace(pending, PLIST)
        else:
            for port in [19431, 19433]:
                with socket.socket() as sock:
                    sock.settimeout(.3)
                    if sock.connect_ex(('127.0.0.1', port)) == 0:
                        raise RuntimeError()
            PLIST.parent.mkdir(exist_ok=True)
            fd = os.open(PLIST, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as stream:
                plistlib.dump(data, stream)
        if not loaded:
            subprocess.run(['/bin/launchctl', 'bootstrap', domain, str(PLIST)], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        ready = False
        for _ in range(15):
            try:
                with opener.open('http://127.0.0.1:19431/health', timeout=2) as response:
                    ready = response.status == 200
                if ready:
                    break
            except Exception:
                pass
            time.sleep(1)
        print(json.dumps({'installed': True, 'managed': True, 'tunnel_ready': ready}))
        return 0 if ready else 1
    except Exception:
        print('{"installed":false,"reasonCode":"private_tunnel_unavailable"}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
