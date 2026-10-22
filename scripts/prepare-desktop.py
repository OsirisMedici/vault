#!/usr/bin/env python3
"""Prepare an isolated Vault desktop source candidate; never install or launch it."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'upstream/desktop'
BRANDING = ROOT / 'branding/desktop'


def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def desktop_theme_css():
    # Reuse the selected web palette. Desktop logos are real SVG assets, so omit
    # the web-only image URL replacements and retain the shared surface rules.
    theme = (ROOT / 'templates/scss/user.vaultwarden.scss.hbs').read_text()
    palette, rest = theme.split('/* Use upstream logo locations.', 1)
    surfaces = '/* Preserve information architecture' + rest.split(
        '/* Preserve information architecture', 1)[1]
    return (palette + surfaces
            + '\n/* Match the native window and legacy desktop body to the same charcoal. */\n'
            + ':root body { background-color: #171719; color: #ededee; }\n')


def brand_product_labels(output):
    desktop = output / 'apps/desktop'
    (desktop / 'src/scss/vault.css').write_text(desktop_theme_css())
    # Only these product-label keys change; preserve security/help/legal copy.
    for locale in sorted((desktop / 'src/locales').glob('*/messages.json')):
        data = json.loads(locale.read_text())
        for key, name in [('bitwarden', 'Vault'), ('bitwardenBeta', 'Vault Preview')]:
            if key in data:
                data[key]['message'] = name
        for key in ['appLogoLabel', 'newToBitwarden', 'loginPageEmailEntryScreenTitle']:
            if key in data:
                data[key]['message'] = data[key]['message'].replace('Bitwarden', 'Vault')
        locale.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

    wordmark = (ROOT / 'branding/wordmark.svg').read_text().strip()
    svg_dir = output / 'libs/assets/src/svg/svgs'
    (svg_dir / 'password-manager.ts').write_text(
        'import { svg } from "../svg";\n\n'
        'const PasswordManagerLogo = svg`\n' + wordmark + '\n`;\n\n'
        'export default PasswordManagerLogo;\n')
    for filename, symbol in [('bitwarden-logo.icon.ts', 'BitwardenLogo'),
                             ('bitwarden-logo-beta.icon.ts', 'BitwardenLogoBeta')]:
        (svg_dir / filename).write_text(
            'import { svg } from "../svg";\n\n'
            f'export const {symbol} = svg`\n' + wordmark + '\n`;\n')


def prepare(output):
    output = output.resolve()
    if not output.is_relative_to((ROOT / '.cache').resolve()):
        raise ValueError('Output must be a new directory inside this project\'s .cache')
    if output.exists():
        raise ValueError('Output already exists; choose a new candidate directory')
    pin = json.loads((ROOT / 'upstream.lock.json').read_text())['desktop']
    if run('git', 'rev-parse', 'HEAD', cwd=SOURCE) != pin['commit']:
        raise ValueError('Desktop source does not match upstream.lock.json')
    if run('git', 'status', '--porcelain', '--untracked-files=all', cwd=SOURCE):
        raise ValueError('Desktop upstream must be clean; preserve changes before preparing')
    if run('git', 'remote', 'get-url', 'origin', cwd=SOURCE) != pin['url']:
        raise ValueError('Unexpected desktop source remote')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir()
    # Export tracked source only. No local Git/T3 metadata, build output or sessions.
    with tempfile.TemporaryFile() as archive:
        subprocess.run(['git', 'archive', pin['commit']], cwd=SOURCE, stdout=archive, check=True)
        archive.seek(0)
        subprocess.run(['tar', '-xf', '-', '-C', str(output)], stdin=archive, check=True)
    subprocess.run(['git', 'apply', '--check', str(BRANDING / 'source.patch')], cwd=output, check=True)
    subprocess.run(['git', 'apply', str(BRANDING / 'source.patch')], cwd=output, check=True)

    desktop = output / 'apps/desktop'
    for source, target in [
        ('electron-builder.vault.json', 'electron-builder.vault.json'),
        ('vault-after-pack.js', 'scripts/vault-after-pack.js'),
        ('entitlements.vault.plist', 'resources/entitlements.vault.plist'),
    ]:
        shutil.copyfile(BRANDING / source, desktop / target)

    brand_product_labels(output)

    notices = desktop / 'resources/vault-notices'
    notices.mkdir()
    for name in ['LICENSE.txt', 'LICENSE_GPL.txt', 'LICENSE_BITWARDEN.txt']:
        shutil.copyfile(output / name, notices / name)
    shutil.copyfile(ROOT / 'NOTICE.md', notices / 'VAULT_NOTICE.md')
    shutil.copyfile(BRANDING / 'MODIFICATIONS.md', notices / 'MODIFICATIONS.md')
    (desktop / 'scripts/vault-candidate.json').write_text(json.dumps({
        'sourceCommit': pin['commit'],
        'productName': 'Vault',
        'bundleId': 'com.osirismedici.vault',
        'status': 'source candidate; unsigned; runtime and Touch ID acceptance pending',
    }, indent=2) + '\n')
    receipt = {
        'sourceCommit': pin['commit'],
        'sourcePatchSha256': digest(BRANDING / 'source.patch'),
        'packagingConfigSha256': digest(BRANDING / 'electron-builder.vault.json'),
        'charcoalThemeSha256': digest(ROOT / 'templates/scss/user.vaultwarden.scss.hbs'),
        'biometricServiceSha256': digest(desktop / 'src/key-management/biometrics/os-biometrics-mac.service.ts'),
        'keychainImplementationSha256': digest(desktop / 'desktop_native/core/src/password/macos.rs'),
        'installed': False,
        'runtimeVerified': False,
    }
    (output / 'vault-source-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.cache/desktop-source')
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.output), indent=2))
    except (ValueError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
