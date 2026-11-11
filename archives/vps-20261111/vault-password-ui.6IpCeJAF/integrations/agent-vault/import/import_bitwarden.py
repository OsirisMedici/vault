#!/usr/bin/env python3
"""One-shot private Bitwarden JSON to the existing local Agent Vault trial.

Only aggregate receipts leave this process. Never enable HTTP/debug logging.
The staged export is consumed and unlinked even when an import fails.
"""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

VAULT = "bitwarden-import-20261022"
BASE = "http://127.0.0.1:18431"
HOME = Path.home()
STAGE = HOME / ".local/share/osiris-agent-vault-trials/bitwarden-import-20261022-staging"
EXPORT = STAGE / "export.json"
MANIFEST = HOME / ".config/osiris-agent-vault/integration-v1/import-manifest.json"
CONTROL = Path("/tmp/vault-agent-vault-eval.rIoisH/standalone/control.json")
BATCH_ACCOUNTS = 10


class Stop(Exception):
    """Only fixed, nonsecret reasons may be placed in this exception."""


def private_dir(path):
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.is_symlink() or path.stat().st_uid != os.getuid():
        raise Stop("unsafe_private_directory")
    path.chmod(0o700)


def private_file(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid():
        raise Stop("unsafe_private_file")
    path.chmod(0o600)


def save(path, data):
    private_dir(path.parent)
    temporary = path.with_name(path.name + ".pending")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(data, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class API:
    def __init__(self):
        private_file(CONTROL)
        self.token = json.loads(CONTROL.read_text())["ownerToken"]
        # Ignore proxy environment variables. The owner capability stays on loopback.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def call(self, path, payload=None, method=None):
        for attempt in range(3):
            request = urllib.request.Request(
                BASE + path,
                data=json.dumps(payload).encode() if payload is not None else None,
                headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
                method=method,
            )
            try:
                with self.opener.open(request, timeout=15) as response:
                    return response.status, json.load(response)
            except urllib.error.HTTPError as error:
                code = error.code
                error.close()  # Do not read or log response bodies.
                if code not in (429, 500, 502, 503, 504) or attempt == 2:
                    return code, {}
            except (OSError, ValueError):
                if attempt == 2:
                    raise Stop("local_api_unavailable") from None
            time.sleep(attempt + 1)
        raise Stop("local_api_retry_exhausted")

    def need(self, path, payload=None, method=None, codes=(200,)):
        status, body = self.call(path, payload, method)
        if status not in codes:
            raise Stop("local_api_operation_failed")
        return body


def prepare(api):
    private_dir(STAGE)
    marker = STAGE / "destination.json"
    status, settings = api.call("/v1/vaults/" + VAULT + "/settings")
    if status == 404:
        api.need("/v1/vaults", {"name": VAULT}, codes=(201, 409))
        save(marker, {"vaultName": VAULT, "createdBy": "bitwarden-bulk-import-v1"})
    elif status != 200 or not marker.exists():
        raise Stop("existing_vault_not_owned_by_importer")
    if json.loads(marker.read_text()).get("vaultName") != VAULT:
        raise Stop("destination_marker_mismatch")
    api.need("/v1/vaults/" + VAULT + "/settings", {"unmatched_host_policy": "deny"}, "PATCH")
    settings = api.need("/v1/vaults/" + VAULT + "/settings")
    if settings.get("unmatched_host_policy") != "deny":
        raise Stop("strict_deny_not_verified")
    private_dir(MANIFEST.parent)


def metadata(item):
    origins = []
    login_url = None
    for entry in item["login"].get("uris") or []:
        raw = entry.get("uri") if isinstance(entry, dict) else None
        if not isinstance(raw, str):
            continue
        try:
            url = urllib.parse.urlsplit(raw)
            if url.scheme != "https" or not url.hostname or url.username or url.password:
                continue
            host = url.hostname.encode("idna").decode("ascii").lower()
            if "*" in host or any(c.isspace() for c in host):
                continue
            if ":" in host:
                host = "[" + host + "]"
            origin = "https://" + host + (":" + str(url.port) if url.port not in (None, 443) else "")
        except (ValueError, UnicodeError):
            continue
        if origin not in origins:
            origins.append(origin)
        # Strip query/fragment/path, which may contain tokens. The origin is a safe login URL.
        if login_url is None:
            login_url = origin + "/"
    return origins, login_url


def select(data, receipt):
    if not isinstance(data, dict) or data.get("encrypted") is not False or not isinstance(data.get("items"), list):
        raise Stop("expected_unencrypted_bitwarden_json")
    selected = []
    seen = set()
    fallback_counts = {}
    for item in data["items"]:
        if not isinstance(item, dict):
            raise Stop("invalid_source_record")
        login = item.get("login")
        reason = None
        if item.get("organizationId"):
            reason = "organization"
        elif item.get("deletedDate") or item.get("archivedDate") or item.get("isArchived"):
            reason = "inactive"
        elif item.get("type") != 1:
            reason = "non_login"
        elif not isinstance(login, dict) or not isinstance(login.get("password"), str) or not login["password"]:
            reason = "no_password"
        if reason:
            receipt["skipped"] += 1
            receipt["skipReasons"][reason] = receipt["skipReasons"].get(reason, 0) + 1
            continue
        username = login.get("username")
        if username is None:
            username = ""
        if not isinstance(username, str) or not isinstance(item.get("name", ""), str):
            raise Stop("invalid_login_metadata")
        origins, login_url = metadata(item)
        source_id = item.get("id")
        try:
            account_id = str(uuid.UUID(source_id))
            prefix = "VW_" + uuid.UUID(account_id).hex.upper()
        except (ValueError, TypeError, AttributeError):
            # Passwords, timestamps and unrelated fields never participate in fallback IDs.
            signature = json.dumps([item.get("name", ""), username, origins], ensure_ascii=False, separators=(",", ":"))
            occurrence = fallback_counts.get(signature, 0)
            fallback_counts[signature] = occurrence + 1
            opaque = hashlib.sha256((signature + "|" + str(occurrence)).encode()).hexdigest()
            account_id = "metadata-" + opaque
            prefix = "VW_" + opaque.upper()
            receipt["missingSourceIds"] += 1
            source_id = None
        if account_id in seen:
            raise Stop("duplicate_source_item_id")
        seen.add(account_id)
        account = {"accountId": account_id, "name": item.get("name", ""), "username": username,
                   "origins": origins, "credentialRef": prefix, "importedAt": receipt["importedAt"]}
        if source_id:
            account["sourceItemId"] = source_id
        if login_url:
            account["loginUrl"] = login_url
        selected.append((account, username, login["password"]))
    receipt["eligible"] = len(selected)
    return selected


def run(receipt):
    private_file(EXPORT)
    verification = json.loads((STAGE / "source-verification.json").read_text())
    if verification.get("sourceVerified") is not True:
        raise Stop("source_identity_not_verified")
    selected = select(json.loads(EXPORT.read_text()), receipt)
    if not selected:
        raise Stop("no_eligible_logins")
    api = API()
    prepare(api)
    expected = {}
    for account, username, password in selected:
        expected[account["credentialRef"] + "_USERNAME"] = username
        expected[account["credentialRef"] + "_PASSWORD"] = password
    # A resume only accepts exactly equal values, never replacing an existing credential.
    existing = api.need("/v1/credentials?vault=" + VAULT + "&reveal=true")
    actual = {row["key"]: row.get("value", "") for row in existing.get("credentials", [])}
    if any(key not in expected or expected[key] != value for key, value in actual.items()):
        raise Stop("destination_conflict_no_overwrite")
    if MANIFEST.exists():
        private_file(MANIFEST)
        previous = json.loads(MANIFEST.read_text())
        if previous.get("version") != 1 or previous.get("vaultName") != VAULT:
            raise Stop("manifest_conflict_no_overwrite")
        if not {a["accountId"] for a in previous.get("accounts", [])}.issubset({a[0]["accountId"] for a in selected}):
            raise Stop("manifest_accounts_conflict")
    accounts = []
    for start in range(0, len(selected), BATCH_ACCOUNTS):
        batch = selected[start:start + BATCH_ACCOUNTS]
        pairs = {}
        for account, username, password in batch:
            for suffix, value in (("_USERNAME", username), ("_PASSWORD", password)):
                key = account["credentialRef"] + suffix
                if key not in actual:
                    pairs[key] = value
        if pairs:
            api.need("/v1/credentials", {"vault": VAULT, "credentials": pairs})
        accounts.extend(a[0] for a in batch)
        save(MANIFEST, {"version": 1, "vaultName": VAULT, "accounts": accounts})
        receipt["imported"] = len(accounts)
    # C06 and C07 are the only two acceptance cases, each across the entire batch.
    stored = json.loads(MANIFEST.read_text())
    receipt["C06"] = len(stored["accounts"]) == len(selected) == receipt["imported"]
    readback = api.need("/v1/credentials?vault=" + VAULT + "&reveal=true")
    values = {row["key"]: row.get("value", "") for row in readback.get("credentials", [])}
    receipt["C07"] = values == expected
    receipt["verifiedPairs"] = sum(
        values.get(a["credentialRef"] + "_USERNAME") == user and
        values.get(a["credentialRef"] + "_PASSWORD") == password for a, user, password in selected
    )
    if not receipt["C06"] or not receipt["C07"]:
        raise Stop("batch_acceptance_failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", action="store_true", help="Prepare dedicated deny-only destination without consuming export")
    args = parser.parse_args()
    os.umask(0o077)
    receipt = {"vaultName": VAULT, "eligible": None, "imported": 0, "skipped": 0, "errors": 0,
               "skipReasons": {}, "missingSourceIds": 0, "verifiedPairs": 0, "C06": None, "C07": None,
               "importedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "plaintextExportRemoved": False}
    try:
        if args.prepare:
            prepare(API())
            print(json.dumps({"prepared": True, "vaultName": VAULT, "strictDeny": True}))
            return 0
        run(receipt)
    except Exception as error:
        receipt["errors"] = 1
        receipt["reason"] = str(error) if isinstance(error, Stop) else "private_import_stopped"
    finally:
        if not args.prepare:
            try:
                EXPORT.unlink(missing_ok=True)
                receipt["plaintextExportRemoved"] = not EXPORT.exists()
            except OSError:
                receipt["errors"] += 1
                receipt["reason"] = "export_cleanup_failed"
            try:
                save(STAGE / "receipt.json", receipt)
            except Exception:
                receipt["errors"] += 1
                receipt["reason"] = "receipt_write_failed"
            print(json.dumps(receipt))
    return 1 if receipt["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
