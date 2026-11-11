#!/usr/bin/env python3
"""Prepare copy icons on the exact running workspace release, without runtime data."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TOOLING_COMMIT = 'f561d1862dc95d86689585f080acedf12e6fc3a7'
BUILD_COMMIT = 'af0bf30c16819b1be54633653217c6ff768bb5c0'
RELEASE_COMMIT = 'ed810261b2c51b0c65841014602bce1f313e646f'
RELEASE_PATCHES = [
    'branding/web-password-discovery.patch',
    'branding/web-copy-login.patch',
    'branding/web-mac-menu-copy.patch',
    'branding/web-collections-toolbar.patch',
    'branding/web-compact-workspace.patch',
    'patches/web-short-master-passwords.patch',
]


def export(commit, destination, paths):
    with tempfile.TemporaryFile() as archive:
        subprocess.run(['git', 'archive', commit, *paths], cwd=ROOT,
                       stdout=archive, check=True)
        archive.seek(0)
        subprocess.run(['tar', '-xf', '-', '-C', str(destination)],
                       stdin=archive, check=True)


def prepare(output):
    output = output.absolute()
    cache = ROOT / '.cache'
    if not output.is_relative_to(cache) or '..' in output.parts or output == cache:
        raise ValueError('Output must be a fresh directory below this project .cache')
    if any(parent.is_symlink() for parent in [output, *output.parents]):
        raise ValueError('Output path must not contain symlinks')
    if output.exists():
        raise ValueError('Output already exists; choose a fresh directory')
    output.mkdir(parents=True)
    tooling = output / 'build-tools'
    tooling.mkdir()
    export(TOOLING_COMMIT, tooling,
           ['scripts', 'branding', 'tooling', 'upstream.lock.json',
            'LICENSE', 'NOTICE.md', 'templates'])
    export(RELEASE_COMMIT, tooling, [*RELEASE_PATCHES, 'templates'])
    export(BUILD_COMMIT, tooling,
           ['scripts/build-agent-web-bun.mjs', 'scripts/compile-agent-web-node.mjs',
            'scripts/web-build-resources.mjs', 'scripts/web-build-resources.test.mjs'])
    spec = importlib.util.spec_from_file_location(
        'row_copy_release_tooling', tooling / 'scripts/prepare-agent-web-tooling.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    candidate = tooling / '.cache/source'
    module.prepare(ROOT / 'upstream/web', candidate)
    inputs = [tooling / path for path in RELEASE_PATCHES]
    inputs.append(ROOT / 'patches/web-login-row-copy-release.patch')
    for patch in inputs:
        for check in [True, False]:
            command = ['git', 'apply', '--no-index']
            if check:
                command.append('--check')
            subprocess.run([*command, str(patch)], cwd=candidate, check=True)
    receipt = {
        'toolingCommit': TOOLING_COMMIT,
        'buildToolingCommit': BUILD_COMMIT,
        'releaseBase': RELEASE_COMMIT,
        'candidate': str(candidate),
        'patches': {patch.name: hashlib.sha256(patch.read_bytes()).hexdigest()
                    for patch in inputs},
        'built': False,
        'deployed': False,
    }
    (output / 'row-copy-release.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(args.output), indent=2))
