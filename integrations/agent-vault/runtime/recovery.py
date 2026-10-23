#!/usr/bin/env python3
"""Create and check private local Agent Vault snapshots without running the engine."""

import argparse
from contextlib import closing
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import sys
import time

ROOT = Path.home() / '.local/share/osiris-agent-vault/engine'
BACKUPS = ROOT / 'backups'
BINARY_SHA = '346465d4cc8526100c1bc859199aeaa36aea386b20a51b0ac67346b01f0902c6'
VAULT = 'bitwarden-import-20261022'
DATABASE = 'runtime/.agent-vault/agent-vault.db'
DIRECTORIES = ('bin', 'keys', 'runtime', 'runtime/.agent-vault', 'runtime/.agent-vault/ca')
FILES = {
    'bin/agent-vault': 0o700,
    'bin/manage.py': 0o700,
    'keys/master-password': 0o600,
    'runtime.json': 0o600,
    'runtime/control.json': 0o600,
    'runtime/owner-login.json': 0o600,
    'runtime/.agent-vault/ca/ca.crt.pem': 0o600,
    'runtime/.agent-vault/ca/ca.key.enc': 0o600,
    DATABASE: 0o600,
}
DEADLINE = 0


class Refuse(Exception):
    """Fixed public reason only. Never wrap a native exception's text."""


def require(ok, reason):
    if not ok:
        raise Refuse(reason)


def tick():
    require(time.monotonic() < DEADLINE, 'time_limit_exceeded')


def ancestors(path):
    # Do not resolve first: resolving would hide symlinks in the supplied path.
    for item in [*reversed(path.parents), path]:
        info = item.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid in (0, os.getuid())
                and not info.st_mode & 0o022, 'unsafe_ancestor')


def private_dir(path):
    ancestors(path)
    info = path.lstat()
    require(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700,
            'unsafe_private_directory')


def file_info(path, mode):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid()
            and stat.S_IMODE(info.st_mode) == mode and info.st_nlink == 1,
            'unsafe_private_file')
    limit = 512 * 1024 * 1024 if path.name == 'agent-vault.db' else 128 * 1024 * 1024
    minimum = 0 if path.name.endswith(('-wal', '-shm')) else 1
    require(minimum <= info.st_size <= limit, 'file_size_out_of_bounds')
    return info


def open_read(path, mode):
    ancestors(path.parent)
    before = file_info(path, mode)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        after = os.fstat(fd)
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'source_changed')
        return os.fdopen(fd, 'rb')
    except BaseException:
        os.close(fd)
        raise


def fingerprint(path, mode):
    value = hashlib.sha256()
    with open_read(path, mode) as source:
        initial = os.fstat(source.fileno())
        copied = 0
        while True:
            tick()
            block = source.read(1024 * 1024)
            if not block:
                break
            copied += len(block)
            require(copied <= initial.st_size, 'source_changed')
            value.update(block)
        after = os.fstat(source.fileno())
        require(copied == initial.st_size and initial.st_mtime_ns == after.st_mtime_ns,
                'source_changed')
    return value.digest()  # In memory only; secret-file hashes are never stored or printed.


def copy_file(source, target, mode):
    tick()
    private_dir(target.parent)
    with open_read(source, mode) as reader:
        initial = os.fstat(reader.fileno())
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
        with os.fdopen(fd, 'wb') as writer:
            copied = 0
            while True:
                tick()
                block = reader.read(1024 * 1024)
                if not block:
                    break
                copied += len(block)
                require(copied <= initial.st_size, 'source_changed')
                writer.write(block)
            writer.flush()
            os.fsync(writer.fileno())
        require(copied == initial.st_size
                and os.fstat(reader.fileno()).st_mtime_ns == initial.st_mtime_ns, 'source_changed')


def child_path(raw):
    path = Path(raw)
    require(path.is_absolute() and '..' not in path.parts, 'absolute_private_path_required')
    # Only existing, owner-only local backup storage is supported, never a checkout.
    require(path != BACKUPS and path.is_relative_to(BACKUPS), 'outside_private_backup_root')
    private_dir(BACKUPS)
    for item in path.parent.relative_to(BACKUPS).parts:
        require(item not in ('', '.', '..'), 'unsafe_destination')
    for parent in path.parents:
        if parent == BACKUPS or parent.is_relative_to(BACKUPS):
            private_dir(parent)
    return path


