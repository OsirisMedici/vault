"""Harmless in-memory source rehearsal; no actual people/accounts or broker.
SPDX-License-Identifier: GPL-3.0-only
"""

from dataclasses import replace
import json
from pathlib import Path
from uuid import UUID

from .policy import (Caller, Connection, FixtureCapability, Grant, HumanScope,
                     Person, Policy, PolicyStore, Request, Resource, Workspace)


def uid(number: int) -> str:
    return str(UUID(int=number))


def sample_policy() -> Policy:
    """Two operators, separate workspaces/connections; one fixture owner."""
    actions = ("login.use", "app.read", "app.write")
    return Policy(
        version=1,
        people=(Person(uid(1)), Person(uid(2)), Person(uid(3))),
        workspaces=(Workspace(uid(10), uid(11), uid(1)), Workspace(uid(20), uid(21), uid(1))),
        connections=tuple(Connection(uid(n), uid(person), uid(n+1), uid(n+2), uid(90), uid(91),
                                     (uid(workspace),), 2000)
                          for n, person, workspace in ((30, 2, 10), (40, 3, 20))),
        resources=tuple(Resource(uid(n), uid(workspace), uid(n+1), uid(n+2),
                                 "https://fixture.invalid", uid(n+3), uid(n+4), 1)
                        for n, workspace in ((50, 10), (60, 20))),
        human_scopes=(HumanScope(uid(70), uid(2), uid(50), actions, 1900),
                      HumanScope(uid(71), uid(3), uid(60), actions, 1900)),
        grants=(Grant(uid(80), uid(30), uid(2), uid(50), actions, uid(1), 900, 1800, 1),
                Grant(uid(81), uid(40), uid(3), uid(60), actions, uid(1), 900, 1800, 1)),
        fixture_capabilities=tuple(FixtureCapability(uid(runtime), uid(resource), action, uid(95))
                                   for runtime, resource in ((32, 50), (42, 60)) for action in actions),
    )


def sample_request(*, second: bool = False, action: str = "app.write") -> tuple[Request, Caller]:
    n, person, workspace, resource, grant = (40, 3, 20, 60, 81) if second else (30, 2, 10, 50, 80)
    return (Request(uid(100 + int(second)), uid(110), uid(grant), uid(workspace), uid(resource),
                    uid(resource+2), uid(resource+3), uid(resource+4), action, uid(95), uid(120),
                    1, 1, 1, 1500),
            Caller(uid(person), uid(n), uid(n+1), uid(n+2), uid(90), uid(91)))


def main() -> None:
    store = PolicyStore(Path(":memory:"), sample_policy(), clock=lambda: 1000)
    request, caller = sample_request()
    other, other_caller = sample_request(second=True)
    results = {"notice": "FIXTURE ONLY: no authentication, unlock, browser, or target operation"}
    try:
        results["production_entry"] = store.authorize(request, caller).__dict__
        results["without_approval"] = store.reserve_fixture(request, caller).__dict__
        approval = store.approve_fixture(request, caller, human_id=uid(1), expires_at=1100)
        reserved = store.reserve_fixture(request, caller, approval_id=approval)
        results["approved_fixture"] = reserved.__dict__
        results["replay"] = store.reserve_fixture(request, caller, approval_id=approval).__dict__
        results["cross_workspace"] = store.reserve_fixture(other, caller).__dict__
        results["password_reveal"] = store.reserve_fixture(replace(request, action="secret.reveal"), caller).__dict__
        results["revocation"] = store.revoke("connection", uid(30), human_id=uid(1))
        results["revoked_in_flight"] = store.recheck_fixture(reserved.operation_id, request, caller).__dict__
        results["other_connection"] = store.reserve_fixture(replace(other, action="app.read"), other_caller).__dict__
        results["audit_event_count"] = len(store.audit_records())
        print(json.dumps(results, indent=2))
    finally:
        store.close()


if __name__ == "__main__":
    main()
