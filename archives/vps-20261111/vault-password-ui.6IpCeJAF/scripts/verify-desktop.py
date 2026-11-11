#!/usr/bin/env python3
"""Verify a prepared source candidate before dependency installation or packaging."""
import argparse
import importlib.util
import json
import re
import subprocess
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare_desktop', Path(__file__).with_name('prepare-desktop.py'))
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


def verify(candidate):
    candidate = candidate.resolve()
    pin = json.loads((prep.ROOT / 'upstream.lock.json').read_text())['desktop']
    assert prep.run('git', 'rev-parse', 'HEAD', cwd=prep.SOURCE) == pin['commit']
    assert not prep.run('git', 'status', '--porcelain', '--untracked-files=all', cwd=prep.SOURCE), 'Upstream is dirty'
    receipt = json.loads((candidate / 'vault-source-receipt.json').read_text())
    assert receipt['sourceCommit'] == pin['commit']
    assert receipt['sourcePatchSha256'] == prep.digest(prep.BRANDING / 'source.patch')
    assert receipt['packagingConfigSha256'] == prep.digest(prep.BRANDING / 'electron-builder.vault.json')
    assert receipt['installed'] is False and receipt['runtimeVerified'] is False

    tracked = set(prep.run('git', 'ls-files', cwd=prep.SOURCE).splitlines())
    patched = set(re.findall(r'^\+\+\+ b/(.+)$', (prep.BRANDING / 'source.patch').read_text(), re.M))
    locales = {p for p in tracked if re.fullmatch(r'apps/desktop/src/locales/[^/]+/messages.json', p)}
    logo = 'libs/assets/src/svg/svgs/password-manager.ts'
    images = {
        'apps/desktop/src/images/icon.png',
        'apps/desktop/src/images/icon_dev.png',
        'apps/desktop/src/images/icon-template.png',
        'apps/desktop/src/images/icon-template@2x.png',
    }
    changed = patched | locales | images | {logo}
    for path in sorted(tracked - changed):
        assert (candidate / path).read_bytes() == (prep.SOURCE / path).read_bytes(), f'Unexpected change: {path}'

    # Reverse only the reviewed patch in a temporary directory. Every byte must
    # then equal upstream, including code outside the visible patch context.
    with tempfile.TemporaryDirectory() as folder:
        reverse = Path(folder)
        for path in patched:
            target = reverse / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((candidate / path).read_bytes())
        subprocess.run(['git', 'apply', '--reverse', str(prep.BRANDING / 'source.patch')], cwd=reverse, check=True)
        for path in patched:
            assert (reverse / path).read_bytes() == (prep.SOURCE / path).read_bytes(), f'Unreviewed patch change: {path}'

    for path in locales:
        original = json.loads((prep.SOURCE / path).read_text())
        for key, label in [('bitwarden', 'Vault'), ('bitwardenBeta', 'Vault Preview')]:
            if key in original:
                original[key]['message'] = label
        assert json.loads((candidate / path).read_text()) == original, f'Unexpected locale change: {path}'
    expected_logo = ('import { svg } from "../svg";\n\nconst PasswordManagerLogo = svg`\n'
                     + (prep.ROOT / 'branding/wordmark.svg').read_text().strip()
                     + '\n`;\n\nexport default PasswordManagerLogo;\n')
    assert (candidate / logo).read_text() == expected_logo

    desktop = candidate / 'apps/desktop'
    copied = {
        'electron-builder.vault.json': prep.BRANDING / 'electron-builder.vault.json',
        'scripts/vault-after-pack.js': prep.BRANDING / 'vault-after-pack.js',
        'resources/entitlements.vault.plist': prep.BRANDING / 'entitlements.vault.plist',
        'resources/vault-notices/LICENSE.txt': prep.SOURCE / 'LICENSE.txt',
        'resources/vault-notices/LICENSE_GPL.txt': prep.SOURCE / 'LICENSE_GPL.txt',
        'resources/vault-notices/LICENSE_BITWARDEN.txt': prep.SOURCE / 'LICENSE_BITWARDEN.txt',
        'resources/vault-notices/VAULT_NOTICE.md': prep.ROOT / 'NOTICE.md',
        'resources/vault-notices/MODIFICATIONS.md': prep.BRANDING / 'MODIFICATIONS.md',
    }
    for target, source in copied.items():
        assert (desktop / target).read_bytes() == source.read_bytes(), f'Unexpected generated file: {target}'
    generated = {'apps/desktop/' + p for p in copied} | {
        'vault-source-receipt.json', 'apps/desktop/scripts/vault-candidate.json',
        'apps/desktop/resources/vault.icns',
    }
    actual = {p.relative_to(candidate).as_posix() for p in candidate.rglob('*') if p.is_file()}
    assert actual == tracked | generated, f'Unexpected/missing files: {sorted(actual ^ (tracked | generated))}'
    for path in images:
        assert (candidate / path).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    assert (desktop / 'resources/vault.icns').read_bytes().startswith(b'icns')

    config = json.loads((desktop / 'electron-builder.vault.json').read_text())
    assert config['extends'] is None and config['publish'] is None
    assert config['appId'] == 'com.osirismedici.vault' and config['productName'] == 'Vault'
    assert config['mac']['identity'] is None and config['mac']['hardenedRuntime'] is True
    assert 'afterSign' not in config and 'extraFiles' not in config
    assert 'LTZ2PFU5D6' not in json.dumps(config)
    # These exact security implementations must remain unchanged.
    for key, path in [
        ('biometricServiceSha256', 'src/key-management/biometrics/os-biometrics-mac.service.ts'),
        ('keychainImplementationSha256', 'desktop_native/core/src/password/macos.rs'),
    ]:
        assert receipt[key] == prep.digest(desktop / path)
    return {
        'sourceCommit': pin['commit'],
        'upstreamFilesChecked': len(tracked),
        'reviewedPatchFiles': len(patched),
        'productLabelLocales': len(locales),
        'biometricAndKeychainSourceUnchanged': True,
        'runtimeAndTouchIdAcceptance': 'pending',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.candidate), indent=2))
