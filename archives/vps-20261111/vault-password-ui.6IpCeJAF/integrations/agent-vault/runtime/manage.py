#!/usr/bin/env python3
"""Manage the existing private macOS Agent Vault runtime without recreating keys."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import socket
import sqlite3
import stat
import subprocess
import sys
import time
import urllib.request

LABEL = 'com.osirismedici.agent-vault'
ROOT = Path.home() / '.local/share/osiris-agent-vault/engine'
PLIST = Path.home() / 'Library/LaunchAgents' / (LABEL + '.plist')
CONFIG = ROOT / 'runtime.json'
EXPECTED_SHA = '346465d4cc8526100c1bc859199aeaa36aea386b20a51b0ac67346b01f0902c6'

def private(path, directory=False):
    s = path.lstat()
    if path.is_symlink() or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != (0o700 if directory else 0o600):
        raise RuntimeError('unsafe_private_file')
    if not (stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode)):
        raise RuntimeError('unsafe_private_file')

def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')
    path.chmod(0o600)

def listening(port):
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(('127.0.0.1', port)) == 0

def inventory(path):
    with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as c:
        vault = c.execute('SELECT id FROM vaults WHERE name=?', ('bitwarden-import-20261022',)).fetchone()
        fields = c.execute('SELECT COUNT(*) FROM credentials WHERE vault_id=?', (vault[0],)).fetchone()[0] if vault else 0
        return {'total_fields': c.execute('SELECT COUNT(*) FROM credentials').fetchone()[0],
                'import_fields': fields, 'database_ok': c.execute('PRAGMA quick_check').fetchone()[0] == 'ok'}

def snapshot(source, destination):
    shutil.copytree(source, destination)
    db = destination / '.agent-vault/agent-vault.db'
    # The backup API includes committed WAL records, unlike copying the DB alone.
    for extra in [db, Path(str(db) + '-wal'), Path(str(db) + '-shm')]:
        extra.unlink(missing_ok=True)
    with sqlite3.connect((source / '.agent-vault/agent-vault.db').as_uri() + '?mode=ro', uri=True) as src:
        with sqlite3.connect(db) as dst:
            src.backup(dst)
    for path in [destination, *destination.rglob('*')]:
        if path.is_symlink():
            raise RuntimeError('source_symlink')
        path.chmod(0o700 if path.is_dir() else 0o600)

def install(source, binary):
    if ROOT.exists() or PLIST.exists():
        raise RuntimeError('already_installed_do_not_overwrite')
    if listening(18431) or listening(18432):
        raise RuntimeError('runtime_port_in_use')
    private(source, True)
    master = source / 'dummy-master-password'
    private(master)
    if hashlib.sha256(binary.read_bytes()).hexdigest() != EXPECTED_SHA:
        raise RuntimeError('binary_revision_mismatch')
    before = inventory(source / '.agent-vault/agent-vault.db')
    if not before['database_ok'] or before['import_fields'] != 506:
        raise RuntimeError('source_inventory_mismatch')
    ROOT.mkdir(mode=0o700, parents=True)
    for name in ['bin', 'keys', 'backups']:
        (ROOT / name).mkdir(mode=0o700)
    backup = ROOT / 'backups' / time.strftime('pre-install-%Y%m%dT%H%M%S')
    snapshot(source, backup)
    snapshot(backup, ROOT / 'runtime')
    after = inventory(ROOT / 'runtime/.agent-vault/agent-vault.db')
    if after != before:
        raise RuntimeError('snapshot_inventory_mismatch')
    shutil.copyfile(master, ROOT / 'keys/master-password')
    (ROOT / 'keys/master-password').chmod(0o600)
    shutil.copyfile(binary, ROOT / 'bin/agent-vault')
    (ROOT / 'bin/agent-vault').chmod(0o700)
    shutil.copyfile(Path(__file__).resolve(), ROOT / 'bin/manage.py')
    (ROOT / 'bin/manage.py').chmod(0o700)
    save(CONFIG, {'version': 1, 'root': str(ROOT), 'apiPort': 18431, 'proxyPort': 18432,
                  'binarySha256': EXPECTED_SHA, 'originalState': str(source), 'snapshot': str(backup)})
    PLIST.parent.mkdir(exist_ok=True)
    data = {'Label': LABEL, 'ProgramArguments': [sys.executable, str(ROOT / 'bin/manage.py'), 'run'],
            'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 10,
            'ProcessType': 'Background', 'StandardOutPath': '/dev/null', 'StandardErrorPath': '/dev/null',
            'WorkingDirectory': str(ROOT), 'Umask': 0o077}
    with PLIST.open('wb') as f:
        plistlib.dump(data, f)
    PLIST.chmod(0o600)
    save(ROOT / 'install-receipt.json', {'installed': True, 'original_preserved': True,
         'consistent_snapshot': True, **after, 'binary_sha256': EXPECTED_SHA})
    return {'installed': True, 'original_preserved': True, **after}

def run():
    private(ROOT, True)
    private(CONFIG)
    config = json.loads(CONFIG.read_text())
    binary = ROOT / 'bin/agent-vault'
    if config.get('root') != str(ROOT) or hashlib.sha256(binary.read_bytes()).hexdigest() != EXPECTED_SHA:
        raise RuntimeError('runtime_identity_mismatch')
    master = ROOT / 'keys/master-password'
    private(master)
    private(master.parent, True)
    env = {k: v for k, v in os.environ.items() if k in ['HOME', 'PATH', 'LANG', 'USER', 'LOGNAME', 'TMPDIR']}
    env.update(AGENT_VAULT_EVAL_HOME=str(ROOT / 'runtime'), AGENT_VAULT_TELEMETRY='false',
               AGENT_VAULT_ADDR='https://osiris.tailf4bdfc.ts.net:18443')
    fd = os.open(master, os.O_RDONLY | os.O_NOFOLLOW)
    os.dup2(fd, 0)
    os.close(fd)
    os.execve(binary, [str(binary), 'server', '--host', '127.0.0.1', '--port', '18431',
                      '--mitm-port', '18432', '--password-stdin'], env)

def launch(action):
    private(CONFIG)
    private(PLIST)
    domain = 'gui/' + str(os.getuid())
    target = domain + '/' + LABEL
    command = {'start': ['bootstrap', domain, str(PLIST)], 'restart': ['kickstart', '-k', target],
               'stop': ['bootout', target]}[action]
    p = subprocess.run(['/bin/launchctl', *command], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if p.returncode:
        raise RuntimeError('launchctl_' + action + '_failed')
    return {'action': action, 'accepted': True}

def status():
    result = {'installed': CONFIG.exists(), 'managed': False, 'ready': False}
    if not CONFIG.exists():
        return result
    p = subprocess.run(['/bin/launchctl', 'print', 'gui/' + str(os.getuid()) + '/' + LABEL],
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    result['managed'] = p.returncode == 0
    result['running'] = p.returncode == 0 and 'state = running' in p.stdout
    try:
        req = urllib.request.Request('http://127.0.0.1:18431/health')
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=3) as r:
            result['ready'] = r.status == 200
    except Exception:
        pass
    result.update(inventory(ROOT / 'runtime/.agent-vault/agent-vault.db'))
    return result

def main():
    os.umask(0o077)
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['install', 'start', 'restart', 'stop', 'status', 'run'])
    p.add_argument('--source-state', type=Path)
    p.add_argument('--source-binary', type=Path)
    a = p.parse_args()
    try:
        if a.action == 'run':
            run()
            return 0
        if a.action == 'install':
            value = install(a.source_state.resolve(), a.source_binary.resolve())
        elif a.action == 'status':
            value = status()
        else:
            value = launch(a.action)
        print(json.dumps(value))
        return 0
    except Exception as e:
        codes = {'already_installed_do_not_overwrite', 'runtime_port_in_use', 'source_inventory_mismatch',
                 'snapshot_inventory_mismatch', 'binary_revision_mismatch', 'unsafe_private_file',
                 'launchctl_start_failed', 'launchctl_stop_failed', 'launchctl_restart_failed'}
        print(json.dumps({'ok': False, 'reasonCode': str(e) if str(e) in codes else 'runtime_operation_failed'}))
        return 1

if __name__ == '__main__':
    sys.exit(main())
