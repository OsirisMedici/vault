#!/usr/bin/env python3
"""Check public release assets without authenticating or reading vault items."""
import argparse
import json
import re
import urllib.error
import urllib.parse
import urllib.request


def check(base, proxy_gates=False):
    base = base.rstrip('/')
    results = {}

    def get(path):
        with urllib.request.urlopen(base + path, timeout=20) as response:
            body = response.read()
            results[path] = {'status': response.status, 'bytes': len(body)}
            return body.decode()

    index = get('/')
    assert '<title page-title>Keyflow</title>' in index, 'Keyflow title missing'
    main = re.search(r'src="(app/main\.keyflow\.[a-f0-9]+\.js)"', index)
    assert main, 'Versioned Keyflow main bundle missing'
    get('/' + main.group(1))
    get('/alive')
    get('/images/keyflow-wordmark.svg')
    get('/images/keyflow-icon.svg')
    manifest = json.loads(get('/keyflow.webmanifest'))
    assert manifest['name'] == 'Keyflow'
    css = get('/css/vaultwarden.css')
    # grass preserves whitespace inside custom properties even in compressed mode.
    assert re.search(r'--color-background-alt\s*:\s*23\s+23\s+25\s*[;}]', css), 'Charcoal CSS missing'
    assert 'keyflow-wordmark.svg' in css, 'Logo CSS missing'
    config = json.loads(get('/api/config'))
    expected_origin = urllib.parse.urlsplit(base)
    actual_origin = urllib.parse.urlsplit(config['environment']['api'])
    assert (actual_origin.scheme, actual_origin.netloc) == (expected_origin.scheme, expected_origin.netloc), 'API origin changed'

    if proxy_gates:
        for path, expected_status, data in [('/admin', 404, None), ('/api/accounts/register', 403, b'{}')]:
            request = urllib.request.Request(base + path, data=data,
                                             headers={'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    status = response.status
            except urllib.error.HTTPError as error:
                status = error.code
            assert status == expected_status, f'{path}: expected {expected_status}, got {status}'
            results[path] = {'status': status}
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base_url')
    parser.add_argument('--expect-proxy-gates', action='store_true',
                        help='Check an existing proxy that blocks admin and registration; sends empty registration JSON')
    args = parser.parse_args()
    print(json.dumps(check(args.base_url, args.expect_proxy_gates), indent=2))