def new_dir(path):
    private_dir(path.parent)
    # mkdir is exclusive, including when an existing path is a dangling symlink.
    try:
        path.mkdir(mode=0o700)
    except FileExistsError:
        raise Refuse('destination_exists') from None
    private_dir(path)


def new_tree(path):
    new_dir(path)
    for name in DIRECTORIES:
        new_dir(path / name)


def check_tree(path, exact):
    private_dir(path)
    for name in DIRECTORIES:
        private_dir(path / name)
    for name, mode in FILES.items():
        file_info(path / name, mode)
    if exact:
        expected = set(DIRECTORIES) | set(FILES)
        found = set()
        # Never traverse a symlink, even if an unexpected entry is introduced.
        for directory, dirs, files in os.walk(path, followlinks=False):
            tick()
            require(len(dirs) + len(files) <= 32, 'snapshot_scope_mismatch')
            for name in dirs + files:
                entry = Path(directory) / name
                relative = entry.relative_to(path).as_posix()
                require(relative in expected and not entry.is_symlink(), 'snapshot_scope_mismatch')
                found.add(relative)
        require(found == expected, 'snapshot_scope_mismatch')


def read_database(path, offline=False):
    file_info(path, 0o600)
    connection = sqlite3.connect(path.as_uri() + '?mode=ro' + ('&immutable=1' if offline else ''),
                                 uri=True, timeout=3)
    connection.execute('PRAGMA query_only=ON')
    connection.set_progress_handler(lambda: int(time.monotonic() >= DEADLINE), 1000)
    return connection


def inventory(connection):
    require(connection.execute('PRAGMA quick_check').fetchall() == [('ok',)], 'database_check_failed')
    vault = connection.execute('SELECT id FROM vaults WHERE name=?', (VAULT,)).fetchall()
    require(len(vault) == 1, 'import_inventory_mismatch')
    rows = connection.execute('SELECT key FROM credentials WHERE vault_id=?', (vault[0][0],)).fetchall()
    require(len(rows) == 506, 'import_inventory_mismatch')
    pairs = {}
    for (key,) in rows:
        match = re.fullmatch(r'VW_([0-9A-F]{32}|[0-9A-F]{64})_(USERNAME|PASSWORD)', key)
        require(match is not None, 'import_inventory_mismatch')
        pairs.setdefault(match[1], []).append(match[2])
    total = connection.execute('SELECT COUNT(*) FROM credentials').fetchone()[0]
    require(len(pairs) == 253 and all(sorted(pair) == ['PASSWORD', 'USERNAME'] for pair in pairs.values())
            and total == 519, 'import_inventory_mismatch')
    return {'database_ok': True, 'imported_accounts': len(pairs), 'imported_fields': len(rows),
            'total_fields': total}


def unlock_record(connection):
    rows = connection.execute('SELECT * FROM master_key').fetchall()
    wrapped = connection.execute('SELECT sentinel,sentinel_nonce,dek_ciphertext,dek_nonce,dek_plaintext,salt '
                                 'FROM master_key WHERE id=1').fetchone()
    require(len(rows) == 1 and wrapped is not None
            and all(wrapped[i] for i in (0, 1, 2, 3, 5)) and not wrapped[4], 'unlock_material_missing')
    # All DB-held CA state is preserved too, including the current empty table.
    return rows, connection.execute('SELECT * FROM ca_state ORDER BY id').fetchall()


def identity(path):
    binary = fingerprint(path / 'bin/agent-vault', 0o700)
    require(hmac.compare_digest(binary, bytes.fromhex(BINARY_SHA)), 'binary_identity_mismatch')
    with open_read(path / 'runtime.json', 0o600) as stream:
        require(os.fstat(stream.fileno()).st_size <= 16384, 'runtime_configuration_mismatch')
        config = json.load(stream)
    require(config.get('root') == str(ROOT) and config.get('binarySha256') == BINARY_SHA
            and config.get('apiPort') == 18431 and config.get('proxyPort') == 18432,
            'runtime_configuration_mismatch')


def compare_files(source, target, include_db=True):
    for name, mode in FILES.items():
        if name == DATABASE and not include_db:
            continue
        require(hmac.compare_digest(fingerprint(source / name, mode), fingerprint(target / name, mode)),
                'required_file_equality_failed')


def write_receipt(path, result):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(result, stream, sort_keys=True)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())


