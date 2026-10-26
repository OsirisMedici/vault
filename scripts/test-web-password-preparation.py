#!/usr/bin/env python3
"""Verify password integration preserves the exact deployed Agent access source layer."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('password_source', ROOT / 'scripts/prepare-web-password.py')
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


class PreparationTests(unittest.TestCase):
    def test_rejects_output_outside_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                prep.prepare(Path(folder) / 'candidate')

    def test_preserves_existing_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            sentinel = Path(folder) / 'preserve-me'
            sentinel.write_text('existing development work')
            with self.assertRaises(ValueError):
                prep.prepare(Path(folder))
            self.assertEqual(sentinel.read_text(), 'existing development work')

    def test_preserves_all_deployed_features_except_reviewed_password_changes(self):
        expected = {line[6:] for line in prep.PASSWORD_PATCH.read_text().splitlines() if line.startswith('+++ b/')}
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            base, changed = Path(folder) / 'base', Path(folder) / 'password'
            prep.tooling.prepare(prep.SOURCE, base)
            prep.prepare(changed)
            original = {p.relative_to(base).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in base.rglob('*') if p.is_file()}
            actual = {p.relative_to(changed).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in changed.rglob('*') if p.is_file()}
            self.assertEqual({name for name, digest in original.items() if actual.get(name) != digest}, expected & original.keys())
            self.assertEqual(actual.keys() - original.keys(), expected - original.keys() | {'vault-password-source-receipt.json'})


if __name__ == '__main__':
    unittest.main()
