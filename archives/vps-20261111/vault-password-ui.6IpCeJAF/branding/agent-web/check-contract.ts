/** ONE aggregate synthetic service/interaction fixture. No real Angular runtime or sign-in. */
import { strict as assert } from "node:assert";
import { mock } from "bun:test";

// Explicit framework substitutes: no real RxJS, Angular template or renderer acceptance.
mock.module("@angular/core", () => ({
  Injectable: () => (target: unknown) => target,
  Component: () => (target: unknown) => target,
  ChangeDetectionStrategy: { OnPush: 0 },
  signal(value: unknown) { const read = () => value; read.set = (next: unknown) => { value = next; }; return read; },
  computed: (read: () => unknown) => read,
}));
type Subscription = { unsubscribe(): void };
type Stream = { subscribe(next: (value: any) => void): Subscription; pipe(...ops: any[]): Stream };
const stream = (subscribe: Stream["subscribe"]): Stream => ({
  subscribe, pipe(...ops) { return ops.reduce((source, op) => op(source), this); },
});
mock.module("rxjs", () => ({
  map: (fn: (value: any) => any) => (source: Stream) => stream((next) => source.subscribe((value) => next(fn(value)))),
  distinctUntilChanged: () => (source: Stream) => stream((next) => {
    let first = true, previous: unknown;
    return source.subscribe((value) => { if (first || previous !== value) { first = false; previous = value; next(value); } });
  }),
  switchMap: (fn: (value: any) => Stream) => (source: Stream) => stream((next) => {
    let inner: Subscription | undefined;
    const outer = source.subscribe((value) => { inner?.unsubscribe(); inner = fn(value).subscribe(next); });
    return { unsubscribe() { outer.unsubscribe(); inner?.unsubscribe(); } };
  }),
}));
mock.module("@angular/core/rxjs-interop", () => ({ takeUntilDestroyed: () => (source: Stream) => source }));
mock.module("@bitwarden/common/auth/enums/authentication-status", () => ({ AuthenticationStatus: { Locked: 1, Unlocked: 2 } }));
const componentBuild = await Bun.build({
  entrypoints: [new URL("./app/agent-vault.component.ts", import.meta.url).pathname],
  target: "bun", packages: "external", write: false,
  plugins: [{ name: "fixture-layout", setup(build) {
    build.onResolve({ filter: /^\.\.\/(shared|layouts\/header\/header.module)$/ }, () => ({ path: "layout", namespace: "fixture-layout" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-layout" }, () => ({
      contents: "export const SharedModule = {}; export const HeaderModule = {};", loader: "js",
    }));
  } }],
});
assert.equal(componentBuild.success, true, String(componentBuild.logs));

const { AgentVaultService, projectAccounts, projectRequest, projectHistory, accountKey } =
  await import("./app/agent-vault.service");
const { AgentVaultComponent } = await import(`data:text/javascript;base64,${Buffer.from(await componentBuild.outputs[0].text()).toString("base64")}`);
const userId = "00000000-0000-4000-8000-000000000001";
const otherUser = "00000000-0000-4000-8000-000000000002";
const account = {
  accountId: "synthetic-same-item", name: "Synthetic", username: "fixture@example.invalid",
  provider: "clickup" as const, origin: "https://app.clickup.com",
};
const otherProvider = { ...account, provider: "godial" as const, origin: "https://app.godial.cc" };
const rows = projectAccounts({ accounts: [account, otherProvider] });
assert.notEqual(accountKey(rows[0]), accountKey(rows[1]));
assert.throws(() => projectAccounts({ accounts: [{ ...account, password: "synthetic-do-not-project" }] }));
assert.throws(() => projectAccounts({ accounts: [{ ...account, origin: "https://untrusted.invalid" }] }));
const request = projectRequest({
  requestId: "synthetic-request-1", state: "queued", name: account.name, username: account.username,
  provider: account.provider, origin: account.origin, expiresAt: new Date(Date.now() + 300000).toISOString(),
  identityVerified: false,
});
const signedIn = projectRequest({ ...request, state: "signed_in", identityVerified: true });
const failed = projectRequest({ ...request, state: "failed" });
assert.throws(() => projectRequest({ ...request, state: "signed_in" }));
assert.throws(() => projectRequest({ ...request, identityVerified: true }));
assert.throws(() => projectRequest({ ...request, credentialRef: "synthetic-private-ref" }));
const older = { ...failed, requestId: "synthetic-older" };
assert.deepEqual(projectHistory({ requests: [signedIn, older] }), [signedIn, older]);
assert.throws(() => projectHistory({ requests: [], total: 0 }));
assert.throws(() => projectHistory({ requests: [{ ...request, accountId: "private" }] }));
assert.throws(() => projectHistory({ requests: [request, request] }));
assert.throws(() => projectHistory({ requests: Array.from({ length: 26 }, (_, i) => ({ ...request, requestId: `r-${i}` })) }));
const calls: unknown[][] = [];
let response: unknown = request;
const service = new AgentVaultService({ async send(...args: unknown[]) { calls.push(args); return response; } } as never);
assert.equal((await service.create(userId as never, account)).state, "queued");
assert.deepEqual(calls[0], ["POST", "/agent-vault/requests", { accountId: account.accountId, provider: "clickup" }, userId, true]);
response = { requests: [signedIn, older] };
assert.deepEqual(await service.history(userId as never), [signedIn, older]);
assert.deepEqual(calls[1], ["GET", "/agent-vault/requests", undefined, userId, true]);
response = { ...request, requestId: "wrong" };
await assert.rejects(() => service.read(userId as never, request));
response = { ...request, username: "other@example.invalid" };
await assert.rejects(() => service.create(userId as never, account));
response = { ...request, state: "queued" };
await assert.rejects(() => service.read(userId as never, { ...request, state: "working" }));

