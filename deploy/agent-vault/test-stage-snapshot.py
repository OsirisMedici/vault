#!/usr/bin/env python3
"""One synthetic offline migration case. No engine, network or real state."""
import base64
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest


class SyntheticMigration(unittest.TestCase):
    def test_preserved_import_and_exclusive_destination(self):
        os.umask(0o077)
        with tempfile.TemporaryDirectory(prefix='vault-offline-fixture-') as temporary:
            # macOS /var and /tmp aliases must not be mistaken for snapshot symlinks.
            root = Path(temporary).resolve()
            snapshot = root / 'snapshot'
            state = snapshot / 'runtime/.agent-vault'
            (state / 'ca').mkdir(parents=True, mode=0o700)
            (snapshot / 'keys').mkdir(mode=0o700)
            (snapshot / 'keys/master-password').write_bytes(base64.b64encode(os.urandom(48)) + b'\n')
            # Deliberately synthetic bytes, never used to unlock or run an engine.
            for name in ('ca.crt.pem', 'ca.key.enc'):
                (state / 'ca' / name).write_bytes(os.urandom(128))
            # Match the actual recovery helper's full snapshot contract. Mac
            # helpers/enrollment sidecars must be accepted but excluded from Linux.
            (snapshot / 'bin').mkdir(mode=0o700)
            excluded = ('bin/agent-vault', 'bin/manage.py', 'runtime.json',
                        'runtime/control.json', 'runtime/owner-login.json')
            for name in excluded:
                path = snapshot / name
                path.write_bytes(b'synthetic excluded recovery file\n')
                if name.startswith('bin/'):
                    path.chmod(0o700)
            db_path = state / 'agent-vault.db'
            with sqlite3.connect(db_path) as db:
                db.executescript('''
                    CREATE TABLE master_key (id INTEGER PRIMARY KEY, sentinel BLOB,
                        sentinel_nonce BLOB, dek_ciphertext BLOB, dek_nonce BLOB,
                        dek_plaintext BLOB, salt BLOB, kdf_time INTEGER,
                        kdf_memory INTEGER, kdf_threads INTEGER);
                    INSERT INTO master_key VALUES (1, randomblob(48), randomblob(12),
                        randomblob(48), randomblob(12), NULL, randomblob(16), 3, 65536, 4);
                    CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT);
                    INSERT INTO users VALUES ('synthetic-owner', 'owner');
                    CREATE TABLE vaults (id TEXT PRIMARY KEY, name TEXT UNIQUE);
                    INSERT INTO vaults VALUES ('import', 'synthetic-import');
                    INSERT INTO vaults VALUES ('older', 'synthetic-older');
                    CREATE TABLE credentials (id INTEGER PRIMARY KEY,
                        vault_id TEXT REFERENCES vaults(id), key TEXT,
                        ciphertext BLOB, nonce BLOB);
                ''')
                for account in range(253):
                    for field in ('USERNAME', 'PASSWORD'):
                        db.execute('INSERT INTO credentials (vault_id,key,ciphertext,nonce) '
                                   'VALUES (?,?,randomblob(48),randomblob(12))',
                                   ('import', f'VW_{account:032X}_{field}'))
                for field in range(13):
                    db.execute('INSERT INTO credentials (vault_id,key,ciphertext,nonce) '
                               'VALUES (?,?,randomblob(48),randomblob(12))', ('older', f'TRIAL_{field}'))
            source_bytes = {p.relative_to(snapshot): hashlib.sha256(p.read_bytes()).digest()
                            for p in snapshot.rglob('*') if p.is_file()}
            destination = root / 'staged'
            command = [sys.executable, str(Path(__file__).with_name('stage-snapshot.py')),
                       '--snapshot', str(snapshot), '--destination', str(destination),
                       '--ownership', 'current-user', '--import-vault', 'synthetic-import',
                       '--expected-accounts', '253', '--expected-import-fields', '506',
                       '--expected-total-fields', '519']
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, 'synthetic staging failed')
            self.assertEqual(result.stderr, '')
            receipt = json.loads(result.stdout)
            self.assertEqual((receipt['accounts'], receipt['import_fields'], receipt['total_fields']),
                             (253, 506, 519))
            self.assertTrue(receipt['byte_preserved'])
            self.assertFalse(receipt['unlocked'])
            for relative, digest in source_bytes.items():
                if relative.as_posix() in excluded:
                    self.assertEqual(hashlib.sha256((snapshot / relative).read_bytes()).digest(), digest)
                    continue
                target = destination / ('private/master-password' if relative.parts[0] == 'keys'
                                        else str(Path('data') / relative.relative_to('runtime')))
                self.assertEqual(hashlib.sha256(target.read_bytes()).digest(), digest)
                self.assertEqual(hashlib.sha256((snapshot / relative).read_bytes()).digest(), digest)
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
                self.assertEqual(target.stat().st_uid, os.geteuid())
                self.assertEqual(target.stat().st_gid, os.getegid())
            self.assertFalse((destination / 'data/control.json').exists())
            self.assertFalse((destination / 'data/owner-login.json').exists())
            self.assertFalse((destination / 'bin').exists())
            self.assertFalse((destination / 'runtime.json').exists())
            for path in destination.rglob('*'):
                if path.is_dir():
                    self.assertEqual(path.stat().st_mode & 0o777, 0o700)
            self.assertEqual((destination / 'data/.vault-companion-staged').read_text(),
                             'offline-check-only\n')
            # Same fixture, same destination. A retry must preserve the first copy.
            retry = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(retry.returncode, 1)
            self.assertEqual(json.loads(retry.stdout)['reasonCode'], 'destination_must_not_exist')
            self.assertEqual(hashlib.sha256((destination / 'data/.agent-vault/agent-vault.db').read_bytes()).digest(),
                             source_bytes[Path('runtime/.agent-vault/agent-vault.db')])


if __name__ == '__main__':
    unittest.main()
