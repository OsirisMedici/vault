#!/usr/bin/env python3
"""Run a pinned, dummy-only Agent Vault evaluation outside the Vault checkout."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

REVISION = "d5836ec3bb2315de38043d742ae5daca11a4944a"
REPOSITORY = "https://github.com/Infisical/agent-vault.git"
PACKAGES = ["./internal/" + name for name in
            ("broker", "mitm", "server", "store", "crypto", "auth")]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--go", default="go", help="Go 1.26.10 or newer executable")
    parser.add_argument("--source", type=Path, help="Optional clean checkout at the pinned revision")
    parser.add_argument("--cache-dir", type=Path, help="Optional disposable Go cache directory")
    parser.add_argument("--results", type=Path, help="Write non-secret JSON test results")
    args = parser.parse_args()
    go = shutil.which(args.go)
    if not go:
        parser.error("Go is unavailable; provide --go /absolute/path/to/go")
    with tempfile.TemporaryDirectory(prefix="vault-agent-vault-") as temporary:
        work = Path(temporary)
        source = args.source.resolve() if args.source else work / "upstream"
        if not args.source:
            subprocess.run(["git", "init", "-q", str(source)], check=True)
            subprocess.run(["git", "-C", str(source), "fetch", "--depth=1", REPOSITORY, REVISION], check=True)
            subprocess.run(["git", "-C", str(source), "checkout", "-q", "--detach", "FETCH_HEAD"], check=True)
        revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
        status = subprocess.check_output(["git", "-C", str(source), "status", "--porcelain", "--untracked-files=all"], text=True)
        if revision != REVISION or status:
            parser.error("Upstream must be clean and exactly at " + REVISION)
        candidate = work / "candidate"
        shutil.copytree(source, candidate, symlinks=True,
                        ignore=shutil.ignore_patterns(".git", "node_modules"))
        fixture = Path(__file__).with_name("evaluation_test.go.txt")
        shutil.copyfile(fixture, candidate / "internal/server/vault_evaluation_test.go")
        cache = args.cache_dir.resolve() if args.cache_dir else work / "cache"
        # Do not inherit any real broker, database, provider or SMTP configuration.
        environment = {key: value for key, value in os.environ.items()
                       if not key.startswith(("AGENT_VAULT_", "INFISICAL_", "POSTHOG_"))
                       and key != "DATABASE_URL"}
        environment.update(GOCACHE=str(cache / "build"), GOMODCACHE=str(cache / "modules"),
                           AGENT_VAULT_TELEMETRY="false", GOTOOLCHAIN="local")
        summary = {"revision": revision,
                   "go": subprocess.check_output([go, "version"], text=True).strip(),
                   "dummy_only": True, "runs": []}
        for name, directory, selection in [
            ("upstream", source, PACKAGES),
            ("vault_evaluation", candidate, ["-run", "^TestVaultEvaluation$", "./internal/server"]),
        ]:
            print("Running " + name, flush=True)
            process = subprocess.run([go, "test", "-json", "-count=1", "-timeout=120s", *selection],
                                     cwd=directory, env=environment, text=True,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            events = []
            for line in process.stdout.splitlines():
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                # Persist test identities and outcomes, never arbitrary test output.
                if event.get("Action") in ("pass", "fail", "skip"):
                    events.append({key: event[key] for key in
                                   ("Action", "Package", "Test", "Elapsed") if key in event})
            tests = [event for event in events if "Test" in event]
            result = {"name": name, "exit_code": process.returncode,
                      "counts": {action: sum(event["Action"] == action for event in tests)
                                 for action in ("pass", "fail", "skip")},
                      "packages": [event for event in events if "Test" not in event],
                      "failed_or_skipped_tests": [event for event in tests if event["Action"] != "pass"]}
            if name == "vault_evaluation":
                result["checks"] = tests
            summary["runs"].append(result)
            print(name + (" passed" if process.returncode == 0 else " failed"), flush=True)
        if args.results:
            args.results.parent.mkdir(parents=True, exist_ok=True)
            args.results.write_text(json.dumps(summary, indent=2) + "\n")
        failures = [run for run in summary["runs"] if run["exit_code"]]
        if failures:
            raise SystemExit("Evaluation failed; JSON includes failed test identities. No acceptance claimed.")
        print("Evaluation passed. Temporary candidate, database, CA and listeners were cleaned up.")


if __name__ == "__main__":
    main()
