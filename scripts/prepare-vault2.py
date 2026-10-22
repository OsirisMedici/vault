#!/usr/bin/env python3
"""Prepare Vault 2 web branding in a new candidate; never edit upstream."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
BRANDING = ROOT / "branding" / "vault2"


def git(path: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(path), *args], text=True).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(".cache/vault2/source"))
    args = parser.parse_args()
    upstream = args.upstream.expanduser().resolve()
    output = (ROOT / args.output).resolve()
    pin = json.loads((BRANDING / "upstream.json").read_text())
    if not output.is_relative_to(ROOT / ".cache") or output == ROOT / ".cache":
        parser.error("output must be a new directory below this repository's .cache")
    if output.exists():
        parser.error("output already exists; choose another candidate path")
    if git(upstream, "rev-parse", "HEAD") != pin["commit"]:
        parser.error("upstream must be at the exact pinned commit")
    if git(upstream, "status", "--porcelain=v1"):
        parser.error("upstream must be clean, including untracked files")
    if git(upstream, "remote", "get-url", "origin") != pin["repository"]:
        parser.error("upstream origin does not match the reviewed repository")
    patch = BRANDING / "source.patch"
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "clone", "--no-hardlinks", "--no-checkout", str(upstream), str(output)],
        check=True,
    )
    subprocess.run(["git", "-C", str(output), "checkout", "--detach", pin["commit"]], check=True)
    subprocess.run(["git", "-C", str(output), "apply", "--check", str(patch)], check=True)
    subprocess.run(["git", "-C", str(output), "apply", str(patch)], check=True)
    receipt = {
        "product": "Vault 2",
        "upstream": pin,
        "patchSHA256": hashlib.sha256(patch.read_bytes()).hexdigest(),
        "scope": "web branding, shared theme, responsive presentation and preview configuration",
        "dependenciesInstalled": False,
        "runtimeStarted": False,
    }
    (output / ".vault2-source.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(f"Vault 2 candidate prepared: {output}")
    print("Upstream was not modified. No runtime, credentials or installed app were changed.")


if __name__ == "__main__":
    main()
