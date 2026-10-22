"""Adversarial source tests on synthetic IDs; no connected acceptance.
SPDX-License-Identifier: GPL-3.0-only
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from vault_access.fixtures import sample_policy, sample_request, uid
from vault_access.policy import ACTIONS, ApprovalDenied, HumanScope, PolicyStore, StoreUnavailable


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "fixture.sqlite"
        self.now = 1000
        self.policy = sample_policy()
        self.store = self.open()
        self.request, self.caller = sample_request()

    def open(self, policy=None):
        store = PolicyStore(self.path, policy or self.policy, clock=lambda: self.now)
        self.addCleanup(store.close)
        return store

    def approve(self, request=None, caller=None, **kwargs):
        return self.store.approve_fixture(request or self.request, caller or self.caller,
                                          human_id=kwargs.get("human_id", uid(1)),
                                          expires_at=kwargs.get("expires_at", 1100))

    def reserve(self, request=None, caller=None, approval=None):
        return self.store.reserve_fixture(request or self.request, caller or self.caller, approval_id=approval)

    def test_production_entry_denies_even_with_fixture_approval(self):
        self.approve()
        self.assertEqual(self.store.authorize(self.request, self.caller).reason, "integration_unavailable")

    def test_approval_and_single_use_reservation(self):
        self.assertEqual(self.reserve().reason, "approval_required_or_invalid")
        approval = self.approve()
        decision = self.reserve(approval=approval)
        self.assertEqual(decision.status, "reserved_fixture")
        self.assertEqual(decision.lease_end, 1300)
        self.assertEqual(self.reserve(approval=approval).reason, "request_replayed")

    def test_two_distinct_connections_only_have_their_own_scopes(self):
        other, caller = sample_request(second=True, action="app.read")
        self.assertEqual(self.reserve(other, caller).status, "reserved_fixture")
        self.assertEqual(self.reserve(other).reason, "scope_mismatch")
        self.assertEqual(self.reserve(caller=caller).reason, "scope_mismatch")

    def test_agent_self_approval_and_unrelated_human_denied_and_audited(self):
        for person in (uid(2), uid(3)):
            with self.assertRaisesRegex(ApprovalDenied, "wrong_approver"):
                self.approve(human_id=person)
        self.assertEqual(len(self.store.audit_records()), 2)
        self.assertEqual(json.loads(self.store.audit_records()[-1]["details"])["attempted_approver_id"], uid(3))

    def test_all_material_request_fields_bind_approval(self):
        approval = self.approve()
        fields = ("id", "run_id", "payload_ref", "operation_id", "workspace_id", "resource_id",
                  "destination_id", "tenant_id", "target_account_id", "grant_id")
        for field in fields:
            with self.subTest(field=field):
                self.assertEqual(self.reserve(replace(self.request, **{field: uid(999)}),
                                              approval=approval).status, "denied")
        for field in ("policy_version", "resource_version", "grant_version", "expires_at"):
            with self.subTest(field=field):
                self.assertEqual(self.reserve(replace(self.request, **{field: getattr(self.request, field)+1}),
                                              approval=approval).status, "denied")
        self.assertEqual(self.reserve(replace(self.request, action="app.read"), approval=approval).status, "denied")
        self.assertEqual(self.reserve(approval=approval).status, "reserved_fixture")

    def test_unknown_optional_approval_cannot_misattribute_read(self):
        request = replace(self.request, action="app.read")
        self.assertEqual(self.reserve(request, approval=uid(999)).reason, "approval_required_or_invalid")
        self.assertEqual(self.reserve(request).status, "reserved_fixture")

    def test_caller_binding_cannot_be_replaced_or_inherited(self):
        for field in self.caller.__dataclass_fields__:
            with self.subTest(field=field):
                caller = replace(self.caller, **{field: uid(999)})
                self.assertEqual(self.reserve(caller=caller).status, "denied")

    def test_login_does_not_allow_other_actions(self):
        for action in ("secret.reveal", "secret.edit", "secret.rotate", "access.manage", "export",
                       "app.send", "app.delete", "app.billing", "app.security", "unknown"):
            with self.subTest(action=action):
                self.assertEqual(self.reserve(replace(self.request, action=action)).status, "denied")

    def test_granted_high_impact_actions_still_need_the_exact_approval(self):
        actions = tuple(sorted(ACTIONS))
        capabilities = tuple(replace(self.policy.fixture_capabilities[0], action=a) for a in actions)
        policy = replace(self.policy,
                         grants=(replace(self.policy.grants[0], actions=actions), self.policy.grants[1]),
                         human_scopes=(replace(self.policy.human_scopes[0], actions=actions), self.policy.human_scopes[1]),
                         fixture_capabilities=capabilities)
        with tempfile.TemporaryDirectory() as folder:
            store = PolicyStore(Path(folder)/"f.sqlite", policy, clock=lambda: 1000)
            try:
                approval = store.approve_fixture(self.request, self.caller, human_id=uid(1), expires_at=1100)
                for action in ("app.send", "app.delete", "app.billing", "app.security"):
                    with self.subTest(action=action):
                        request = replace(self.request, action=action)
                        self.assertEqual(store.reserve_fixture(request, self.caller).reason, "approval_required_or_invalid")
                        self.assertEqual(store.reserve_fixture(request, self.caller, approval_id=approval).reason,
                                         "approval_required_or_invalid")
                request = replace(self.request, action="app.send")
                own_approval = store.approve_fixture(request, self.caller, human_id=uid(1), expires_at=1100)
                self.assertEqual(store.reserve_fixture(request, self.caller, approval_id=own_approval).status,
                                 "reserved_fixture")
            finally:
                store.close()

    def test_individual_expiry_layers_and_lease_bounds(self):
        policies = (
            replace(self.policy, connections=(replace(self.policy.connections[0], expires_at=1000), self.policy.connections[1])),
            replace(self.policy, grants=(replace(self.policy.grants[0], expires_at=1000), self.policy.grants[1])),
            replace(self.policy, human_scopes=(replace(self.policy.human_scopes[0], expires_at=1000), self.policy.human_scopes[1])),
            replace(self.policy, grants=(replace(self.policy.grants[0], starts_at=1001), self.policy.grants[1])),
        )
        for policy in policies:
            with self.subTest(policy=policy), tempfile.TemporaryDirectory() as folder:
                store = PolicyStore(Path(folder)/"f.sqlite", policy, clock=lambda: 1000)
                try:
                    self.assertEqual(store.reserve_fixture(self.request, self.caller).status, "denied")
                finally:
                    store.close()
        policy = replace(self.policy, human_scopes=(replace(self.policy.human_scopes[0], expires_at=1050),
                                                    self.policy.human_scopes[1]))
        with tempfile.TemporaryDirectory() as folder:
            store = PolicyStore(Path(folder)/"f.sqlite", policy, clock=lambda: self.now)
            try:
                request = replace(self.request, action="app.read")
                op = store.reserve_fixture(request, self.caller)
                self.assertEqual(op.lease_end, 1050)
                self.now = 1050
                self.assertEqual(store.recheck_fixture(op.operation_id, request, self.caller).reason,
                                 "human_authority_missing")
            finally:
                store.close()

    def test_expired_future_grant_connection_request_and_approval(self):
        approval = self.approve()
        self.now = 1100
        self.assertEqual(self.reserve(approval=approval).reason, "approval_required_or_invalid")
        for now in (899, 1500, 1800, 2000):
            # Use fresh databases because backwards clocks deliberately fail.
            with tempfile.TemporaryDirectory() as folder:
                store = PolicyStore(Path(folder)/"f.sqlite", self.policy, clock=lambda: now)
                try:
                    self.assertEqual(store.reserve_fixture(self.request, self.caller).reason,
                                     "expired_or_not_started")
                finally:
                    store.close()

    def test_approval_window_is_bounded_and_does_not_outlive_request(self):
        for deadline in (1000, 1121, 1600):
            with self.assertRaisesRegex(ApprovalDenied, "approval_deadline_invalid"):
                self.approve(expires_at=deadline)

    def test_changed_policy_cannot_reuse_existing_approvals(self):
        self.approve()
        with self.assertRaisesRegex(ValueError, "policy changed"):
            self.open(replace(self.policy, version=2))

    def test_reopen_preserves_approval_consumption_and_revocation(self):
        approval = self.approve()
        self.reserve(approval=approval)
        second = self.open()
        self.assertEqual(second.reserve_fixture(self.request, self.caller, approval_id=approval).reason,
                         "request_replayed")
        self.store.revoke("connection", uid(30), human_id=uid(1))
        self.assertEqual(second.reserve_fixture(self.request, self.caller).reason, "revoked")

    def test_each_revocation_layer_stops_active_work(self):
        for kind, id in (("person", 2), ("connection", 30), ("workspace", 10),
                         ("resource", 50), ("grant", 80), ("human_scope", 70)):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as folder:
                store = PolicyStore(Path(folder)/"f.sqlite", self.policy, clock=lambda: self.now)
                try:
                    request = replace(self.request, action="app.read")
                    op = store.reserve_fixture(request, self.caller)
                    result = store.revoke(kind, uid(id), human_id=uid(1))
                    self.assertEqual(result["policy"], "blocked")
                    self.assertTrue(all(v == "unverified" for k,v in result.items() if k != "policy"))
                    self.assertEqual(store.recheck_fixture(op.operation_id, request, self.caller).status, "denied")
                    other, caller = sample_request(second=True, action="app.read")
                    self.assertEqual(store.reserve_fixture(other, caller).status, "reserved_fixture")
                finally:
                    store.close()

    def test_sponsor_and_operator_authority_intersect(self):
        # Distinct sponsor does not donate credentials/authority to the operator.
        policy = replace(self.policy, connections=(replace(self.policy.connections[0], sponsor_id=uid(3)),
                                                    self.policy.connections[1]))
        with tempfile.TemporaryDirectory() as folder:
            store = PolicyStore(Path(folder)/"f.sqlite", policy, clock=lambda: self.now)
            try:
                self.assertEqual(store.reserve_fixture(self.request, self.caller).reason, "human_authority_missing")
            finally:
                store.close()

    def test_sponsor_revocation_stops_a_separately_authorized_operator(self):
        policy = replace(self.policy, connections=(replace(self.policy.connections[0], sponsor_id=uid(3)),
                                                    self.policy.connections[1]),
                         human_scopes=(*self.policy.human_scopes,
                                       HumanScope(uid(72), uid(3), uid(50), ("app.read",), 1900)))
        with tempfile.TemporaryDirectory() as folder:
            store = PolicyStore(Path(folder)/"f.sqlite", policy, clock=lambda: self.now)
            try:
                request = replace(self.request, action="app.read")
                op = store.reserve_fixture(request, self.caller)
                self.assertEqual(op.status, "reserved_fixture")
                store.revoke("person", uid(3), human_id=uid(1))
                self.assertEqual(store.recheck_fixture(op.operation_id, request, self.caller).reason, "revoked")
            finally:
                store.close()

    def test_unprivileged_revocation_does_not_change_policy(self):
        with self.assertRaisesRegex(ApprovalDenied, "workspace_owner_required"):
            self.store.revoke("connection", uid(30), human_id=uid(2))
        self.assertEqual(json.loads(self.store.audit_records()[-1]["details"])["actor_id"], uid(2))
        self.assertEqual(self.reserve(replace(self.request, action="app.read")).status, "reserved_fixture")

    def test_lease_and_human_expiry_are_rechecked(self):
        request = replace(self.request, action="app.read")
        op = self.reserve(request)
        self.now = op.lease_end
        self.assertEqual(self.store.recheck_fixture(op.operation_id, request, self.caller).reason,
                         "operation_invalid_or_closed")

    def test_audit_failure_rolls_back_approval_consumption_and_reservation(self):
        approval = self.approve()
        self.store.db.execute("CREATE TRIGGER fail_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'offline'); END")
        with self.assertRaises(StoreUnavailable):
            self.reserve(approval=approval)
        self.assertEqual(self.store.db.execute("SELECT consumed FROM approvals").fetchone()[0], 0)
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM operations").fetchone()[0], 0)
        self.store.db.execute("DROP TRIGGER fail_audit")
        self.assertEqual(self.reserve(approval=approval).status, "reserved_fixture")

    def test_audit_is_append_only_for_application_writes(self):
        self.reserve()
        for statement in ("DELETE FROM audit", "UPDATE audit SET event='rewritten'"):
            with self.assertRaises(sqlite3.IntegrityError):
                self.store.db.execute(statement)

    def test_unknown_actions_and_payloads_do_not_enter_audit(self):
        sentinel = "private-password-token-do-not-record"
        self.reserve(replace(self.request, action=sentinel))
        with self.assertRaises(ValueError):
            self.reserve(replace(self.request, payload_ref=sentinel))
        with self.assertRaises(ValueError):
            self.reserve(replace(self.request, destination_id="https://private.invalid/?token="+sentinel))
        audit = json.dumps(self.store.audit_records())
        self.assertNotIn(sentinel, audit)
        self.assertNotIn("https://", audit)

    def test_unknown_outcome_never_becomes_permission_to_retry(self):
        approval = self.approve()
        op = self.reserve(approval=approval)
        self.store.finish_fixture(op.operation_id, "unknown_fixture")
        self.assertEqual(self.reserve(approval=approval).reason, "request_replayed")
        self.assertEqual(self.store.recheck_fixture(op.operation_id, self.request, self.caller).status, "denied")
        with self.assertRaisesRegex(ValueError, "already closed"):
            self.store.finish_fixture(op.operation_id, "completed_fixture")

    def test_request_id_conflict_cannot_replace_operation(self):
        approval = self.approve()
        self.reserve(approval=approval)
        self.assertEqual(self.reserve(replace(self.request, payload_ref=uid(999)), approval=approval).reason,
                         "request_id_conflict")

    def test_concurrent_approval_consumption_only_reserves_once(self):
        approval = self.approve()
        def worker(_):
            store = PolicyStore(self.path, self.policy, clock=lambda: 1000)
            try:
                return store.reserve_fixture(self.request, self.caller, approval_id=approval).status
            finally:
                store.close()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(worker, range(8)))
        self.assertEqual(results.count("reserved_fixture"), 1)
        self.assertEqual(results.count("denied"), 7)
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM operations").fetchone()[0], 1)

    def test_clock_regression_and_uncertain_time_fail_closed(self):
        self.reserve()
        for now in (999, None, float("nan"), True):
            self.now = now
            with self.assertRaises((ValueError, StoreUnavailable)):
                self.reserve()

    def test_no_runtime_declaration_means_no_policy_permission(self):
        with tempfile.TemporaryDirectory() as folder:
            store = PolicyStore(Path(folder)/"f.sqlite", replace(self.policy, fixture_capabilities=()), clock=lambda: 1000)
            try:
                self.assertEqual(store.reserve_fixture(self.request, self.caller).reason, "runtime_unsupported")
            finally:
                store.close()

    def test_policy_rejects_wildcards_unsupported_actions_and_secret_urls(self):
        for value in ("*", "https://user:password@fixture.invalid", "https://fixture.invalid/path?token=private",
                      "https://fixture.invalid/", "http://fixture.invalid"):
            policy = replace(self.policy, resources=(replace(self.policy.resources[0], https_origin=value),
                                                     self.policy.resources[1]))
            with self.subTest(value=value), self.assertRaises(ValueError):
                policy.validate()
        for action in ("secret.reveal", "export", "access.manage", "*"):
            policy = replace(self.policy, grants=(replace(self.policy.grants[0], actions=(action,)),
                                                  self.policy.grants[1]))
            with self.assertRaises(ValueError):
                policy.validate()


if __name__ == "__main__":
    unittest.main()
