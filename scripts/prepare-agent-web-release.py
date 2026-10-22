#!/usr/bin/env python3
"""Package a compiled Agent access client with the existing Vault display assets."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]


def safe_path(path):
    path = Path(os.path.abspath(path))
    if not path.is_relative_to(ROOT / '.cache') or path == ROOT / '.cache':
        raise ValueError('Build and release must be below this worktree .cache')
    for parent in [path, *path.parents]:
        if parent.is_symlink():
            raise ValueError('Build/release path must not contain symlinks')
        if parent == ROOT:
            break
    return path


def regular_tree(source):
    # Packaging only accepts compiled regular files, never links into another tree.
    for path in source.rglob('*'):
        if path.is_symlink() or not (path.is_dir() or path.is_file()):
            raise ValueError('Compiled output contains a symlink or special file')
        if path.is_file() and path.stat().st_nlink != 1:
            raise ValueError('Compiled output contains a hardlinked file')


def package(source, output):
    source = safe_path(source).resolve(strict=True)
    output = safe_path(output)
    if output.exists():
        raise ValueError('Use a fresh release directory below this worktree .cache')
    if output.is_relative_to(source) or source.is_relative_to(output):
        raise ValueError('Build and release directories must be separate')
    regular_tree(source)
    index = (source / 'index.html').read_text()
    if '<title page-title>Vault</title>' not in index or not (source / 'manifest.json').is_file():
        raise ValueError('Expected the compiled branded OSS client')
    bundles = list(source.rglob('*.js'))
    if not any('Request sign-in' in p.read_text() and 'Agent access' in p.read_text() for p in bundles):
        raise ValueError('Compiled Agent access feature is missing')
    # No authentication or encryption bundles are rewritten after compilation.
    before = {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in bundles}
    licenses = {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in source.rglob('*') if p.is_file() and
                ('license' in p.name.lower() or p.name.lower().startswith(('notice', 'copying')))}
    if not licenses:
        raise ValueError('Compiled license/attribution files are missing')
    shutil.copytree(source, output)
    index = re.sub(r'<meta name="viewport" content="[^"]*"\s*/?>',
                   '<meta name="viewport" content="width=device-width,initial-scale=1"/>', index)
    index = re.sub(r'<meta name="theme-color" content="[^"]*"\s*/?>',
                   '<meta name="theme-color" content="#171719"/>', index)
    index = re.sub(r'<link rel="(?:apple-touch-icon|icon|mask-icon)"[^>]*>', '', index)
    index = index.replace('</head>', '<link rel="icon" type="image/svg+xml" href="images/vault-icon.svg"/>'
                          '<link rel="stylesheet" href="css/vaultwarden.css?vault=agent-access"/></head>')
    (output / 'index.html').write_text(index)
    for name in ['logo.svg', 'logo-white.svg', 'vault-wordmark.svg']:
        shutil.copyfile(ROOT / 'branding/wordmark.svg', output / 'images' / name)
    for name in ['icon.svg', 'icon-white.svg', 'vault-icon.svg', 'safari-pinned-tab.svg']:
        shutil.copyfile(ROOT / 'branding/icon.svg', output / 'images' / name)
    manifest = json.loads((output / 'manifest.json').read_text())
    manifest.update(name='Vault', short_name='Vault', theme_color='#171719', background_color='#171719',
                    icons=[{'src': 'images/vault-icon.svg', 'sizes': 'any', 'type': 'image/svg+xml', 'purpose': 'any'}])
    (output / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
    for path in (output / 'locales').glob('*/messages.json'):
        messages = json.loads(path.read_text())
        if 'appLogoLabel' in messages:
            messages['appLogoLabel']['message'] = 'Vault logo'
            path.write_text(json.dumps(messages, ensure_ascii=False, separators=(',', ':')))
    after = {str(p.relative_to(output)): hashlib.sha256(p.read_bytes()).hexdigest() for p in output.rglob('*.js')}
    if before != after:
        raise ValueError('Compiled JavaScript changed during display packaging')
    if any(hashlib.sha256((output / name).read_bytes()).hexdigest() != digest
           for name, digest in licenses.items()):
        raise ValueError('Compiled license/attribution changed during packaging')
    return {'release': str(output), 'javascriptFilesPreserved': len(before),
            'licenseFilesPreserved': len(licenses),
            'indexSha256': hashlib.sha256((output / 'index.html').read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(package(args.build, args.output)))
