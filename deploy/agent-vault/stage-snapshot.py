#!/usr/bin/env python3
"""Offline copy of a recovery snapshot into a NEW companion destination.

Never invokes the engine, changes the source, generates keys or decrypts fields.
Only aggregate checks and fixed reason codes may reach stdout/stderr.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import sqlite3
import stat
import sys

UID = GID = 65532
DB = Path('runtime/.agent-vault/agent-vault.db')
MASTER = Path('keys/master-password')
REQUIRED = (DB, MASTER, Path('runtime/.agent-vault/ca/ca.crt.pem'),
            Path('runtime/.agent-vault/ca/ca.key.enc'))


class Refused(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Refused(code)


def no_symlink_ancestors(path):
    for part in (*reversed(path.parents), path):
        require(not part.is_symlink(), 'symlink_refused')


def entries(root):
    """Walk without following symlinks. Require one owner, private, unlinked files."""
    owner = root.lstat().st_uid
    require(owner in {os.geteuid(), int(os.environ.get('SUDO_UID', os.geteuid()))},
            'snapshot_owner_mismatch')
    found = {}

    def walk(path):
        info = path.lstat()
        directory = stat.S_ISDIR(info.st_mode)
        require(directory or stat.S_ISREG(info.st_mode), 'unsafe_snapshot_entry')
        require(info.st_uid == owner, 'snapshot_owner_mismatch')
        require(stat.S_IMODE(info.st_mode) == (0o700 if directory else 0o600),
                'private_permissions_required')
        require(directory or info.st_nlink == 1, 'hardlink_refused')
        found[path.relative_to(root)] = info
        if directory:
            for child in sorted(path.iterdir()):
                walk(child)

    walk(root)
    return found


def digest(path):
    value = hashlib.sha256()
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.digest()


def identities(found):
    # Reading changes atime on some filesystems. It is not a source mutation.
    return {p: (s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_gid, s.st_nlink,
                s.st_size, s.st_mtime_ns, s.st_ctime_ns) for p, s in found.items()}


def inventory(path, expected):
    # immutable avoids SQLite creating WAL/SHM files or acquiring writable state.
    # Sidecars are refused separately. The parent must create a closed backup.
    with sqlite3.connect(path.as_uri() + '?mode=ro&immutable=1', uri=True) as db:
        db.execute('PRAGMA query_only=ON')
        require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)],
                'database_integrity_failed')
        require(not db.execute('PRAGMA foreign_key_check').fetchall(),
                'database_foreign_keys_failed')
        # Fetch booleans/lengths only, never key or credential values.
        require(db.execute('SELECT COUNT(*) FROM master_key').fetchone()[0] == 1,
                'existing_wrapped_master_required')
        wrapped = db.execute('''SELECT COUNT(*) FROM master_key WHERE id=1
            AND length(sentinel)>0 AND length(sentinel_nonce)=12
            AND length(dek_ciphertext)=48 AND length(dek_nonce)=12
            AND dek_plaintext IS NULL AND length(salt)>=16
            AND kdf_time>0 AND kdf_memory>0 AND kdf_threads>0''').fetchone()[0]
        require(wrapped == 1, 'existing_wrapped_master_required')
        require(db.execute("SELECT COUNT(*) FROM users WHERE role='owner'").fetchone()[0] > 0,
                'existing_owner_required')
        total = db.execute('SELECT COUNT(*) FROM credentials').fetchone()[0]
        vaults = db.execute('SELECT id FROM vaults WHERE name=?', (expected['vault'],)).fetchall()
        require(len(vaults) == 1, 'import_vault_required')
        keys = [row[0] for row in db.execute(
            'SELECT key FROM credentials WHERE vault_id=?', (vaults[0][0],))]
        # Only inspect imported opaque key names, never their values or metadata.
        pairs = {}
        for key in keys:
            match = re.fullmatch(r'(VW_(?:[A-F0-9]{32}|[A-F0-9]{64}))_(USERNAME|PASSWORD)', key)
            require(match is not None, 'import_pair_mismatch')
            pairs.setdefault(match[1], []).append(match[2])
        require(all(sorted(fields) == ['PASSWORD', 'USERNAME'] for fields in pairs.values()),
                'import_pair_mismatch')
        result = {'accounts': len(pairs), 'import_fields': len(keys), 'total_fields': total}
        require(all(result[name] == expected[name] for name in result), 'inventory_mismatch')
        return result


def stage(snapshot, destination, expected, ownership):
    snapshot = Path(os.path.abspath(snapshot))
    destination = Path(os.path.abspath(destination))
    no_symlink_ancestors(snapshot)
    no_symlink_ancestors(destination)
    require(destination != snapshot and snapshot not in destination.parents
            and destination not in snapshot.parents, 'overlapping_paths_refused')
    require(not destination.exists(), 'destination_must_not_exist')
    parent = destination.parent.lstat()
    require(stat.S_ISDIR(parent.st_mode) and not parent.st_mode & 0o022
            and parent.st_uid == os.geteuid(), 'unsafe_destination_parent')
    if ownership == 'linux-container':
        require(platform.system() == 'Linux' and os.geteuid() == 0, 'linux_root_required')
        uid, gid = UID, GID
    else:
        uid, gid = os.geteuid(), os.getegid()
    source = entries(snapshot)
    require({p.parts[0] for p in source if p.parts} == {'runtime', 'keys'},
            'snapshot_layout_mismatch')
    require({p for p in source if p.parent == Path('runtime')} == {Path('runtime/.agent-vault')}
            and {p for p in source if p.parent == Path('keys')} == {MASTER},
            'snapshot_layout_mismatch')
    for relative in REQUIRED:
        require(relative in source and stat.S_ISREG(source[relative].st_mode)
                and source[relative].st_size > 0, 'required_material_missing')
    for relative in source:
        require(not relative.name.endswith(('-wal', '-shm', '-journal')),
                'database_sidecar_refused')
    master = (snapshot / MASTER).read_bytes()
    require(0 < len(master) <= 4096 and b'\x00' not in master
            and b'\r' not in master and b'\n' not in master.rstrip(b'\n')
            and not master.endswith(b'\n\n') and bool(master.rstrip(b'\n')),
            'single_line_master_required')
    del master
    before = inventory(snapshot / DB, expected)
    hashes = {p: digest(snapshot / p) for p, info in source.items() if stat.S_ISREG(info.st_mode)}
    # mkdir is the exclusive reservation. Never accept even an existing empty dir.
    # On failure retain an incomplete private destination for manual inspection.
    destination.mkdir(mode=0o700)
    (destination / 'data').mkdir(mode=0o700)
    (destination / 'private').mkdir(mode=0o700)
    for relative, info in source.items():
        if not relative.parts or relative in (Path('runtime'), Path('keys')):
            continue
        target = destination / ('private/master-password' if relative == MASTER
                                else str(Path('data') / relative.relative_to('runtime')))
        if stat.S_ISDIR(info.st_mode):
            target.mkdir(mode=0o700)
        else:
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as output:
                source_fd = os.open(snapshot / relative, os.O_RDONLY | os.O_NOFOLLOW)
                with os.fdopen(source_fd, 'rb') as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b''):
                        output.write(block)
                output.flush()
                os.fsync(output.fileno())
            require(digest(target) == hashes[relative], 'copy_verification_failed')
    require(inventory(destination / 'data/.agent-vault/agent-vault.db', expected) == before,
            'copy_verification_failed')
    require(identities(entries(snapshot)) == identities(source)
            and all(digest(snapshot / p) == h for p, h in hashes.items()),
            'snapshot_changed')
    for path in (destination / 'data', *(destination / 'data').rglob('*'),
                 destination / 'private/master-password'):
        os.chown(path, uid, gid, follow_symlinks=False)
    # Root owns base/private. Compose binds the secret file directly, so the
    # container does not need traversal permission on the root-owned host dir.
    receipt = {'version': 1, 'staged': True, 'ownership': ownership, **before,
               'byte_preserved': True, 'unlocked': False, 'container_built': False}
    receipt_path = destination / 'staging-receipt.json'
    with receipt_path.open('x') as output:
        output.write(json.dumps(receipt) + '\n')
    receipt_path.chmod(0o600)
    # Last file is the launch gate. An interrupted/failed stage has no gate.
    marker = destination / 'data/.vault-companion-staged'
    with marker.open('x') as output:
        output.write('linux:65532:65532\n' if ownership == 'linux-container' else 'offline-check-only\n')
    marker.chmod(0o600)
    os.chown(marker, uid, gid, follow_symlinks=False)
    return receipt


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True, type=Path)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--ownership', choices=['linux-container', 'current-user'], default='linux-container')
    parser.add_argument('--import-vault', required=True)
    parser.add_argument('--expected-accounts', required=True, type=int)
    parser.add_argument('--expected-import-fields', required=True, type=int)
    parser.add_argument('--expected-total-fields', required=True, type=int)
    args = parser.parse_args()
    try:
        expected = {'vault': args.import_vault, 'accounts': args.expected_accounts,
                    'import_fields': args.expected_import_fields, 'total_fields': args.expected_total_fields}
        require(expected['accounts'] > 0 and expected['import_fields'] == 2 * expected['accounts']
                and expected['total_fields'] >= expected['import_fields'], 'invalid_expected_inventory')
        print(json.dumps(stage(args.snapshot, args.destination, expected, args.ownership)))
        return 0
    except Exception as error:
        print(json.dumps({'staged': False, 'reasonCode': str(error) if isinstance(error, Refused)
                          else 'offline_staging_failed'}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
