#!/usr/bin/env python3
"""Prepare Vault password-validation source in a new, ignored development candidate."""
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'upstream/web'
PATCHES = [ROOT / 'branding/web-source.patch', ROOT / 'patches/web-password/source.patch']


def git(*args, cwd=SOURCE):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True).strip()


def prepare(output):
    output = output.resolve()
    if not output.is_relative_to((ROOT / '.cache').resolve()):
        raise ValueError('Use a new directory inside this project\'s .cache')
    if output.exists():
        raise ValueError('Output already exists; preserve it and choose a new directory')
    pin = json.loads((ROOT / 'upstream.lock.json').read_text())['web']
    if git('rev-parse', 'HEAD') != pin['commit']:
        raise ValueError('Web upstream does not match the pinned commit')
    if git('status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Web upstream must be clean')
    if git('remote', 'get-url', 'origin') != pin['url']:
        raise ValueError('Unexpected web upstream remote')
    output.mkdir(parents=True)
    with tempfile.TemporaryFile() as archive:
        subprocess.run(['git', 'archive', pin['commit']], cwd=SOURCE, stdout=archive, check=True)
        archive.seek(0)
        subprocess.run(['tar', '-xf', '-', '-C', str(output)], stdin=archive, check=True)
    for patch in PATCHES:
        # An explicit directory keeps patch paths relative to the candidate,
        # even though the candidate lives inside the owning Git repository.
        command = ['git', 'apply', '--directory=' + str(output.relative_to(ROOT))]
        subprocess.run([*command, '--check', str(patch)], cwd=ROOT, check=True)
        subprocess.run([*command, str(patch)], cwd=ROOT, check=True)
    shutil.copyfile(ROOT / 'patches/web-password/bun.lock', output / 'bun.lock')
    receipt = {
        'upstreamCommit': pin['commit'],
        'patches': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in PATCHES},
        'bunLockSha256': hashlib.sha256((output / 'bun.lock').read_bytes()).hexdigest(),
        'status': 'source candidate only; no deployment or runtime acceptance',
    }
    (output / 'vault-password-source-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.cache/web-password-source')
    args = parser.parse_args()
    print(json.dumps(prepare(args.output), indent=2))
