#!/usr/bin/env python3
"""Package a compiled Vault web release without deploying or invoking Docker."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tarfile

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_IMAGE = 'osiris-vault:0.2.0-agent-web-f561d18'
EXPECTED_IMAGE_ID = 'sha256:82fc407ef671cbc3477ed32a973e7bd088439726c90fa627a8e37362d867b7fb'
spec = importlib.util.spec_from_file_location('agent_packaging', ROOT / 'scripts/prepare-agent-web-release.py')
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def package(candidate):
    candidate = packager.safe_path(candidate).resolve(strict=True)
    receipt = json.loads((candidate / 'vault-password-source-receipt.json').read_text())
    build_receipt = json.loads((candidate / 'vault-password-build-result.json').read_text())
    agent = json.loads((candidate / 'vault-agent-web-tooling.json').read_text())
    cache_tag = 'vault-agent-' + hashlib.sha256(json.dumps({'agent': agent, 'password': receipt}, separators=(',', ':')).encode()).hexdigest()[:16]
    if build_receipt.get('success') is not True or build_receipt.get('compiler') != '26.12.0' or build_receipt.get('cacheTag') != cache_tag:
        raise ValueError('A successful build of this exact candidate is required')

    for name, expected in receipt['filesSha256'].items():
        if digest(candidate / name) != expected:
            raise ValueError('Password source changed since preparation')
    build = candidate / 'apps/web/build'
    english = json.loads((build / 'locales/en/messages.json').read_text())
    if not all(key in english for key in ['vaultMasterPasswordLength', 'vaultShortMasterPasswordWarning']):
        raise ValueError('Compiled password guidance is missing')
    identity = hashlib.sha256(((build / 'index.html').read_text() +
                              json.dumps(receipt, sort_keys=True) + digest(ROOT / 'scripts/build-agent-web-bun.mjs') +
                              digest(ROOT / 'NOTICE.md') + digest(ROOT / 'deploy/password-release/finish-as-root.sh.in')).encode()).hexdigest()[:12]
    image = 'osiris-vault:0.2.0-agent-web-' + identity
    output = ROOT / '.cache' / ('password-deployment-' + identity)
    if output.exists():
        raise ValueError('Release directory exists; preserve it')
    output.mkdir()
    context = output / 'context'
    context.mkdir()
    packaged = packager.package(build, context / 'web')
    shutil.copyfile(ROOT / 'LICENSE', context / 'LICENSE')
    shutil.copyfile(ROOT / 'NOTICE.md', context / 'NOTICE.md')
    (context / 'Dockerfile').write_text(
        '# Retain the exact accepted server and its agent-access release layers.\n'
        'FROM ' + EXPECTED_IMAGE + '\n'
        'COPY web/ /web-vault/\n'
        'COPY LICENSE NOTICE.md /usr/share/doc/vault/\n'
        'LABEL org.opencontainers.image.title="Vault"\n')
    archive = output / 'vault-password-release.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        for path in sorted(context.rglob('*')):
            if path.is_symlink() or not (path.is_file() or path.is_dir()):
                raise ValueError('Only regular build files are accepted')
            tar.add(path, arcname=path.relative_to(context), recursive=False)
    result = {'releaseBase': receipt['releaseBase'], 'image': image,
              'expectedImage': EXPECTED_IMAGE, 'expectedImageId': EXPECTED_IMAGE_ID,
              'archive': str(archive), 'archiveSha256': digest(archive),
              'archiveBytes': archive.stat().st_size, 'packaging': packaged,
              'passwordSource': receipt, 'buildResult': build_receipt, 'deployed': False}
    template = (ROOT / 'deploy/password-release/finish-as-root.sh.in').read_text()
    for name, value in {
        'EXPECTED_IMAGE': EXPECTED_IMAGE, 'EXPECTED_IMAGE_ID': EXPECTED_IMAGE_ID,
        'IMAGE': image, 'RELEASE': identity, 'ARCHIVE': str(archive),
        'ARCHIVE_SHA256': result['archiveSha256'],
    }.items():
        template = template.replace('@' + name + '@', value)
    script = output / 'finish-as-root.sh'
    script.write_text(template)
    result['administratorScript'] = str(script)
    result['administratorScriptSha256'] = digest(script)
    (output / 'release.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', type=Path)
    print(json.dumps(package(parser.parse_args().candidate), indent=2))
