#!/usr/bin/env python3
"""Prepare a fresh pinned UI candidate with the owned, frozen Bun web toolchain."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tooling/agent-web"
spec = importlib.util.spec_from_file_location("agent_web_source", ROOT / "scripts/prepare-agent-web.py")
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)


def regular(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise ValueError(f"Expected an unlinked regular candidate file: {path}")


def prepare(source, output):
    # Reject lexical escapes and symlinked parents before the UI copier resolves paths.
    output = Path(os.path.abspath(output))
    cache = ROOT / ".cache"
    if not output.is_relative_to(cache) or output == cache:
        raise ValueError("Output must be a fresh directory below this worktree's .cache")
    for parent in [output, *output.parents]:
        if parent.is_symlink():
            raise ValueError(f"Output path must not contain symlinks: {parent}")
        if parent == ROOT:
            break
    source = source.resolve(strict=True)
    pin = json.loads((TOOLS / "pin.json").read_text())
    if json.loads((ROOT / "upstream.lock.json").read_text())["web"]["commit"] != pin["sourceCommit"]:
        raise ValueError("Tooling pin differs from upstream.lock.json; review tooling before upgrading")
    ui.verify_source(source, json.loads((ROOT / "upstream.lock.json").read_text())["web"])
    for name, expected in pin["sourceSha256"].items():
        if ui.digest(source / name) != expected:
            raise ValueError(f"Pinned source bytes changed: {name}")
    if ui.digest(TOOLS / "bun.lock") != pin["bunLockSha256"]:
        raise ValueError("Owned Bun lock changed; review conversion instead of regenerating automatically")
    bun = shutil.which("bun")
    if not bun or subprocess.check_output([bun, "--version"], text=True).strip() != pin["bunVersion"]:
        raise ValueError(f"This toolchain requires Bun {pin['bunVersion']}; no fallback is run")

    receipt = ui.prepare(source, output)
    for name in ["package.json", "package-lock.json", "apps/web/webpack.base.js"]:
        regular(output / name)
    if (output / "apps/desktop").exists() or (output / "apps/desktop").is_symlink():
        raise ValueError("This transformation only supports the reduced web export without desktop")
    package = json.loads((output / "package.json").read_text())
    lock = json.loads((output / "package-lock.json").read_text())
    original_lock = (output / "package-lock.json").read_bytes()
    absent = "apps/desktop/desktop_native/napi"
    dependency = "@bitwarden/desktop-napi"
    for entry in [package, lock["packages"][""]]:
        if entry["workspaces"].count(absent) != 1 or entry["dependencies"].get(dependency) != f"file:{absent}":
            raise ValueError("Desktop workspace/dependency shape changed; review the pinned export")
        entry["workspaces"].remove(absent)
        del entry["dependencies"][dependency]
    for key in [absent, f"node_modules/{dependency}"]:
        if key not in lock["packages"]:
            raise ValueError(f"Expected absent desktop lock entry: {key}")
        del lock["packages"][key]
    package["packageManager"] = f"bun@{pin['bunVersion']}"
    (output / "package.json").write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n")
    (output / "package-lock.json").write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n")
    (output / "vault-agent-web-upstream-package-lock.json").write_bytes(original_lock)
    shutil.copyfile(source / "package.json", output / "vault-agent-web-upstream-package.json")
    shutil.copyfile(TOOLS / "bun.lock", output / "bun.lock")
    # Web compilation needs devDependencies. Never run desktop/native install hooks.
    (output / "bunfig.toml").write_text('[install]\nignoreScripts = true\nproduction = false\n')
    receipt.update({
        "toolingVersion": 1,
        "bunVersion": pin["bunVersion"],
        "toolingPinSha256": ui.digest(TOOLS / "pin.json"),
        "toolingSha256": {name: ui.digest(output / name) for name in [
            "package.json", "package-lock.json", "vault-agent-web-upstream-package.json",
            "vault-agent-web-upstream-package-lock.json", "bun.lock", "bunfig.toml",
        ]},
        "removedAbsentDesktopEntries": [absent, f"node_modules/{dependency}"],
    })
    (output / "vault-agent-web-tooling.json").write_text(json.dumps(receipt, indent=2) + "\n")
    # Verification is static. It neither installs dependencies nor compiles Angular.
    subprocess.run([bun, str(ROOT / "scripts/build-agent-web-bun.mjs"), "--check-lock", str(output)], check=True)
    ui.verify_source(source, json.loads((ROOT / "upstream.lock.json").read_text())["web"])
    return {"candidate": str(output), "bun": pin["bunVersion"], "installed": False, "built": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "upstream/web")
    parser.add_argument("--output", type=Path, default=ROOT / ".cache/agent-web-bun")
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.source, args.output), indent=2))
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Preparation stopped: {error}. Use a fresh output after correcting the cause.", file=sys.stderr)
        sys.exit(1)
