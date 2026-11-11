import { ChangeDetectionStrategy, Component, DestroyRef, computed, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { distinctUntilChanged, map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { HeaderModule } from "../layouts/header/header.module";
import { SharedModule } from "../shared";

import {
  AgentAccount, AgentRequest, AgentStatus, AgentVaultService, Provider, RequestState, accountKey, isActive,
} from "./agent-vault.service";

const STATE_MESSAGES: Record<RequestState, string> = {
  queued: "Queued. This chat's browser connection must be active to continue. A queued request is not proof of sign-in.",
  working: "The connected chat is checking this account in its browser. Sign-in is not yet verified.",
  signed_in: "Signed in. The connected browser verified the selected account's identity.",
  verification_required: "Verification required. Continue the verification step in the connected browser with this chat.",
  credentials_rejected: "The provider rejected this account's credentials. Review the imported account before trying again.",
  failed: "The sign-in did not finish. Check this chat before requesting another sign-in.",
  cancelled: "The queued request was cancelled.",
  expired: "The request expired. You can explicitly request a new sign-in.",
};
const STATE_LABELS: Record<RequestState, string> = {
  queued: "Queued — not verified", working: "In progress — not verified",
  signed_in: "Identity verified", verification_required: "Verification required",
  credentials_rejected: "Credentials rejected", failed: "Sign-in failed",
  cancelled: "Cancelled", expired: "Expired",
};
type Context = { userId: UserId; generation: number };

@Component({
  selector: "app-agent-vault",
  standalone: true,
  templateUrl: "./agent-vault.component.html",
  imports: [SharedModule, HeaderModule],
  providers: [AgentVaultService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentVaultComponent {
  readonly accounts = signal<AgentAccount[]>([]);
  readonly search = signal("");
  readonly providerFilter = signal<Provider | "all">("all");
  readonly history = signal<AgentRequest[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly historyLoaded = signal(false);
  readonly filteredAccounts = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.accounts().filter((account) =>
      (this.providerFilter() === "all" || account.provider === this.providerFilter()) &&
      (!query || [account.name, account.username, account.origin, account.provider]
        .some((value) => value.toLocaleLowerCase().includes(query))),
    );
  });
  readonly hasFilters = computed(() => !!this.search().trim() || this.providerFilter() !== "all");
  readonly historyHasActive = computed(() => this.history().some(isActive));
  readonly status = signal<AgentStatus | null>(null);
  readonly request = signal<AgentRequest | null>(null);
  readonly selectedKey = signal<string | null>(null);
  readonly unlocked = signal(false);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly cancelling = signal(false);
  readonly uncertainSubmission = signal(false);
  readonly updatesPaused = signal(false);
  readonly error = signal<string | null>(null);
  readonly copyMessage = signal<string | null>(null);
  readonly accountKey = accountKey;
  readonly active = computed(() => isActive(this.request()));
  readonly selected = computed(() => this.filteredAccounts().find((a) => accountKey(a) === this.selectedKey()));
  readonly canSelect = computed(() => this.unlocked() && !this.loading() && !this.active() &&
    !this.submitting() && !this.cancelling() && !this.uncertainSubmission());
  readonly canSubmit = computed(() => this.canSelect() && this.status()?.state === "ready" &&
    !this.historyLoading() && !this.historyHasActive() && !!this.selected());
  readonly requestMessage = computed(() => {
    const request = this.request();
    if (request?.state === "signed_in" && !request.identityVerified) {
      return "Sign-in identity has not been verified.";
    }
    return request ? STATE_MESSAGES[request.state] : "";
  });

  private historyRevision = 0;

  private userId: UserId | null = null;
  private generation = 0;
  private pollGeneration = 0;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private pollDeadline = 0;
  private remainingPolls = 0;

  constructor(
    accounts: AccountService,
    auth: AuthService,
    private readonly service: AgentVaultService,
    destroyRef: DestroyRef,
  ) {
    accounts.activeAccount$.pipe(
      map((account) => account?.id ?? null),
      distinctUntilChanged(),
      switchMap((userId) => {
        // Clear synchronously on account change, before any new auth status or response.
        this.clear();
        return auth.activeAccountStatus$.pipe(
          distinctUntilChanged(),
          map((status) => ({ userId, status })),
        );
      }),
      takeUntilDestroyed(destroyRef),
    ).subscribe(({ userId, status }) => {
      this.clear();
      if (userId && status === AuthenticationStatus.Unlocked) {
        this.userId = userId;
        this.unlocked.set(true);
        void this.refresh();
      }
    });
    destroyRef.onDestroy(() => this.clear());
  }

  async refresh(): Promise<void> {
    const context = this.context();
    if (!context || this.loading() || this.active() || this.submitting() || this.cancelling() ||
        this.uncertainSubmission()) {
      return;
    }
    void this.refreshHistory();
    this.loading.set(true);
    this.error.set(null);
    try {
      const [status, accounts] = await Promise.all([
        this.service.status(context.userId), this.service.accounts(context.userId),
      ]);
      if (!this.current(context)) {
        return;
      }
      this.status.set(status);
      this.accounts.set(accounts);
      this.selectedKey.set(null);
    } catch {
      if (this.current(context)) {
        this.accounts.set([]);
        this.status.set(null);
        this.selectedKey.set(null);
        this.error.set("Agent access could not be loaded. Check your Vault connection and try Refresh.");
      }
    } finally {
      if (this.current(context)) {
        this.loading.set(false);
      }
    }
  }

  setSearch(value: string): void {
    if (this.canSelect()) {
      this.search.set(value.slice(0, 1024));
      this.selectedKey.set(null);
    }
  }

  setProvider(value: Provider | "all"): void {
    if (this.canSelect() && ["all", "clickup", "godial"].includes(value)) {
      this.providerFilter.set(value);
      this.selectedKey.set(null);
    }
  }

  clearFilters(): void {
    if (this.canSelect()) {
      this.search.set("");
      this.providerFilter.set("all");
      this.selectedKey.set(null);
    }
  }

  stateLabel(request: AgentRequest): string {
    return request.state === "signed_in" && !request.identityVerified
      ? "Sign-in not verified" : STATE_LABELS[request.state];
  }

  async refreshHistory(): Promise<void> {
    const context = this.context();
    if (!context || this.historyLoading() || this.submitting() || this.cancelling()) {
      return;
    }
    const revision = this.historyRevision;
    this.historyLoading.set(true);
    this.historyError.set(null);
    try {
      const history = await this.service.history(context.userId);
      // A later create/cancel/poll wins over a history read started before it.
      if (this.current(context) && revision === this.historyRevision) {
        this.history.set(history);
        this.historyLoaded.set(true);
      }
    } catch {
      if (this.current(context)) {
        this.historyError.set("Recent requests could not be loaded. Refresh history to try again. Any rows shown are the last confirmed states.");
      }
    } finally {
      if (this.current(context)) {
        this.historyLoading.set(false);
      }
    }
  }

  private recordRequest(request: AgentRequest): void {
    this.historyRevision++;
    const previous = this.history();
    const known = previous.some((item) => item.requestId === request.requestId);
    this.history.set((known
      ? previous.map((item) => item.requestId === request.requestId ? request : item)
      : [request, ...previous]).slice(0, 25));
    this.historyLoaded.set(true);
  }

  async submit(): Promise<void> {
    const context = this.context();
    const account = this.selected();
    if (!context || !account || !this.canSubmit()) {
      return;
    }
    // Set before awaiting to reject repeated clicks and keyboard submissions.
    this.submitting.set(true);
    this.stopPolling();
    this.request.set(null);
    this.error.set(null);
    this.copyMessage.set(null);
    try {
      const request = await this.service.create(context.userId, account);
      if (this.current(context)) {
        this.request.set(request);
        this.recordRequest(request);
        this.beginPolling(context, request);
      }
    } catch {
      if (this.current(context)) {
        // A failed response can still mean the server queued the POST. Never retry it automatically.
        this.uncertainSubmission.set(true);
        this.error.set("The request result could not be confirmed. It may already be queued. Check this chat before reloading or requesting again.");
      }
    } finally {
      if (this.current(context)) {
        this.submitting.set(false);
      }
    }
  }

  async cancel(): Promise<void> {
    const context = this.context();
    const request = this.request();
    if (!context || request?.state !== "queued" || this.cancelling() || this.submitting()) {
      return;
    }
    this.cancelling.set(true);
    this.error.set(null);
    this.stopPolling();
    try {
      const result = await this.service.cancel(context.userId, request);
      if (this.current(context)) {
        this.request.set(result);
        this.recordRequest(result);
      }
    } catch {
      if (this.current(context)) {
        this.error.set("Cancellation was not confirmed. The chat may have started this request. Checking its latest state.");
      }
    } finally {
      if (this.current(context)) {
        this.cancelling.set(false);
        const latest = this.request();
        if (latest) {
          this.beginPolling(context, latest);
        }
      }
    }
  }

  resumeUpdates(): void {
    const context = this.context();
    const request = this.request();
    if (context && request && this.active() && this.updatesPaused() && !this.cancelling()) {
      this.error.set(null);
      this.beginPolling(context, request);
    }
  }

  async copyRequestId(): Promise<void> {
    const context = this.context();
    const requestId = this.request()?.requestId;
    if (!context || !requestId) {
      return;
    }
    try {
      // Only this opaque ID goes to the clipboard. No chat is opened or messaged.
      await navigator.clipboard.writeText(requestId);
      if (this.current(context) && this.request()?.requestId === requestId) {
        this.copyMessage.set("Request ID copied. Paste it into this chat if needed.");
      }
    } catch {
      if (this.current(context) && this.request()?.requestId === requestId) {
        this.copyMessage.set("Copy is unavailable. Select the request ID below and copy it manually.");
      }
    }
  }

  private beginPolling(context: Context, request: AgentRequest): void {
    this.stopPolling();
    if (!isActive(request)) {
      return;
    }
    this.pollDeadline = Math.min(Date.parse(request.expiresAt), Date.now() + 5 * 60 * 1000);
    this.remainingPolls = 151;
    this.updatesPaused.set(false);
    this.schedulePoll(context, this.pollGeneration, 0);
  }

  private schedulePoll(context: Context, pollGeneration: number, delay: number): void {
    this.pollTimer = setTimeout(() => void this.poll(context, pollGeneration), delay);
  }

  private async poll(context: Context, pollGeneration: number): Promise<void> {
    const expected = this.request();
    if (!this.current(context) || pollGeneration !== this.pollGeneration || !expected || !isActive(expected)) {
      return;
    }
    // Always allow one final server read at expiry. Do not fabricate a terminal result locally.
    this.remainingPolls--;
    try {
      const request = await this.service.read(context.userId, expected);
      if (!this.current(context) || pollGeneration !== this.pollGeneration) {
        return;
      }
      this.request.set(request);
      this.recordRequest(request);
      if (!isActive(request)) {
        this.stopPolling();
        return;
      }
      if (Date.now() >= this.pollDeadline || this.remainingPolls <= 0) {
        this.pauseUpdates();
        return;
      }
      this.schedulePoll(context, pollGeneration, 2000);
    } catch {
      if (this.current(context) && pollGeneration === this.pollGeneration) {
        this.pauseUpdates();
      }
    }
  }

  private pauseUpdates(): void {
    this.stopPolling();
    this.updatesPaused.set(true);
    this.error.set("Live updates paused. This is the last confirmed state, not a new sign-in result. Use Check status to read it again.");
  }

  private stopPolling(): void {
    this.pollGeneration++;
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    this.updatesPaused.set(false);
  }

  private context(): Context | null {
    return this.userId ? { userId: this.userId, generation: this.generation } : null;
  }

  private current(context: Context): boolean {
    return this.userId === context.userId && this.generation === context.generation;
  }

  private clear(): void {
    this.generation++;
    this.historyRevision++;
    this.history.set([]);
    this.historyLoading.set(false);
    this.historyError.set(null);
    this.historyLoaded.set(false);
    this.search.set("");
    this.providerFilter.set("all");
    this.userId = null;
    this.stopPolling();
    this.pollDeadline = 0;
    this.remainingPolls = 0;
    this.unlocked.set(false);
    this.accounts.set([]);
    this.status.set(null);
    this.request.set(null);
    this.selectedKey.set(null);
    this.loading.set(false);
    this.submitting.set(false);
    this.cancelling.set(false);
    this.uncertainSubmission.set(false);
    this.error.set(null);
    this.copyMessage.set(null);
  }
}
