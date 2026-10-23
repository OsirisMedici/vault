import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserId } from "@bitwarden/common/types/guid";

export type Provider = "clickup" | "godial";
export type RequestState =
  | "queued"
  | "working"
  | "signed_in"
  | "verification_required"
  | "credentials_rejected"
  | "failed"
  | "cancelled"
  | "expired";
export type AgentAccount = {
  accountId: string;
  name: string;
  username: string;
  origin: string;
  provider: Provider;
};
export type AgentStatus = {
  state: "ready" | "engine_unavailable";
  browserMode: "chat-assisted";
  importedAccounts: number;
  supportedAccounts: number;
};
export type AgentRequest = Omit<AgentAccount, "accountId"> & {
  requestId: string;
  state: RequestState;
  expiresAt: string;
  identityVerified: boolean;
};

const ORIGINS: Record<Provider, string> = {
  clickup: "https://app.clickup.com",
  godial: "https://app.godial.cc",
};
const STATES: RequestState[] = [
  "queued", "working", "signed_in", "verification_required", "credentials_rejected",
  "failed", "cancelled", "expired",
];
const MAX_ACCOUNTS = 10000;

function invalid(): never {
  throw new Error("agent_access_invalid_response");
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return invalid();
  }
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(row, key))) {
    return invalid();
  }
  return row;
}

function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== "string" || value.length > max || (!empty && !value.length) ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    return invalid();
  }
  return value;
}

function metadata(row: Record<string, unknown>): Omit<AgentAccount, "accountId"> {
  const provider = row.provider;
  if (provider !== "clickup" && provider !== "godial") {
    return invalid();
  }
  if (row.origin !== ORIGINS[provider]) {
    return invalid();
  }
  return {
    provider,
    origin: ORIGINS[provider],
    name: text(row.name, 1024, true),
    username: text(row.username, 1024, true),
  };
}

// A provider is part of the key: one imported item may support both providers.
export function accountKey(account: AgentAccount): string {
  return JSON.stringify([account.provider, account.accountId]);
}

export function isActive(request: AgentRequest | null): boolean {
  return request?.state === "queued" || request?.state === "working";
}

export function projectStatus(value: unknown): AgentStatus {
  const row = object(value, ["state", "browserMode", "importedAccounts", "supportedAccounts"]);
  if ((row.state !== "ready" && row.state !== "engine_unavailable") ||
      row.browserMode !== "chat-assisted" ||
      !Number.isSafeInteger(row.importedAccounts) || !Number.isSafeInteger(row.supportedAccounts) ||
      (row.importedAccounts as number) < 0 || (row.importedAccounts as number) > MAX_ACCOUNTS ||
      (row.supportedAccounts as number) < 0 || (row.supportedAccounts as number) > MAX_ACCOUNTS * 2) {
    return invalid();
  }
  return {
    state: row.state, browserMode: "chat-assisted",
    importedAccounts: row.importedAccounts as number,
    supportedAccounts: row.supportedAccounts as number,
  };
}

export function projectAccounts(value: unknown): AgentAccount[] {
  const row = object(value, ["accounts"]);
  if (!Array.isArray(row.accounts) || row.accounts.length > MAX_ACCOUNTS * 2) {
    return invalid();
  }
  const seen = new Set<string>();
  return row.accounts.map((value: unknown) => {
    const item = object(value, ["accountId", "name", "username", "origin", "provider"]);
    const account = { ...metadata(item), accountId: text(item.accountId, 256) };
    const key = accountKey(account);
    if (seen.has(key)) {
      return invalid();
    }
    seen.add(key);
    return account;
  });
}

export function projectRequest(value: unknown): AgentRequest {
  const row = object(value, [
    "requestId", "state", "provider", "name", "username", "origin", "expiresAt", "identityVerified",
  ]);
  const requestId = text(row.requestId, 128);
  const expiresAt = text(row.expiresAt, 64);
  if (!/^[a-zA-Z0-9_-]+$/u.test(requestId) || !STATES.includes(row.state as RequestState) ||
      typeof row.identityVerified !== "boolean" ||
      row.identityVerified !== (row.state === "signed_in") ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(expiresAt) ||
      !Number.isFinite(Date.parse(expiresAt))) {
    return invalid();
  }
  return {
    ...metadata(row), requestId, expiresAt,
    state: row.state as RequestState, identityVerified: row.identityVerified,
  };
}

@Injectable()
export class AgentVaultService {
  constructor(private readonly api: ApiService) {}

  async status(userId: UserId): Promise<AgentStatus> {
    return projectStatus(await this.send(userId, "GET", "/status"));
  }

  async accounts(userId: UserId): Promise<AgentAccount[]> {
    return projectAccounts(await this.send(userId, "GET", "/accounts"));
  }

  async create(userId: UserId, account: AgentAccount): Promise<AgentRequest> {
    const request = projectRequest(await this.send(userId, "POST", "/requests", {
      accountId: account.accountId, provider: account.provider,
    }));
    this.matchAccount(request, account);
    return request;
  }

  async read(userId: UserId, expected: AgentRequest): Promise<AgentRequest> {
    return this.update(userId, expected, false);
  }

  async cancel(userId: UserId, expected: AgentRequest): Promise<AgentRequest> {
    if (expected.state !== "queued") {
      return invalid();
    }
    return this.update(userId, expected, true);
  }

  private async update(userId: UserId, expected: AgentRequest, cancel: boolean): Promise<AgentRequest> {
    const request = projectRequest(await this.send(
      userId, cancel ? "POST" : "GET",
      `/requests/${encodeURIComponent(expected.requestId)}${cancel ? "/cancel" : ""}`,
      cancel ? {} : undefined,
    ));
    this.matchAccount(request, expected);
    if (request.requestId !== expected.requestId || request.expiresAt !== expected.expiresAt ||
        (expected.state === "working" && request.state === "queued")) {
      return invalid();
    }
    return request;
  }

  private matchAccount(request: AgentRequest, expected: Omit<AgentAccount, "accountId">): void {
    if (request.provider !== expected.provider || request.origin !== expected.origin ||
        request.name !== expected.name || request.username !== expected.username) {
      invalid();
    }
  }

  private async send(userId: UserId, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // No apiUrl override: only Vault's configured API base receives Vault auth.
      // ApiService owns authentication. This feature never reads tokens or storage.
      return await Promise.race([
        this.api.send(method, `/agent-vault${path}`, body, userId, true),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("agent_access_timeout")), 15000);
        }),
      ]);
    } catch {
      // Never expose raw server errors or their potentially private response bodies.
      throw new Error("agent_access_unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }
}
