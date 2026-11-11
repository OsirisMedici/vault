#!/usr/bin/env python3
"""Check candidate isolation and refusal conditions without private data."""
import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_web', Path(__file__).with_name('prepare-web.py'))
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


class WebPreparationGuards(unittest.TestCase):
    def setUp(self):
        (prep.ROOT / '.cache').mkdir(exist_ok=True)

    def test_refuses_output_outside_cache(self):
        with self.assertRaisesRegex(ValueError, 'inside'):
            prep.prepare(prep.SOURCE)

    def test_preserves_existing_output(self):
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            sentinel = Path(folder) / 'keep.txt'
            sentinel.write_text('preserve')
            with self.assertRaisesRegex(ValueError, 'already exists'):
                prep.prepare(Path(folder))
            self.assertEqual(sentinel.read_text(), 'preserve')

    def test_refuses_wrong_pin(self):
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'run', return_value='wrong'):
                with self.assertRaisesRegex(ValueError, 'lock'):
                    prep.prepare(output)
            self.assertFalse(output.exists())

    def test_refuses_dirty_upstream(self):
        pin = prep.run('git', 'rev-parse', 'HEAD')
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'run', side_effect=[pin, ' M source.ts']):
                with self.assertRaisesRegex(ValueError, 'clean'):
                    prep.prepare(output)
            self.assertFalse(output.exists())

    def test_refuses_another_remote(self):
        pin = prep.run('git', 'rev-parse', 'HEAD')
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'run', side_effect=[pin, '', 'https://example.invalid/other']):
                with self.assertRaisesRegex(ValueError, 'remote'):
                    prep.prepare(output)
            self.assertFalse(output.exists())

    def test_exports_patched_candidate_without_modifying_upstream(self):
        before = prep.run('git', 'status', '--porcelain', '--untracked-files=all')
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            receipt = prep.prepare(output)
            utils = (output / 'libs/common/src/platform/misc/utils.ts').read_text()
            self.assertIn('originalMinimumPasswordLength = 1;', utils)
            self.assertIn('minimumPasswordLength = 1;', utils)
            self.assertNotIn('minimumPasswordLength = 12;', utils)
            row = (output / 'apps/web/src/app/vault/components/vault-items/vault-cipher-row.component.html').read_text()
            self.assertIn('appCopyField="usernameAndPassword"', row)
            self.assertIn('appCopyField="username"', row)
            self.assertIn('appCopyField="password"', row)
            self.assertIn('patches/web-login-row-copy.patch', receipt['patches'])
            self.assertFalse((output / '.git').exists())
            self.assertTrue((output / 'LICENSE_GPL.txt').is_file())
            self.assertEqual(json.loads((output / 'vault-source-receipt.json').read_text()), receipt)
            for name, expected in receipt['tests'].items():
                target = 'input-password' if name.startswith('input') else 'login'
                actual = output / 'libs/auth/src/angular' / target / name
                self.assertEqual(hashlib.sha256(actual.read_bytes()).hexdigest(), expected)
        self.assertEqual(prep.run('git', 'status', '--porcelain', '--untracked-files=all'), before)


if __name__ == '__main__':
    unittest.main()
