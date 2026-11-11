#!/usr/bin/env python3
"""Build and inspect the pinned T3 adapter. Never install, launch or read user data."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache"
BASE = "3b95e7831b11b17627dff16843bc087bfca397ec"
VERSION = "0.1.2-nightly.20261022.3512"
NAME = "T3 Code (Nightly).app"
INSTALLED = Path("/Applications") / NAME
TEAM = "ARK85ZXQ4Z"
BUNDLE = "com.t3tools.t3code"


def run(args, check=True, **kwargs):
    return subprocess.run([str(a) for a in args], check=check, capture_output=True, **kwargs)


def digest(path):
    with Path(path).open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def cached(path):
    value = Path(path).resolve()
    if not value.is_relative_to(CACHE.resolve()):
        raise ValueError("Generated inputs and outputs must stay under Vault/.cache")
    return value


def fresh(path):
    value = cached(path)
    value.mkdir(parents=True, exist_ok=False)
    return value


def inspect(app):
    app = Path(app).resolve()
    with (app / "Contents/Info.plist").open("rb") as handle:
        info = plistlib.load(handle)
    commands = {
        "strict": ["codesign", "--verify", "--deep", "--strict", app],
        "signature": ["codesign", "--display", "--verbose=4", app],
        "assessment": ["spctl", "--assess", "--type", "execute", "--verbose=4", app],
        "staple": ["xcrun", "stapler", "validate", app],
    }
    checks = {}
    for key, cmd in commands.items():
        result = run(cmd, check=False)
        checks[key] = {"exit": result.returncode,
                       "output": (result.stdout + result.stderr).decode(errors="replace").strip()}
    signature = checks["signature"]["output"]
    team = re.search(r"^TeamIdentifier=(.+)$", signature, re.M)
    result = {
        "app": str(app), "bundle": info.get("CFBundleIdentifier"),
        "version": info.get("CFBundleShortVersionString"),
        "name": app.name, "team": team.group(1) if team else None,
        "hardenedRuntime": "(runtime)" in signature or ",runtime)" in signature,
        "updateFeedPresent": (app / "Contents/Resources/app-update.yml").exists(),
        "checks": checks,
    }
    result["identityMatches"] = (result["bundle"] == BUNDLE and result["version"] == VERSION
                                 and result["name"] == NAME)
    result["trusted"] = (result["identityMatches"] and result["team"] == TEAM
                         and result["hardenedRuntime"]
                         and all(checks[key]["exit"] == 0 for key in ("strict", "assessment", "staple")))
    return result


def source_receipt(source, output):
    head = run(["git", "-C", source, "rev-parse", "HEAD"]).stdout.decode().strip()
    if head != BASE:
        raise ValueError("Source does not match the approved installed base")
    changed = run(["git", "-C", source, "diff", "HEAD", "--name-only", "-z"]).stdout
    untracked = run(["git", "-C", source, "ls-files", "--others", "--exclude-standard", "-z"]).stdout
    paths = sorted(set(p.decode() for p in (changed + untracked).split(b"\0") if p))
    allowed = ("apps/desktop/src/", "apps/desktop/vite.config.ts", "apps/server/src/preview/",
               "apps/server/src/mcp/toolkits/preview/", "packages/contracts/src/")
    if any(not p.startswith(allowed) or not p.endswith((".ts", ".tsx")) for p in paths):
        raise ValueError("Unexpected source change; inspect it before packaging")
    if not paths:
        raise ValueError("The native adapter changes are missing")
    patch = run(["git", "-C", source, "diff", "--binary", "HEAD", "--", *paths]).stdout
    for path in paths:
        if path.encode() in untracked.split(b"\0"):
            diff = run(["git", "diff", "--no-index", "--binary", "--", "/dev/null", path],
                       cwd=source, check=False)
            if diff.returncode != 1:
                raise ValueError("Could not snapshot new source")
            patch += diff.stdout
    (output / "adapter.patch").write_bytes(patch)
    (output / "T3-LICENSE").write_bytes((source / "LICENSE").read_bytes())
    receipt = {"base": head, "version": VERSION, "adapterPatchSha256": digest(output / "adapter.patch"),
               "files": {path: digest(source / path) for path in paths}}
    (output / "source.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


def build(args):
    source = cached(args.source)
    output = fresh(args.output)
    receipt = source_receipt(source, output)
    if args.kind == "trusted":
        identities = run(["security", "find-identity", "-v", "-p", "codesigning"]).stdout.decode()
        if not any("Developer ID Application:" in line and f"({TEAM})" in line for line in identities.splitlines()):
            raise ValueError(f"No valid Developer ID Application identity for existing team {TEAM}; no build/install attempted")
        for name in ("T3CODE_APPLE_TEAM_ID", "T3CODE_MACOS_PROVISIONING_PROFILE"):
            if not os.environ.get(name):
                raise ValueError(f"Missing private release configuration: {name}")
        if os.environ["T3CODE_APPLE_TEAM_ID"] != TEAM:
            raise ValueError("Signing team must match the existing installation")
    # Keeping the exact upstream Nightly version preserves branding and profile
    # resolution. A suffix such as -vault.1 instead selects Beta in this base.
    env = dict(os.environ)
    env["PATH"] = str(source / "node_modules/.bin") + os.pathsep + env.get("PATH", "")
    for key in ("GH_TOKEN", "GITHUB_TOKEN", "GITHUB_REPOSITORY", "T3CODE_DESKTOP_UPDATE_REPOSITORY",
                "T3CODE_DESKTOP_MOCK_UPDATES", "VITE_DEV_SERVER_URL", "VITE_HTTP_URL", "VITE_WS_URL"):
        env.pop(key, None)
    env.update(T3CODE_DESKTOP_DEV="0", T3CODE_DESKTOP_MOCK_UPDATES="false",
               T3CODE_DESKTOP_SKIP_BUILD="false", T3CODE_DESKTOP_KEEP_STAGE="false",
               T3CODE_DESKTOP_SIGNED=str(args.kind == "trusted").lower())
    if args.kind == "diagnostic":
        env["CSC_IDENTITY_AUTO_DISCOVERY"] = "false"
        for key in ("CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"):
            env.pop(key, None)
    cmd = ["node", "scripts/build-desktop-artifact.ts", "--platform", "mac", "--target", "zip",
           "--arch", "arm64", "--build-version", VERSION, "--output-dir", str(output / "unsigned")]
    if args.kind == "trusted":
        cmd += ["--signed"]
    with (output / "build.log").open("wb") as log:
        subprocess.run(cmd, cwd=source, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    archive = output / "unsigned" / f"T3-Code-{VERSION}-arm64.zip"
    payload = output / "payload"
    payload.mkdir()
    run(["ditto", "-x", "-k", archive, payload])
    app = payload / NAME
    if not app.is_dir():
        raise ValueError("Wrong product identity in generated ZIP")
    if args.kind == "diagnostic":
        # This only establishes a complete resource seal. It never makes the
        # diagnostic a trusted release and the app is never launched here.
        run(["node", Path(__file__).with_name("seal-diagnostic.mjs"), source, app])
    payload_check = run(["node", Path(__file__).with_name("verify-payload.mjs"), source, app, INSTALLED])
    (output / "payload-verification.json").write_bytes(payload_check.stdout)
    result = inspect(app)
    result["source"] = receipt
    result["kind"] = args.kind
    if result["updateFeedPresent"]:
        raise ValueError("Unexpected update feed in private native candidate")
    if not result["identityMatches"] or result["checks"]["strict"]["exit"]:
        raise ValueError("Candidate package identity or resource seal failed")
    if args.kind == "trusted" and not result["trusted"]:
        (output / "verification.json").write_text(json.dumps(result, indent=2) + "\n")
        raise ValueError("Trusted release checks failed; do not install")
    package = output / f"T3-Code-{VERSION}-vault-native-{args.kind}-arm64.zip"
    run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", app, package])
    result.update(package=str(package), packageSha256=digest(package), packageBytes=package.stat().st_size)
    (output / "verification.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: result[k] for k in ("package", "packageSha256", "trusted", "kind")}, indent=2))


def backup(args):
    original = inspect(INSTALLED)
    if not original["trusted"]:
        raise ValueError("Installed app is not the approved trusted target")
    output = fresh(args.output)
    archive = output / f"T3-Code-{VERSION}-original-signed.zip"
    run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", INSTALLED, archive])
    extracted = output / "verified-rollback"
    extracted.mkdir()
    run(["ditto", "-x", "-k", archive, extracted])
    restored = inspect(extracted / NAME)
    if not restored["trusted"]:
        raise ValueError("Rollback copy failed trust verification")
    result = {"archive": str(archive), "sha256": digest(archive), "original": original, "restored": restored,
              "scope": "Application bundle only; no user data, profiles or Keychain copied or changed"}
    (output / "rollback.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"archive": str(archive), "sha256": result["sha256"], "verified": True}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="action", required=True)
    verify = subs.add_parser("verify")
    verify.add_argument("app")
    verify.add_argument("--require-trusted", action="store_true")
    pack = subs.add_parser("build")
    pack.add_argument("--source", required=True)
    pack.add_argument("--output", required=True)
    pack.add_argument("--kind", choices=("diagnostic", "trusted"), required=True)
    save = subs.add_parser("backup")
    save.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.action == "build":
        build(args)
    elif args.action == "backup":
        backup(args)
    else:
        result = inspect(args.app)
        print(json.dumps(result, indent=2))
        if args.require_trusted and not result["trusted"]:
            return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, subprocess.CalledProcessError) as error:
        # Do not echo child output, command environments or private signing inputs.
        print(str(error) if isinstance(error, ValueError) else "Delivery command failed; inspect the scoped build log", file=sys.stderr)
        sys.exit(1)