def verify(snapshot, copied):
    check_tree(snapshot, exact=True)
    identity(snapshot)
    with closing(read_database(snapshot / DATABASE, offline=True)) as db:
        counts = inventory(db)
        wrapping = unlock_record(db)
    new_tree(copied)
    for name, mode in FILES.items():
        copy_file(snapshot / name, copied / name, mode)
    check_tree(copied, exact=True)
    identity(copied)
    compare_files(snapshot, copied)
    with closing(read_database(copied / DATABASE, offline=True)) as db:
        require(inventory(db) == counts, 'copied_inventory_mismatch')
        require(unlock_record(db) == wrapping, 'unlock_material_equality_failed')
    return {'ok': True, 'offline_copy_verified': True, 'binary_identity_ok': True,
            'required_files_equal': True, 'unlock_material_equal': True,
            'decryption_tested': False, 'service_restore_tested': False,
            'off_host_recovery_tested': False, **counts}


def create(destination):
    check_tree(ROOT, exact=False)
    # Check required ancestors/sidecars before SQLite gets the live read-only handle.
    for suffix in ('-wal', '-shm'):
        sidecar = Path(str(ROOT / DATABASE) + suffix)
        if sidecar.exists() or sidecar.is_symlink():
            file_info(sidecar, 0o600)
    identity(ROOT)
    baseline = {name: fingerprint(ROOT / name, mode) for name, mode in FILES.items() if name != DATABASE}
    new_dir(destination)
    snapshot = destination / 'snapshot'
    new_tree(snapshot)
    for name, mode in FILES.items():
        if name != DATABASE:
            copy_file(ROOT / name, snapshot / name, mode)
    target = snapshot / DATABASE
    # Reserve the DB exclusively before opening it with SQLite. No copied WAL/SHM/PID.
    os.close(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600))
    with closing(read_database(ROOT / DATABASE)) as source:
        source.execute('BEGIN')  # Counts, wrapping and backup share one SQLite read snapshot.
        before = inventory(source)
        wrapping = unlock_record(source)
        with closing(sqlite3.connect(target, timeout=3)) as output:
            source.backup(output, pages=256, progress=lambda *_: tick(), sleep=0.02)
            output.execute('PRAGMA journal_mode=DELETE')
        source.rollback()
    for name, value in baseline.items():
        require(hmac.compare_digest(value, fingerprint(ROOT / name, FILES[name])), 'source_changed')
    compare_files(ROOT, snapshot, include_db=False)
    with closing(read_database(snapshot / DATABASE, offline=True)) as db:
        require(inventory(db) == before, 'snapshot_inventory_mismatch')
        require(unlock_record(db) == wrapping, 'unlock_material_equality_failed')
    # The live DB can receive requests while the copy is checked. Recheck key/CA
    # wrapping only, not changing session or request-log rows.
    with closing(read_database(ROOT / DATABASE)) as db:
        require(unlock_record(db) == wrapping, 'source_changed')
    result = verify(snapshot, destination / 'verification-copy')
    result['consistent_sqlite_backup'] = True
    write_receipt(destination / 'receipt.json', result)
    # Flush newly created directory entries, including the completed receipt.
    for tree in (snapshot, destination / 'verification-copy'):
        for name in (*reversed(DIRECTORIES), ''):
            fd = os.open(tree / name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    for directory in (destination, destination.parent):
        fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    return result


def main():
    global DEADLINE
    os.umask(0o077)
    DEADLINE = time.monotonic() + 120
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    backup = commands.add_parser('create', help='Create a new snapshot and a separate verified offline copy')
    backup.add_argument('--destination', required=True)
    check = commands.add_parser('verify', help='Check an existing snapshot through a new offline copy')
    check.add_argument('--snapshot', required=True)
    check.add_argument('--copy-to', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'create':
            result = create(child_path(args.destination))
        else:
            snapshot = child_path(args.snapshot)
            copied = child_path(args.copy_to)
            require(not copied.is_relative_to(snapshot) and not snapshot.is_relative_to(copied),
                    'overlapping_paths')
            result = verify(snapshot, copied)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (Exception, KeyboardInterrupt) as error:
        # Partial private output is retained for owner review, never recursively deleted.
        reason = str(error) if isinstance(error, Refuse) else 'recovery_operation_failed'
        print(json.dumps({'ok': False, 'reasonCode': reason}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