function source<T>(initial: T) {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  return {
    pipe(...ops: ((s: unknown) => unknown)[]): any { return ops.reduce((s, op) => op(s), this); },
    subscribe(next: (value: T) => void) { subscribers.add(next); next(value); return { unsubscribe: () => subscribers.delete(next) }; },
    next(next: T) { value = next; for (const subscriber of [...subscribers]) subscriber(next); },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const session = source<{ id: string } | null>(null);
const auth = source(1);
const destroys: (() => void)[] = [];
let historyResponse = async () => [] as typeof request[];
let createResponse = async () => request;
let readResponse = async () => signedIn;
let creates = 0, reads = 0;
let metadataResponse = async () => rows;
const historyUsers: string[] = [];
const timers = new Map<number, () => void>();
let timerId = 0;
const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = ((fn: () => void) => { timers.set(++timerId, fn); return timerId; }) as never;
globalThis.clearTimeout = ((id: number) => timers.delete(id)) as never;
let component: InstanceType<typeof AgentVaultComponent> | undefined;
try {
  component = new AgentVaultComponent(
    { activeAccount$: session } as never, { activeAccountStatus$: auth } as never,
    {
      status: async () => ({ state: "ready", browserMode: "chat-assisted", importedAccounts: 253, supportedAccounts: 2 }),
      accounts: async () => metadataResponse(),
      history: async (id: string) => { historyUsers.push(id); return historyResponse(); },
      create: async () => { creates++; return createResponse(); },
      read: async () => { reads++; return readResponse(); },
      cancel: async (_id: string, expected: typeof request) => ({ ...expected, state: "cancelled" }),
    } as never,
    { onDestroy: (fn: () => void) => destroys.push(fn) } as never,
  );
  const ui = component;
  assert.equal(ui.unlocked(), false);
  session.next({ id: userId }); auth.next(2); await flush();
  assert.equal(ui.accounts().length, 2);
  assert.equal(ui.historyLoaded(), true);
  assert.equal(ui.selected(), undefined);
  assert.equal(ui.canSubmit(), false);
  ui.setSearch("FIXTURE@EXAMPLE.INVALID"); assert.equal(ui.filteredAccounts().length, 2);
  ui.setProvider("godial"); assert.deepEqual(ui.filteredAccounts(), [otherProvider]);
  ui.selectedKey.set(accountKey(otherProvider));
  ui.setSearch("no match"); assert.equal(ui.filteredAccounts().length, 0);
  assert.equal(ui.selected(), undefined); assert.equal(ui.canSubmit(), false);
  ui.selectedKey.set(accountKey(account)); // A stale select event cannot select a hidden option.
  assert.equal(ui.selected(), undefined); assert.equal(ui.canSubmit(), false);
  ui.clearFilters(); assert.equal(ui.filteredAccounts().length, 2);

  historyResponse = async () => { throw new Error("synthetic-private-error"); };
  await ui.refreshHistory(); assert.ok(ui.historyError());
  assert.ok(!ui.historyError()?.includes("synthetic-private-error"));
  historyResponse = async () => [older]; await ui.refreshHistory(); assert.equal(ui.historyError(), null);
  assert.equal(creates, 0); assert.equal(reads, 0); assert.equal(ui.request(), null);

  const queued = deferred<typeof request>(); createResponse = () => queued.promise;
  ui.selectedKey.set(accountKey(account));
  const submission = ui.submit(); await ui.submit(); assert.equal(creates, 1);
  queued.resolve(request); await submission;
  assert.equal(ui.stateLabel(ui.request()!), "Queued — not verified");
  assert.equal(ui.canSubmit(), false);
  const staleHistory = deferred<typeof request[]>(); historyResponse = () => staleHistory.promise;
  const historyRead = ui.refreshHistory();
  const poll = [...timers.values()][0]; timers.clear(); poll(); await flush();
  assert.equal(ui.request()?.identityVerified, true);
  assert.equal(ui.stateLabel(ui.request()!), "Identity verified");
  staleHistory.resolve([request]); await historyRead;
  assert.equal(ui.history()[0].state, "signed_in"); // Poll beats the older GET.
  assert.equal(timers.size, 0);
  assert.equal(ui.stateLabel({ ...request, state: "signed_in" }), "Sign-in not verified");

  historyResponse = async () => [request]; await ui.refreshHistory();
  assert.equal(ui.historyHasActive(), true); assert.equal(ui.canSubmit(), false);
  assert.equal(creates, 1); assert.equal(reads, 1); // History never executes/resumes.
  historyResponse = async () => []; await ui.refreshHistory();
  createResponse = async () => ({ ...request, requestId: "synthetic-cancellable" });
  await ui.submit(); await ui.cancel();
  assert.equal(ui.request()?.state, "cancelled");
  assert.equal(ui.history()[0].state, "cancelled"); assert.equal(timers.size, 0);
  const beforeFailure = creates;
  createResponse = async () => { throw new Error("synthetic-private-error"); };
  await ui.submit(); assert.equal(ui.uncertainSubmission(), true);
  await ui.submit(); assert.equal(creates, beforeFailure + 1);

  // Stale history and metadata cannot cross lock or Vault-user changes.
  const late = deferred<typeof request[]>(); historyResponse = () => late.promise;
  const lateRead = ui.refreshHistory();
  auth.next(1);
  assert.equal(ui.accounts().length, 0); assert.equal(ui.history().length, 0);
  assert.equal(ui.request(), null); assert.equal(ui.search(), ""); assert.equal(timers.size, 0);
  historyResponse = async () => [];
  session.next({ id: otherUser }); auth.next(2); await flush();
  late.resolve([signedIn]); await lateRead;
  assert.deepEqual(ui.history(), []); assert.equal(historyUsers.at(-1), otherUser);

  const staleMetadata = deferred<typeof rows>(); metadataResponse = () => staleMetadata.promise;
  const metadataRead = ui.refresh(); auth.next(1);
  staleMetadata.resolve(rows); await metadataRead;
  assert.equal(ui.accounts().length, 0); assert.equal(ui.status(), null);
  metadataResponse = async () => rows; auth.next(2); await flush();

  // In-flight create is also discarded on user change; no polling is started.
  const lateCreate = deferred<typeof request>(); createResponse = () => lateCreate.promise;
  ui.selectedKey.set(accountKey(account)); const creating = ui.submit();
  session.next(null); lateCreate.resolve(request); await creating;
  assert.equal(ui.request(), null); assert.equal(ui.history().length, 0); assert.equal(timers.size, 0);
} finally {
  destroys.forEach((destroy) => destroy());
  globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClearTimeout;
}

// Static parse only, separate from interaction assertions. No template/compiler acceptance.
const transpiler = new Bun.Transpiler({ loader: "ts", tsconfig: { compilerOptions: { experimentalDecorators: true } } });
for (const file of ["agent-vault.service.ts", "agent-vault.component.ts"]) {
  transpiler.transformSync(await Bun.file(new URL(`./app/${file}`, import.meta.url)).text());
}
console.log("PASS: ONE synthetic aggregate — strict projections/history bounds, explicit-user API, search/filter selection, duplicate submission, history read-only/recovery/races, verified polling, lock/user isolation. Framework stubs; rendered/live acceptance pending.");
