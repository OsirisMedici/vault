"""Transactional policy rehearsal; no credentials, network or execution adapters.

Trusted embedding code supplies immutable policy and authenticated caller bindings.
Nothing in this module authenticates a person or a connection. Do not expose its
methods directly as agent tools or accept policy/caller/capability data from an
agent. Production authorization is deliberately unavailable in this slice.
SPDX-License-Identifier: GPL-3.0-only
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import sqlite3
import time
from typing import Callable
from urllib.parse import urlsplit
from uuid import UUID, uuid4


ACTIONS = frozenset({"account.discover", "login.use", "app.read", "app.write",
                     "app.send", "app.delete", "app.billing", "app.security"})
FRESH_APPROVAL = ACTIONS - {"account.discover", "login.use", "app.read"}
CLEANUP_TARGETS = ("broker", "connection_auth", "native_access", "target_sessions",
                   "credential_rotation_review")


def opaque(value: str) -> None:
    """Accept canonical opaque UUIDs only, never labels, URLs or free-form logs."""
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise ValueError("expected canonical opaque UUID")


def instant(value: int) -> None:
    if type(value) is not int or value < 0:
        raise ValueError("expected nonnegative integer server time")


def origin(value: str) -> None:
    parts = urlsplit(value)
    if (parts.scheme != "https" or not parts.hostname or parts.username or parts.password
            or parts.path or parts.query or parts.fragment
            or value != f"https://{parts.netloc}" or parts.hostname != parts.hostname.lower()
            or any(c.isspace() for c in value)):
        raise ValueError("expected exact HTTPS origin without path or credentials")
    # Reject invalid ports here, rather than during a future runtime operation.
    _ = parts.port


@dataclass(frozen=True)
class Person:
    id: str


@dataclass(frozen=True)
class Workspace:
    id: str
    organization_id: str
    owner_id: str


@dataclass(frozen=True)
class Connection:
    id: str
    sponsor_id: str
    device_id: str
    runtime_id: str
    issuer_id: str
    audience_id: str
    workspace_ids: tuple[str, ...]
    expires_at: int


@dataclass(frozen=True)
class Resource:
    id: str
    workspace_id: str
    cipher_id: str
    destination_id: str
    https_origin: str
    tenant_id: str
    target_account_id: str
    version: int


@dataclass(frozen=True)
class HumanScope:
    """Explicit broker delegation authority; does not share native keys/items."""
    id: str
    person_id: str
    resource_id: str
    actions: tuple[str, ...]
    expires_at: int


@dataclass(frozen=True)
class Grant:
    id: str
    connection_id: str
    operator_id: str
    resource_id: str
    actions: tuple[str, ...]
    approver_id: str
    starts_at: int
    expires_at: int
    version: int


@dataclass(frozen=True)
class FixtureCapability:
    """A test declaration, never evidence of an actual restricted runtime."""
    runtime_id: str
    resource_id: str
    action: str
    operation_id: str


@dataclass(frozen=True)
class Policy:
    version: int
    people: tuple[Person, ...]
    workspaces: tuple[Workspace, ...]
    connections: tuple[Connection, ...]
    resources: tuple[Resource, ...]
    human_scopes: tuple[HumanScope, ...]
    grants: tuple[Grant, ...]
    fixture_capabilities: tuple[FixtureCapability, ...] = ()

    def validate(self) -> None:
        if type(self.version) is not int or self.version < 1:
            raise ValueError("invalid policy version")
        if any(type(rows) is not tuple for rows in (
                self.people, self.workspaces, self.connections, self.resources,
                self.human_scopes, self.grants, self.fixture_capabilities)):
            raise ValueError("policy collections must be immutable tuples")
        ids = set()
        for rows in (self.people, self.workspaces, self.connections, self.resources,
                     self.human_scopes, self.grants):
            for row in rows:
                for key, value in asdict(row).items():
                    if key == "id" or key.endswith("_id"):
                        opaque(value)
                    elif key == "workspace_ids":
                        if type(value) is not tuple:
                            raise ValueError("workspace scope must be immutable")
                        for item in value:
                            opaque(item)
                    elif key.endswith("_at"):
                        instant(value)
                    elif key == "version" and (type(value) is not int or value < 1):
                        raise ValueError("invalid resource/grant version")
                if row.id in ids:
                    raise ValueError("duplicate policy ID")
                ids.add(row.id)
        people = {p.id for p in self.people}
        workspaces = {w.id for w in self.workspaces}
        resources = {r.id for r in self.resources}
        connections = {c.id: c for c in self.connections}
        if len({w.organization_id for w in self.workspaces}) != len(self.workspaces):
            raise ValueError("organization must map to one workspace")
        for w in self.workspaces:
            if w.owner_id not in people:
                raise ValueError("unknown workspace owner")
        for c in self.connections:
            if c.sponsor_id not in people or not set(c.workspace_ids) <= workspaces:
                raise ValueError("unknown connection scope")
        for r in self.resources:
            origin(r.https_origin)
            if r.workspace_id not in workspaces:
                raise ValueError("unknown resource workspace")
        for s in self.human_scopes:
            if s.person_id not in people or s.resource_id not in resources:
                raise ValueError("unknown human scope")
        for g in self.grants:
            if (g.connection_id not in connections or g.operator_id not in people
                    or g.approver_id not in people or g.resource_id not in resources
                    or g.starts_at >= g.expires_at):
                raise ValueError("invalid grant references or lifetime")
        for row in (*self.human_scopes, *self.grants):
            if type(row.actions) is not tuple or not row.actions or not set(row.actions) <= ACTIONS:
                raise ValueError("unsupported action; reveal/export/manage are unavailable")
        for cap in self.fixture_capabilities:
            opaque(cap.runtime_id)
            opaque(cap.resource_id)
            opaque(cap.operation_id)
            if cap.action not in ACTIONS or cap.resource_id not in resources:
                raise ValueError("invalid fixture capability")


@dataclass(frozen=True)
class Caller:
    """Host-authenticated identity binding; request text is never this authority."""
    person_id: str
    connection_id: str
    device_id: str
    runtime_id: str
    issuer_id: str
    audience_id: str


@dataclass(frozen=True)
class Request:
    id: str
    run_id: str
    grant_id: str
    workspace_id: str
    resource_id: str
    destination_id: str
    tenant_id: str
    target_account_id: str
    action: str
    operation_id: str
    payload_ref: str
    policy_version: int
    resource_version: int
    grant_version: int
    expires_at: int

    def validate(self, caller: Caller) -> None:
        for key, value in {**asdict(self), **asdict(caller)}.items():
            if key == "id" or key.endswith("_id") or key == "payload_ref":
                opaque(value)
            elif key == "expires_at":
                instant(value)
            elif key.endswith("_version") and (type(value) is not int or value < 1):
                raise ValueError("invalid request version")
        # Unknown action strings are denied, never copied into the audit trail.
        if not isinstance(self.action, str):
            raise ValueError("invalid action")


@dataclass(frozen=True)
class Decision:
    status: str
    reason: str
    operation_id: str | None = None
    lease_end: int | None = None


class StoreUnavailable(RuntimeError):
    """No policy permission may be used after this exception."""


class PolicyStore:
    """Local policy state machine, with atomic approvals, reservations and audit.

    Configuration is immutable and fingerprinted into the database. Changes need
    a new reviewed store; they cannot carry old approvals forward. Revocations are
    durable and monotonic. No restore, key custody or identity enrollment API.
    """

    def __init__(self, database: Path, policy: Policy, *,
                 clock: Callable[[], int] = lambda: int(time.time())):
        policy.validate()
        self.policy, self.clock = policy, clock
        self.db = sqlite3.connect(database, isolation_level=None, timeout=5)
        self.db.row_factory = sqlite3.Row
        try:
            self._initialize()
        except BaseException:
            self.db.close()
            raise

    def _initialize(self) -> None:
        self.db.executescript("""
            PRAGMA foreign_keys=ON;
            PRAGMA synchronous=FULL;
            CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1), fingerprint TEXT, last_time INTEGER);
            CREATE TABLE IF NOT EXISTS revoked (kind TEXT, id TEXT, PRIMARY KEY(kind,id));
            CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, binding TEXT, approver TEXT, expires INTEGER, consumed INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, request_id TEXT UNIQUE, binding TEXT, lease_end INTEGER, state TEXT);
            CREATE TABLE IF NOT EXISTS audit (sequence INTEGER PRIMARY KEY, time INTEGER, event TEXT, details TEXT);
            CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'append only'); END;
            CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'append only'); END;
        """)
        fingerprint = self._digest(asdict(self.policy))
        with self._transaction():
            previous = self.db.execute("SELECT fingerprint FROM meta WHERE id=1").fetchone()
            if previous and previous[0] != fingerprint:
                raise ValueError("policy changed; existing approvals cannot migrate implicitly")
            self.db.execute("INSERT OR IGNORE INTO meta VALUES (1,?,0)", (fingerprint,))

    def close(self) -> None:
        self.db.close()

    @staticmethod
    def _digest(data: dict) -> str:
        return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    @contextmanager
    def _transaction(self):
        try:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                yield
            except ApprovalDenied:
                # Business denials must retain their audit event. A failed audit
                # insert raises sqlite3.Error instead and rolls everything back.
                self.db.execute("COMMIT")
                raise
            self.db.execute("COMMIT")
        except BaseException as exc:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            if isinstance(exc, sqlite3.Error):
                raise StoreUnavailable("policy/audit transaction unavailable") from None
            raise

    def _now(self) -> int:
        now = self.clock()
        instant(now)
        previous = self.db.execute("SELECT last_time FROM meta WHERE id=1").fetchone()[0]
        if now < previous:
            raise StoreUnavailable("server clock moved backwards")
        self.db.execute("UPDATE meta SET last_time=? WHERE id=1", (now,))
        return now

    def _audit(self, now: int, event: str, **details) -> None:
        # Call sites construct fixed fields from validated opaque IDs/enums only.
        self.db.execute("INSERT INTO audit(time,event,details) VALUES (?,?,?)",
                        (now, event, json.dumps(details, sort_keys=True)))

    def _revoked(self, kind: str, id: str) -> bool:
        return self.db.execute("SELECT 1 FROM revoked WHERE kind=? AND id=?", (kind, id)).fetchone() is not None

    def _binding(self, request: Request, caller: Caller) -> str:
        return self._digest({"request": asdict(request), "caller": asdict(caller)})

    def _check(self, r: Request, c: Caller, now: int) -> str:
        p = self.policy
        grant = next((g for g in p.grants if g.id == r.grant_id), None)
        resource = next((a for a in p.resources if a.id == r.resource_id), None)
        connection = next((x for x in p.connections if x.id == c.connection_id), None)
        if r.action not in ACTIONS:
            return "action_unsupported"
        if not grant or not resource or not connection:
            return "scope_unknown"
        if (grant.connection_id != c.connection_id or grant.operator_id != c.person_id
                or grant.resource_id != resource.id or r.workspace_id != resource.workspace_id
                or r.workspace_id not in connection.workspace_ids):
            return "scope_mismatch"
        if any(self._revoked(kind, id) for kind, id in (
                ("person", c.person_id), ("person", connection.sponsor_id),
                ("person", grant.approver_id), ("connection", c.connection_id),
                ("workspace", r.workspace_id), ("resource", resource.id), ("grant", grant.id))):
            return "revoked"
        if (c.device_id, c.runtime_id, c.issuer_id, c.audience_id) != (
                connection.device_id, connection.runtime_id, connection.issuer_id, connection.audience_id):
            return "connection_binding_mismatch"
        if (r.policy_version, r.resource_version, r.grant_version) != (p.version, resource.version, grant.version):
            return "version_stale"
        if (r.destination_id, r.tenant_id, r.target_account_id) != (
                resource.destination_id, resource.tenant_id, resource.target_account_id):
            return "destination_mismatch"
        if not grant.starts_at <= now < min(grant.expires_at, connection.expires_at, r.expires_at):
            return "expired_or_not_started"
        if r.action not in grant.actions:
            return "action_not_granted"
        for person in {c.person_id, connection.sponsor_id}:
            if not any(s.person_id == person and s.resource_id == resource.id
                       and r.action in s.actions and now < s.expires_at
                       and not self._revoked("human_scope", s.id) for s in p.human_scopes):
                return "human_authority_missing"
        if not any((cap.runtime_id, cap.resource_id, cap.action, cap.operation_id) ==
                   (c.runtime_id, resource.id, r.action, r.operation_id) for cap in p.fixture_capabilities):
            return "runtime_unsupported"
        return "eligible"

    def _decision_audit(self, now: int, r: Request, c: Caller, reason: str, **extra) -> None:
        connection = next((x for x in self.policy.connections if x.id == c.connection_id), None)
        self._audit(now, "decision", request_id=r.id, run_id=r.run_id,
                    person_id=c.person_id, sponsor_id=connection.sponsor_id if connection else None,
                    connection_id=c.connection_id, device_id=c.device_id, runtime_id=c.runtime_id,
                    workspace_id=r.workspace_id, resource_id=r.resource_id,
                    destination_id=r.destination_id, grant_id=r.grant_id,
                    policy_version=r.policy_version, resource_version=r.resource_version,
                    grant_version=r.grant_version,
                    action=r.action if r.action in ACTIONS else "unsupported", reason=reason, **extra)

    def authorize(self, request: Request, caller: Caller) -> Decision:
        """Fail closed for every real execution until reviewed integrations exist."""
        request.validate(caller)
        with self._transaction():
            now = self._now()
            self._decision_audit(now, request, caller, "integration_unavailable")
            return Decision("denied", "integration_unavailable")

    def approve_fixture(self, request: Request, caller: Caller, *, human_id: str,
                        expires_at: int) -> str:
        """Rehearse a trusted human approval. This does not authenticate a human."""
        request.validate(caller)
        opaque(human_id)
        instant(expires_at)
        with self._transaction():
            now = self._now()
            grant = next((g for g in self.policy.grants if g.id == request.grant_id), None)
            reason = self._check(request, caller, now)
            if reason == "eligible" and (not grant or human_id != grant.approver_id):
                reason = "wrong_approver"
            if reason == "eligible" and not now < expires_at <= min(now + 120, request.expires_at, grant.expires_at):
                reason = "approval_deadline_invalid"
            if reason != "eligible":
                self._decision_audit(now, request, caller, reason, attempted_approver_id=human_id)
                raise ApprovalDenied(reason)
            approval_id = str(uuid4())
            self.db.execute("INSERT INTO approvals(id,binding,approver,expires) VALUES (?,?,?,?)",
                            (approval_id, self._binding(request, caller), human_id, expires_at))
            self._audit(now, "fixture_approval", approval_id=approval_id, request_id=request.id,
                        approver_id=human_id, expires_at=expires_at)
            return approval_id

    def reserve_fixture(self, request: Request, caller: Caller, *, approval_id: str | None = None) -> Decision:
        """Reserve a simulated operation once. Never executes or yields a token.

        A repeated request is reported as replay, including after an unknown
        outcome. The caller must reconcile; a retry is never permission to act.
        """
        request.validate(caller)
        if approval_id is not None:
            opaque(approval_id)
        with self._transaction():
            now = self._now()
            reason = self._check(request, caller, now)
            binding = self._binding(request, caller)
            existing = self.db.execute("SELECT * FROM operations WHERE request_id=?", (request.id,)).fetchone()
            if reason == "eligible" and existing:
                reason = "request_replayed" if existing["binding"] == binding else "request_id_conflict"
            if reason == "eligible" and (request.action in FRESH_APPROVAL or approval_id is not None):
                approval = self.db.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
                if not approval or approval["binding"] != binding or approval["expires"] <= now or approval["consumed"]:
                    reason = "approval_required_or_invalid"
                else:
                    self.db.execute("UPDATE approvals SET consumed=1 WHERE id=?", (approval_id,))
            if reason != "eligible":
                self._decision_audit(now, request, caller, reason)
                return Decision("denied", reason)
            grant = next(g for g in self.policy.grants if g.id == request.grant_id)
            connection = next(c for c in self.policy.connections if c.id == caller.connection_id)
            # Every valid contributing human scope bounds this operation's lease.
            scope_ends = [max(s.expires_at for s in self.policy.human_scopes
                              if s.person_id == person and s.resource_id == request.resource_id
                              and request.action in s.actions and now < s.expires_at
                              and not self._revoked("human_scope", s.id))
                          for person in {caller.person_id, connection.sponsor_id}]
            lease_end = min(now + 300, request.expires_at, grant.expires_at, connection.expires_at, *scope_ends)
            operation_id = str(uuid4())
            self.db.execute("INSERT INTO operations VALUES (?,?,?,?,?)",
                            (operation_id, request.id, binding, lease_end, "reserved_fixture"))
            self._decision_audit(now, request, caller, "reserved_fixture", operation_id=operation_id,
                                 approval_id=approval_id, lease_end=lease_end)
            return Decision("reserved_fixture", "policy_checks_passed_fixture_only", operation_id, lease_end)

    def recheck_fixture(self, operation_id: str, request: Request, caller: Caller) -> Decision:
        """Recheck at a simulated sensitive boundary; a lease never bypasses policy."""
        opaque(operation_id)
        request.validate(caller)
        with self._transaction():
            now = self._now()
            op = self.db.execute("SELECT * FROM operations WHERE id=?", (operation_id,)).fetchone()
            reason = self._check(request, caller, now)
            if reason == "eligible" and (not op or op["binding"] != self._binding(request, caller)
                                          or op["lease_end"] <= now or op["state"] != "reserved_fixture"):
                reason = "operation_invalid_or_closed"
            self._decision_audit(now, request, caller, reason, operation_id=operation_id)
            return Decision("eligible_fixture" if reason == "eligible" else "denied", reason)

    def finish_fixture(self, operation_id: str, outcome: str) -> None:
        opaque(operation_id)
        if outcome not in {"completed_fixture", "failed_fixture", "unknown_fixture"}:
            raise ValueError("unsupported outcome")
        with self._transaction():
            now = self._now()
            changed = self.db.execute("UPDATE operations SET state=? WHERE id=? AND state='reserved_fixture'",
                                      (outcome, operation_id)).rowcount
            if not changed:
                raise ValueError("operation missing or already closed; reconcile before retry")
            self._audit(now, "fixture_outcome", operation_id=operation_id, outcome=outcome)

    def revoke(self, kind: str, id: str, *, human_id: str) -> dict:
        """Policy-only revocation by an affected workspace owner. No external calls."""
        opaque(id)
        opaque(human_id)
        rows = {"person": self.policy.people, "connection": self.policy.connections,
                "workspace": self.policy.workspaces, "resource": self.policy.resources,
                "grant": self.policy.grants, "human_scope": self.policy.human_scopes}
        if kind not in rows or not any(x.id == id for x in rows[kind]):
            raise ValueError("unknown revocation target")
        workspaces = self._affected_workspaces(kind, id)
        with self._transaction():
            now = self._now()
            owners = {w.owner_id for w in self.policy.workspaces if w.id in workspaces}
            if not owners or owners != {human_id} or self._revoked("person", human_id):
                self._audit(now, "revocation_denied", actor_id=human_id, target_id=id)
                raise ApprovalDenied("workspace_owner_required")
            self.db.execute("INSERT OR IGNORE INTO revoked VALUES (?,?)", (kind, id))
            result = {"policy": "blocked", **{target: "unverified" for target in CLEANUP_TARGETS}}
            self._audit(now, "policy_revocation", actor_id=human_id, target_kind=kind,
                        target_id=id, cleanup=result)
            return result

    def _affected_workspaces(self, kind: str, id: str) -> set[str]:
        if kind == "workspace":
            return {id}
        if kind == "connection":
            return set(next(c.workspace_ids for c in self.policy.connections if c.id == id))
        if kind == "person":
            resources = {s.resource_id for s in self.policy.human_scopes if s.person_id == id}
            resources |= {g.resource_id for g in self.policy.grants if id in (g.operator_id, g.approver_id)}
            workspaces = {w for c in self.policy.connections if c.sponsor_id == id for w in c.workspace_ids}
            return workspaces | {r.workspace_id for r in self.policy.resources if r.id in resources}
        resource_id = id if kind == "resource" else next(
            x.resource_id for x in (self.policy.grants if kind == "grant" else self.policy.human_scopes) if x.id == id)
        return {r.workspace_id for r in self.policy.resources if r.id == resource_id}

    def audit_records(self) -> list[dict]:
        """Trusted-host diagnostic; future audit-reader authorization is not supplied."""
        return [dict(row) for row in self.db.execute("SELECT * FROM audit ORDER BY sequence")]


class ApprovalDenied(ValueError):
    pass
