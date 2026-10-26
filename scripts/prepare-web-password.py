#!/usr/bin/env python3
"""Apply password validation to a candidate preserving the deployed Agent access layer."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'upstream/web'
PASSWORD_PATCH = ROOT / 'patches/web-password/source.patch'
spec = importlib.util.spec_from_file_location('vault_tooling', ROOT / 'scripts/prepare-agent-web-tooling.py')
tooling = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tooling)


def prepare(output):
    output = output.resolve()
    # Existing deployed tooling preserves source pins, licenses, agent components,
    # both existing patches, frozen dependency versions and compiler settings.
    tooling.prepare(SOURCE, output)
    receipt = json.loads((output / "vault-agent-web-tooling.json").read_text())
    for check in [True, False]:
        command = ['git', 'apply', '--no-index']
        if check:
            command.append('--check')
        subprocess.run([*command, str(PASSWORD_PATCH)], cwd=output, check=True)
    password_receipt = {
        'releaseBase': 'f561d1862dc95d86689585f080acedf12e6fc3a7',
        'upstreamCommit': receipt['sourceCommit'],
        'passwordPatchSha256': hashlib.sha256(PASSWORD_PATCH.read_bytes()).hexdigest(),
        'agentReceiptSha256': hashlib.sha256((output / 'vault-agent-web-receipt.json').read_bytes()).hexdigest(),
        'filesSha256': {line[6:]: hashlib.sha256((output / line[6:]).read_bytes()).hexdigest()
                        for line in PASSWORD_PATCH.read_text().splitlines() if line.startswith('+++ b/')},
        'status': 'source candidate; deployment acceptance pending',
    }
    (output / 'vault-password-source-receipt.json').write_text(json.dumps(password_receipt, indent=2) + '\n')
    return password_receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.cache/web-password-source')
    args = parser.parse_args()
    print(json.dumps(prepare(args.output), indent=2))
