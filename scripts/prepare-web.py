#!/usr/bin/env python3
"""Export the pinned web source and apply Vault's reviewed candidate patches."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'upstream/web'
PATCHES = [
    ROOT / 'branding/web-source.patch',
    ROOT / 'patches/web-short-master-passwords.patch',
    ROOT / 'patches/web-login-row-copy.patch',
]


def run(*args):
    return subprocess.check_output(args, cwd=SOURCE, text=True).strip()


def prepare(output):
    output = output.resolve()
    if not output.is_relative_to((ROOT / '.cache').resolve()):
        raise ValueError('Output must be a new directory inside this project\'s .cache')
    if output.exists():
        raise ValueError('Output already exists; choose a new candidate directory')
    pin = json.loads((ROOT / 'upstream.lock.json').read_text())['web']
    if run('git', 'rev-parse', 'HEAD') != pin['commit']:
        raise ValueError('Web source does not match upstream.lock.json')
    if run('git', 'status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Web upstream must be clean; preserve changes before preparing')
    if run('git', 'remote', 'get-url', 'origin') != pin['url']:
        raise ValueError('Unexpected web source remote')
    output.mkdir(parents=True)
    # Export tracked source only, without Git, sessions, data or build artifacts.
    with tempfile.TemporaryFile() as archive:
        subprocess.run(['git', 'archive', pin['commit']], cwd=SOURCE, stdout=archive, check=True)
        archive.seek(0)
        subprocess.run(['tar', '-xf', '-', '-C', str(output)], stdin=archive, check=True)
    for patch in PATCHES:
        subprocess.run(['git', 'apply', '--check', str(patch)], cwd=output, check=True)
        subprocess.run(['git', 'apply', str(patch)], cwd=output, check=True)
    tests = {
        'input-password.vault.spec.ts': 'libs/auth/src/angular/input-password',
        'login.vault.spec.ts': 'libs/auth/src/angular/login',
    }
    for name, target in tests.items():
        shutil.copyfile(ROOT / 'tests/web-short-passwords' / name, output / target / name)
    receipt = {
        'sourceCommit': pin['commit'],
        'patches': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in PATCHES},
        'tests': {name: hashlib.sha256((ROOT / 'tests/web-short-passwords' / name).read_bytes()).hexdigest() for name in tests},
        'minimumMasterPasswordCharacters': 1,
        'status': 'source candidate; build and human acceptance required; not deployed',
    }
    (output / 'vault-source-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.cache/web-short-passwords')
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.output), indent=2))
    except (ValueError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
