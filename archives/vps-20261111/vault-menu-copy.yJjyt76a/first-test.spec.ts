import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { PasswordRepromptService } from "@bitwarden/vault";

import { VaultMacCopyService } from "./vault-mac-copy.service";

describe("VaultMacCopyService", () => {
  const request = { url: "https://github.com/", field: "login" as const, id: "", allowReprompt: false };
  const userId = "8b95ff56-2687-4d80-981f-38bbba7594fd";
  let service: VaultMacCopyService;
  let matches: jest.Mock;
  let authStatus: jest.Mock;
  let reprompt: jest.Mock;

  function login(id: string, host = "github.com") {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.name = "GitHub fixture";
    cipher.type = CipherType.Login;
    cipher.reprompt = CipherRepromptType.None;
    cipher.login = new LoginView();
    cipher.login.username = "fixture-user";
    cipher.login.password = "fixture-password";
    const uri = new LoginUriView();
    uri.uri = "https://" + host;
    cipher.login.uris = [uri];
    return cipher;
  }

  const first = "a34fca5b-8559-479a-8b99-10fba594c872";
  const second = "74db5d9e-938a-4c2f-8b1e-94eb37085c85";

  beforeEach(() => {
    matches = jest.fn().mockResolvedValue([login(first)]);
    authStatus = jest.fn().mockResolvedValue(AuthenticationStatus.Unlocked);
    reprompt = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId }) } },
        { provide: AuthService, useValue: { getAuthStatus: authStatus } },
        { provide: CipherService, useValue: { getAllDecryptedForUrl: matches } },
        { provide: PasswordRepromptService, useValue: { showPasswordPrompt: reprompt } },
        { provide: EventCollectionService, useValue: { collect: jest.fn().mockResolvedValue(undefined) } },
      ],
    });
    service = TestBed.inject(VaultMacCopyService);
  });

  it("asks which login to use and withholds passwords when multiple items match", async () => {
    matches.mockResolvedValue([login(first), login(second)]);
    await expect(service["prepareCopy"](request)).resolves.toEqual({
      status: "choose",
      choices: [
        { id: first, label: "GitHub fixture · fixture-user" },
        { id: second, label: "GitHub fixture · fixture-user" },
      ],
    });
  });

  it("returns just the requested fields from the chosen item", async () => {
    await expect(service["prepareCopy"]({ ...request, id: first })).resolves.toEqual({
      status: "ready", id: first, value: "fixture-user\nfixture-password",
    });
    await expect(service["prepareCopy"]({ ...request, id: first, field: "password" })).resolves.toEqual({
      status: "ready", id: first, value: "fixture-password",
    });
  });

  it("rejects hidden passwords and logins for other sites", async () => {
    const hidden = login(first);
    hidden.viewPassword = false;
    matches.mockResolvedValue([hidden, login(second, "github.com.example.test")]);
    await expect(service["prepareCopy"](request)).resolves.toEqual({ status: "noMatch" });
  });

  it("requires the same item to be approved before copying a protected password", async () => {
    const protectedLogin = login(first);
    protectedLogin.reprompt = CipherRepromptType.Password;
    matches.mockResolvedValue([protectedLogin]);
    await expect(service["prepareCopy"](request)).resolves.toEqual({ status: "reprompt", id: first });
    expect(reprompt).not.toHaveBeenCalled();
    reprompt.mockResolvedValue(false);
    await expect(service["prepareCopy"]({ ...request, id: first, allowReprompt: true })).resolves.toEqual({
      status: "cancelled",
    });
  });

  it("does not look up logins while the vault is locked", async () => {
    authStatus.mockResolvedValue(AuthenticationStatus.Locked);
    await expect(service["prepareCopy"](request)).resolves.toEqual({ status: "locked" });
    expect(matches).not.toHaveBeenCalled();
  });
});
