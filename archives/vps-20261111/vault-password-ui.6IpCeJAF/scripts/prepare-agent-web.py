#!/usr/bin/env python3
"""Copy pinned public OSS web source into a fresh ignored candidate and apply owned patches.

Does not install dependencies, build, deploy, or read private runtime configuration.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OWNED = ROOT / "branding/agent-web"
COMPONENTS = (
    "agent-vault.component.ts",
    "agent-vault.component.html",
    "agent-vault.service.ts",
)


def git(source, *args):
    return subprocess.check_output(["git", "-C", str(source), *args], text=True).strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_source(source, pin):
    # Reject an empty/uninitialized submodule which would otherwise resolve to the parent repo.
    if Path(git(source, "rev-parse", "--show-toplevel")).resolve() != source:
        raise ValueError("Source must be its own initialized public upstream checkout")
    if git(source, "rev-parse", "HEAD") != pin["commit"]:
        raise ValueError("Web source must match upstream.lock.json exactly")
    if git(source, "remote", "get-url", "origin") != pin["url"]:
        raise ValueError("Unexpected public web source origin")
    if git(source, "status", "--porcelain", "--untracked-files=all"):
        raise ValueError("Pinned web source must be clean")


def prepare(source, output):
    source = source.resolve(strict=True)
    output = output.resolve()
    cache = (ROOT / ".cache").resolve()
    if not output.is_relative_to(cache) or output == cache:
        raise ValueError("Output must be a new directory inside this project's .cache")
    if output.exists() or output.is_relative_to(source) or source.is_relative_to(output):
        raise ValueError("Use a fresh candidate path separate from the original source")
    pin = json.loads((ROOT / "upstream.lock.json").read_text())["web"]
    verify_source(source, pin)
    tracked = subprocess.check_output(["git", "-C", str(source), "ls-files", "-z"]).split(b"\0")
    output.mkdir(parents=True)
    # Copy only pinned, tracked public files. Ignored/private local files are never copied.
    # In particular, no .git metadata, node_modules, or generated build directories cross over.
    count = 0
    for raw in tracked:
        if not raw:
            continue
        relative = Path(os.fsdecode(raw))
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Invalid tracked source path")
        if any(part in {".git", "node_modules"} for part in relative.parts) or relative.parts[0] in {
            "build", "dist", "out", ".cache",
        }:
            continue
        original, target = source / relative, output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if original.is_symlink():
            if not original.resolve().is_relative_to(source):
                raise ValueError("Source symlink leaves the public checkout")
            # Rebase public internal links into the candidate, never back into pinned source.
            linked = output / original.resolve().relative_to(source)
            target.symlink_to(os.path.relpath(linked, target.parent))
        else:
            shutil.copy2(original, target)
        count += 1
    # --no-index makes application relative to this generated directory, even inside a worktree.
    patches = [ROOT / "branding/web-source.patch", OWNED / "source.patch"]
    for patch in patches:
        for check in [True, False]:
            command = ["git", "apply", "--no-index"]
            if check:
                command.append("--check")
            subprocess.run([*command, str(patch)], cwd=output, check=True)
    destination = output / "apps/web/src/app/agent-vault"
    destination.mkdir()
    for name in COMPONENTS:
        shutil.copy2(OWNED / "app" / name, destination / name)
    # Both modifications are in the OSS app. Preserve every original root license verbatim.
    licenses = list(source.glob("LICENSE*"))
    if not licenses or any(digest(path) != digest(output / path.name) for path in licenses if path.is_file()):
        raise ValueError("Original upstream license files must be preserved")
    verify_source(source, pin)
    receipt = {
        "sourceCommit": pin["commit"],
        "sourceOrigin": pin["url"],
        "copiedPublicFiles": count,
        "patchSha256": {str(path.relative_to(ROOT)): digest(path) for path in patches},
        "componentSha256": {name: digest(destination / name) for name in COMPONENTS},
        "dependenciesInstalled": False,
        "built": False,
        "deployed": False,
        "authenticatedAcceptance": False,
    }
    (output / "vault-agent-web-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "upstream/web")
    parser.add_argument("--output", type=Path, default=ROOT / ".cache/agent-web-source")
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.source, args.output), indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
