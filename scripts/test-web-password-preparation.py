#!/usr/bin/env python3
"""Validate reproducible candidates and preservation of pinned source boundaries."""
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_web_password', ROOT / 'scripts/prepare-web-password.py')
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


class PreparationTests(unittest.TestCase):
    def test_rejects_output_outside_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, 'inside'):
                prep.prepare(Path(folder) / 'candidate')

    def test_preserves_existing_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            sentinel = Path(folder) / 'preserve-me'
            sentinel.write_text('existing development work')
            with self.assertRaisesRegex(ValueError, 'already exists'):
                prep.prepare(Path(folder))
            self.assertEqual(sentinel.read_text(), 'existing development work')

    def test_rejects_mismatched_pin(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'git', return_value='wrong-pin'):
                with self.assertRaisesRegex(ValueError, 'pinned commit'):
                    prep.prepare(output)
            self.assertFalse(output.exists())

    def test_rejects_dirty_upstream(self):
        pin = json.loads((ROOT / 'upstream.lock.json').read_text())['web']['commit']
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'git', side_effect=[pin, ' M source.ts']):
                with self.assertRaisesRegex(ValueError, 'must be clean'):
                    prep.prepare(output)
            self.assertFalse(output.exists())

    def test_only_reviewed_changes_and_reproducible_output(self):
        expected = set()
        for source_patch in prep.PATCHES:
            expected.update(line[6:] for line in source_patch.read_text().splitlines() if line.startswith('+++ b/'))
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            receipt = prep.prepare(output)
            pin = json.loads((ROOT / 'upstream.lock.json').read_text())['web']['commit']
            self.assertEqual(receipt['upstreamCommit'], pin)
            tracked = set(subprocess.check_output(
                ['git', 'ls-files', '-z'], cwd=prep.SOURCE,
            ).decode().rstrip('\0').split('\0'))
            actual = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
            self.assertEqual(actual - tracked, expected - tracked | {'bun.lock', 'vault-password-source-receipt.json'})
            changed = {p for p in tracked if (prep.SOURCE / p).read_bytes() != (output / p).read_bytes()}
            self.assertEqual(changed, expected & tracked)
            second_output = Path(folder) / 'second-candidate'
            self.assertEqual(prep.prepare(second_output), receipt)
            for relative in expected | {'bun.lock', 'vault-password-source-receipt.json'}:
                self.assertEqual((output / relative).read_bytes(), (second_output / relative).read_bytes())
            self.assertEqual(prep.git('status', '--porcelain', '--untracked-files=all'), '')


if __name__ == '__main__':
    unittest.main()
