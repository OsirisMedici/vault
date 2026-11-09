"""Disposable Karen workload. Everything it writes is untrusted broker input."""
import json
import os
import socket
import sys


def rpc(**payload):
    print(json.dumps(payload), flush=True)
    return json.loads(sys.stdin.readline(8192))


def no_read(path):
    try:
        with open(path, "rb") as file:
            file.read(1)
        return False
    except OSError:
        return True


def no_connection(address):
    family = socket.AF_UNIX if isinstance(address, str) else socket.AF_INET
    with socket.socket(family, socket.SOCK_STREAM) as client:
        client.settimeout(0.5)
        try:
            client.connect(address)
            return False
        except OSError:
            return True


def probe(path, owner_port, debug_port):
    report = {
        "uid": os.getuid(),
        "interfaces": sorted(os.listdir("/sys/class/net")),
        "trusted_file_denied": no_read(path),
        "host_env_absent": "PILOT_OWNER_CANARY" not in os.environ,
        "vault_session_absent": "BW_SESSION" not in os.environ,
        "docker_cli_absent": not any(os.path.isfile(p) for p in (
            "/usr/bin/docker", "/usr/local/bin/docker", "/bin/docker"
        )),
        "docker_socket_denied": no_connection("/var/run/docker.sock"),
        "host_owner_denied": all(no_connection((host, int(owner_port))) for host in (
            "127.0.0.1", "192.168.5.2", "172.17.0.1",
        )),
        "host_browser_denied": all(no_connection((host, int(debug_port))) for host in (
            "127.0.0.1", "192.168.5.2", "172.17.0.1",
        )),
        "host_namespace_denied": no_read("/proc/1/root" + path),
        "root_escalation_denied": False,
        "root_write_denied": False,
    }
    try:
        os.setuid(0)
    except PermissionError:
        report["root_escalation_denied"] = True
    try:
        with open("/tmp/pilot-test", "w"):
            pass
    except OSError:
        report["root_write_denied"] = True
    with open("/proc/self/status") as file:
        status = dict(line.rstrip().split(":\t", 1) for line in file if ":\t" in line)
    report["capabilities_dropped"] = int(status["CapEff"], 16) == 0
    report["no_new_privileges"] = status["NoNewPrivs"] == "1"
    print(json.dumps(report), flush=True)


mode, *args = sys.argv[1:]
if mode == "probe":
    probe(*args)
elif mode == "exercise":
    a, b = args
    rpc(op="list")
    rpc(op="read", accountId=b)
    rpc(op="read", accountId="00000000-0000-0000-0000-000000000000")
    rpc(op="private_fill", accountId=b)
    rpc(op="read", accountId=a, url="https://outside.invalid/")
    rpc(op="read", accountId=b, agentId="owner")
    rpc(op="owner_revoke", accountId=a)
    rpc(op="browser_debug")
    rpc(op="read", accountId=a)
elif mode == "read":
    rpc(op="read", accountId=args[0])
elif mode == "list":
    rpc(op="list")
else:
    raise ValueError("unknown worker mode")
