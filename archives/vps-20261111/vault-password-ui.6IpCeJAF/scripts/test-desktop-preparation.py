#!/usr/bin/env python3
"""Exercise preparation guardrails without touching installed apps or private data."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_desktop', Path(__file__).with_name('prepare-desktop.py'))
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


class PreparationGuards(unittest.TestCase):
    def test_refuses_output_outside_cache(self):
        with self.assertRaisesRegex(ValueError, 'inside'):
            prep.prepare(prep.ROOT / 'upstream/desktop')

    def test_refuses_existing_output_without_changes(self):
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            sentinel = Path(folder) / 'preserve.txt'
            sentinel.write_text('preserve')
            with self.assertRaisesRegex(ValueError, 'already exists'):
                prep.prepare(Path(folder))
            self.assertEqual(sentinel.read_text(), 'preserve')

    def test_refuses_wrong_pin_before_creating_output(self):
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'run', return_value='wrong-commit'):
                with self.assertRaisesRegex(ValueError, 'lock'):
                    prep.prepare(output)
            self.assertFalse(output.exists())

    def test_refuses_dirty_source_before_creating_output(self):
        pin = prep.run('git', 'rev-parse', 'HEAD', cwd=prep.SOURCE)
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'run', side_effect=[pin, ' M source.ts']):
                with self.assertRaisesRegex(ValueError, 'clean'):
                    prep.prepare(output)
            self.assertFalse(output.exists())

    def test_refuses_unexpected_remote(self):
        pin = prep.run('git', 'rev-parse', 'HEAD', cwd=prep.SOURCE)
        with tempfile.TemporaryDirectory(dir=prep.ROOT / '.cache') as folder:
            output = Path(folder) / 'candidate'
            with patch.object(prep, 'run', side_effect=[pin, '', 'https://example.invalid/other.git']):
                with self.assertRaisesRegex(ValueError, 'remote'):
                    prep.prepare(output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
