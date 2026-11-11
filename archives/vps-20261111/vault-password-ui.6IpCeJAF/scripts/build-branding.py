#!/usr/bin/env python3
"""Build a deterministic, display-only overlay for the pinned web-vault release."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_exact(text, old, new, count, label):
    actual = text.count(old)
    if actual != count:
        raise ValueError(f"{label}: expected {count} matches, found {actual}; review upstream changes")
    return text.replace(old, new)


def build(source, output):
    source, output = source.resolve(), output.resolve()
    if not (source / 'index.html').is_file():
        raise ValueError('Input must be the pinned release web-vault directory')
    # Never accept an output containing the input, or modify input assets in place.
    if source == output or source.is_relative_to(output) or output.is_relative_to(source):
        raise ValueError('Input and output directories must be separate')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output must be empty; use a fresh release directory')
    index = (source / 'index.html').read_text()
    main_match = re.search(r'src="(app/main\.[a-f0-9]+\.js)"', index)
    if not main_match:
        raise ValueError('Pinned main bundle not found')
    main_path = Path(main_match.group(1))
    main = (source / main_path).read_text()
    main = replace_exact(main, 'Vaultwarden Web', 'Vault', 3, 'display-name strings')
    main = replace_exact(main, '"alt","Vaultwarden"', '"alt","Vault"', 1, 'loading-logo label')
    main = replace_exact(main, '/messages.json?cache=5dwehg', '/messages.json?cache=5dwehg-vault-0.1.1', 1, 'versioned logo translations')
    branded_main_path = main_path.with_name('main.vault.' + hashlib.sha256(main.encode()).hexdigest()[:20] + '.js')
    index = replace_exact(index, str(main_path), str(branded_main_path), 1, 'versioned main bundle')
    index = replace_exact(index, '<title page-title>Vaultwarden Web</title>', '<title page-title>Vault</title>', 1, 'index title')
    index = replace_exact(index, 'alt="Vaultwarden"', 'alt="Vault"', 1, 'index loading label')
    index = replace_exact(index, 'content="#175DDC"', 'content="#171719"', 1, 'browser theme color')
    # Load theme in head as well as upstream's body hook, avoiding an unthemed flash.
    index = index.replace('</head>', '<link rel="stylesheet" href="css/vaultwarden.css"/></head>')
    index = index.replace('<meta name="viewport" content="width=1010"/>', '<meta name="viewport" content="width=device-width,initial-scale=1"/>')
    index = re.sub(r'<link rel="(?:apple-touch-icon|icon|mask-icon)"[^>]+/>', '', index)
    index = index.replace('</head>', '<link rel="icon" type="image/svg+xml" href="images/vault-icon.svg"/></head>')
    index = index.replace('href="css/vaultwarden.css"', 'href="css/vaultwarden.css?vault=0.1.1"')
    files = {'index.html': index, str(branded_main_path): main}
    # Preserve all translated product copy and disclaimers; rename only the logo label.
    for locale in sorted((source / 'locales').glob('*/messages.json')):
        raw = locale.read_text()
        messages = json.loads(raw)
        if 'appLogoLabel' in messages:
            messages['appLogoLabel']['message'] = 'Vault logo'
            files[str(locale.relative_to(source))] = json.dumps(messages, ensure_ascii=False, separators=(',', ':'))
    for name, content in files.items():
        dest = output / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content)
    (output / 'images').mkdir(parents=True, exist_ok=True)
    for name in ['logo.svg', 'logo-white.svg', 'vault-wordmark.svg']:
        shutil.copyfile(ROOT / 'branding/wordmark.svg', output / 'images' / name)
    for name in ['icon-white.svg', 'icon.svg', 'vault-icon.svg', 'safari-pinned-tab.svg']:
        shutil.copyfile(ROOT / 'branding/icon.svg', output / 'images' / name)
    for manifest in source.glob('*.json'):
        try:
            data = json.loads(manifest.read_text())
        except (ValueError, UnicodeDecodeError):
            continue
        if 'icons' in data and 'name' in data:
            data.update(name='Vault', short_name='Vault', theme_color='#171719', background_color='#171719')
            data['icons'] = [{'src': 'images/vault-icon.svg', 'sizes': 'any', 'type': 'image/svg+xml', 'purpose': 'any'}]
            (output / 'vault.webmanifest').write_text(json.dumps(data, separators=(',', ':')))
            index = index.replace(manifest.name, 'vault.webmanifest')
    (output / 'index.html').write_text(index)
    report = {'webVersion': '2026.7.0', 'displayNameReplacements': 3,
              'inputMainSha256': hashlib.sha256((source / main_path).read_bytes()).hexdigest(),
              'outputMainSha256': hashlib.sha256((output / branded_main_path).read_bytes()).hexdigest(),
              'files': len(list(output.rglob('*')))}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('web_vault', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/overlay')
    args = parser.parse_args()
    build(args.web_vault, args.output)
