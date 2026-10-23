/** One synthetic boundary fixture. Run with Bun; no upstream dependencies required. */
import { strict as assert } from "node:assert";
import { plugin } from "bun";

// Only the Angular decorator is needed to exercise the real API boundary below.
plugin({
  name: "agent-web-fixture-angular",
  setup(build) {
    build.onResolve({ filter: /^@angular\/core$/ }, () => ({
      path: "core", namespace: "fixture-angular",
    }));
    build.onLoad({ filter: /.*/, namespace: "fixture-angular" }, () => ({
      contents: "export const Injectable = () => (target) => target;", loader: "js",
    }));
  },
});

const { AgentVaultService, projectAccounts, projectRequest, accountKey } =
  await import("./app/agent-vault.service");
const userId = "00000000-0000-4000-8000-000000000001";
const account = {
  accountId: "synthetic-same-item", name: "Synthetic", username: "fixture@example.invalid",
  provider: "clickup" as const, origin: "https://app.clickup.com",
};
const otherProvider = { ...account, provider: "godial" as const, origin: "https://app.godial.cc" };
const rows = projectAccounts({ accounts: [account, otherProvider] });
assert.equal(rows.length, 2);
assert.notEqual(accountKey(rows[0]), accountKey(rows[1]));
assert.throws(() => projectAccounts({ accounts: [{ ...account, password: "synthetic-do-not-project" }] }));
assert.throws(() => projectAccounts({ accounts: [{ ...account, origin: "https://untrusted.invalid" }] }));
const request = {
  requestId: "synthetic-request-1", state: "queued", name: account.name, username: account.username,
  provider: account.provider, origin: account.origin, expiresAt: "2026-10-23T12:05:00.000Z",
  identityVerified: false,
};
assert.throws(() => projectRequest({ ...request, state: "signed_in" }));
assert.throws(() => projectRequest({ ...request, credentialRef: "synthetic-private-ref" }));
const calls: unknown[][] = [];
let response = request;
const service = new AgentVaultService({
  async send(...args: unknown[]) {
    calls.push(args);
    return response;
  },
} as never);
assert.equal((await service.create(userId as never, account)).state, "queued");
assert.deepEqual(calls[0], [
  "POST", "/agent-vault/requests", { accountId: account.accountId, provider: "clickup" }, userId, true,
]);
response = { ...request, requestId: "synthetic-wrong-request" };
await assert.rejects(() => service.read(userId as never, projectRequest(request)));
response = { ...request, provider: "godial", origin: "https://app.godial.cc" } as typeof request;
await assert.rejects(() => service.create(userId as never, account));

// Parse the two actual TS files without resolving/installing the upstream app.
const transpiler = new Bun.Transpiler({ loader: "ts", tsconfig: {
  compilerOptions: { experimentalDecorators: true },
} });
for (const file of ["agent-vault.service.ts", "agent-vault.component.ts"]) {
  transpiler.transformSync(await Bun.file(new URL(`./app/${file}`, import.meta.url)).text());
}
console.log("PASS: fixed projections, provider identity, request binding, explicit-user API path, TS syntax");
