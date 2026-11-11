#!/usr/bin/env python3
"""Private clipboard transfer for the five explicitly requested login demos.

Run only after observing the exact HTTPS origin in the bound browser tab.
No credentials, response bodies, or clipboard contents are printed.
"""

import argparse
import json
import subprocess
import sys

from import_bitwarden import API, MANIFEST, STAGE, VAULT, Stop, private_file

SITES = ("kit", "canva", "notion", "clickup", "hostinger", "github", "godaddy")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", choices=SITES)
    parser.add_argument("field", choices=("username", "password"))
    parser.add_argument("action", choices=("copy", "clear"))
    parser.add_argument("--origin", required=True)
    args = parser.parse_args()
    try:
        private_file(MANIFEST)
        manifest = json.loads(MANIFEST.read_text())
        if manifest.get("version") != 1 or manifest.get("vaultName") != VAULT:
            raise Stop("manifest_mismatch")
        selection_path = STAGE / "demo-selection.json"
        private_file(selection_path)
        selection = json.loads(selection_path.read_text())
        accounts = [a for a in manifest["accounts"] if a["accountId"] == selection[args.site]]
        if len(accounts) != 1 or args.origin not in accounts[0]["origins"]:
            raise Stop("unapproved_account_or_origin")
        key = accounts[0]["credentialRef"] + "_" + args.field.upper()
        data = API().need("/v1/credentials?vault=" + VAULT + "&reveal=true&key=" + key)
        rows = data.get("credentials", [])
        if len(rows) != 1 or rows[0].get("key") != key:
            raise Stop("credential_reference_mismatch")
        value = rows[0].get("value", "").encode()
        if not value:
            raise Stop("empty_credential_field")
        if args.action == "copy":
            subprocess.run(["/usr/bin/pbcopy"], input=value, check=True, stderr=subprocess.DEVNULL)
        else:
            current = subprocess.run(["/usr/bin/pbpaste"], check=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout
            if current == value:
                subprocess.run(["/usr/bin/pbcopy"], input=b"", check=True, stderr=subprocess.DEVNULL)
        print(json.dumps({"site": args.site, "field": args.field, "privateTransfer": args.action, "ok": True}))
        return 0
    except Exception:
        print('{"ok":false,"reason":"private_transfer_stopped"}')
        return 1


if __name__ == "__main__":
    sys.exit(main())
