#!/usr/bin/python3 -I
"""Root-owned, Vault-only operations. Never expose container env/configuration."""
import json
import os
import re
import subprocess
import sys

ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LANG': 'C.UTF-8'}
ACTIVATOR = '/opt/osiris-vault-web-release-f561d18/activate-web.py'


def run(args, timeout=120):
    return subprocess.run(args, env=ENV, cwd='/', capture_output=True, text=True,
                          check=True, timeout=timeout).stdout


def main(args):
    if os.geteuid() != 0:
        print('Run through the installed sudo rule.')
        return 1
    try:
        if args == ['status']:
            state = json.loads(run(['/usr/bin/docker', 'inspect', 'osiris-vaultwarden']))[0]
            print(json.dumps({'container': 'osiris-vaultwarden',
                              'image': state['Config']['Image'], 'imageId': state['Image'],
                              'running': state['State']['Running'],
                              'health': state['State'].get('Health', {}).get('Status', 'unknown')}))
        elif args == ['backup']:
            run(['/usr/bin/systemctl', 'start', 'vaultwarden-backup.service'], timeout=900)
            print('Backup service completed. Backup integrity must still be verified before activation.')
        elif len(args) == 5 and args[0] == 'activate':
            image, previous, image_id, backup = args[1:]
            if not (re.fullmatch(r'osiris-vault:0\.2\.0-agent-web-[a-f0-9]{7,40}', image)
                    and re.fullmatch(r'osiris-vault:[A-Za-z0-9_.-]+', previous)
                    and re.fullmatch(r'sha256:[a-f0-9]{64}', image_id)
                    and re.fullmatch(r'/opt/vaultwarden/backups/vaultwarden-[0-9TZ]+\.tar\.age', backup)):
                raise ValueError()
            output = run(['/usr/bin/python3', '-I', ACTIVATOR, image,
                          '--expected-image', previous, '--expected-image-id', image_id,
                          '--verified-backup', backup], timeout=360)
            result = json.loads(output)
            if result.get('activated') is not True:
                raise ValueError()
            print(json.dumps({key: result[key] for key in [
                'activated', 'image', 'imageId', 'serverLayersPreserved',
                'composeOnlyImageChanged', 'rollbackCompose'] if key in result}))
        else:
            print('Usage: vault-ops status | backup | activate IMAGE PREVIOUS_IMAGE PREVIOUS_IMAGE_ID VERIFIED_BACKUP')
            return 2
        return 0
    except Exception:
        print('Vault operation failed. No raw configuration or diagnostic output was printed; an administrator must inspect locally.')
        return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
