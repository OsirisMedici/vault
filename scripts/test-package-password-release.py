#!/usr/bin/env python3
"""Synthetic archive/administrator handoff checks; never invokes Docker or sudo."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('password_package', ROOT / 'scripts/package-password-release.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTests(unittest.TestCase):
    def fixture(self, folder):
        candidate = Path(folder) / 'candidate'
        build = candidate / 'apps/web/build'
        (build / 'images').mkdir(parents=True)
        (build / 'locales/en').mkdir(parents=True)
        (build / 'index.html').write_text('<html><head><title page-title>Vault</title></head></html>')
        (build / 'manifest.json').write_text('{"name":"Synthetic fixture"}')
        (build / 'locales/en/messages.json').write_text(json.dumps({
            'vaultMasterPasswordLength': {'message': 'synthetic range'},
            'vaultShortMasterPasswordWarning': {'message': 'synthetic warning'},
        }))
        (build / 'app.js').write_text('/* Synthetic fixture: Agent access; Request sign-in */')
        (build / '3rdpartylicenses.txt').write_text('Synthetic attribution')
        (candidate / 'source.ts').write_text('public synthetic source')
        receipt = {'releaseBase': 'synthetic', 'filesSha256': {
            'source.ts': hashlib.sha256((candidate / 'source.ts').read_bytes()).hexdigest(),
        }}
        (candidate / 'vault-password-source-receipt.json').write_text(json.dumps(receipt))
        (candidate / 'vault-agent-web-tooling.json').write_text('{}')
        tag = 'vault-agent-' + hashlib.sha256(json.dumps({'agent': {}, 'password': receipt}, separators=(',', ':')).encode()).hexdigest()[:16]
        (candidate / 'vault-password-build-result.json').write_text(json.dumps({'success': True, 'compiler': '26.12.0', 'cacheTag': tag}))

        return candidate

    def test_archive_preserves_js_notices_and_produces_checked_root_script(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            candidate = self.fixture(folder)
            result = package.package(candidate)
            output = Path(result['archive']).parent
            try:
                with tarfile.open(result['archive']) as archive:
                    self.assertTrue(all(m.isfile() or m.isdir() for m in archive.getmembers()))
                    self.assertTrue(all(not Path(m.name).is_absolute() and '..' not in Path(m.name).parts for m in archive.getmembers()))
                    self.assertEqual(archive.extractfile('web/app.js').read(), (candidate / 'apps/web/build/app.js').read_bytes())
                    dockerfile = archive.extractfile('Dockerfile').read().decode()
                    self.assertNotIn('RUN ', dockerfile)
                    self.assertIn('FROM ' + package.EXPECTED_IMAGE, dockerfile)
                    self.assertEqual(archive.extractfile('web/3rdpartylicenses.txt').read(), b'Synthetic attribution')
                script = Path(result['administratorScript'])
                self.assertNotIn('@ARCHIVE', script.read_text())
                self.assertIn(result['archiveSha256'], script.read_text())
                self.assertIn('--network=none --pull=false', script.read_text())
                subprocess.run(['bash', '-n', str(script)], check=True)
                with self.assertRaisesRegex(ValueError, 'exists'):
                    package.package(candidate)
            finally:
                shutil.rmtree(output)

    def test_rejects_failed_or_stale_build_receipt(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            candidate = self.fixture(folder)
            (candidate / 'vault-password-build-result.json').write_text(json.dumps({'success': False}))
            with self.assertRaisesRegex(ValueError, 'successful build'):
                package.package(candidate)

    def test_rejects_changed_password_source(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            candidate = self.fixture(folder)
            (candidate / 'source.ts').write_text('changed')
            with self.assertRaisesRegex(ValueError, 'changed'):
                package.package(candidate)


if __name__ == '__main__':
    unittest.main()
