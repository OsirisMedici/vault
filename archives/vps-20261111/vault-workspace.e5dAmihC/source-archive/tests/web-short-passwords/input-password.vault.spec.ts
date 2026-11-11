import { DestroyRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { UserId } from "@bitwarden/common/types/guid";
import { DEFAULT_KDF_CONFIG } from "@bitwarden/key-management";

import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "./input-password.component";

type Dependencies = ConstructorParameters<typeof InputPasswordComponent>;

describe("Vault master password choice", () => {
  let component: InputPasswordComponent;
  const audit = mock<Dependencies[0]>();
  const dialog = mock<Dependencies[3]>();
  const kdf = mock<Dependencies[7]>();
  const masterPassword = mock<Dependencies[8]>();
  const policy = mock<Dependencies[11]>();
  const validation = mock<Dependencies[13]>();

  function setup(
    flow = InputPasswordFlow.SetInitialPasswordAccountRegistration,
  ) {
    const i18n = mock<Dependencies[6]>();
    i18n.t.mockImplementation((key, ...args) => [key, ...args].join(":"));
    component = new InputPasswordComponent(
      audit,
      mock(),
      mock(),
      dialog,
      TestBed.inject(DestroyRef),
      new FormBuilder(),
      i18n,
      kdf,
      masterPassword,
      mock(),
      mock(),
      policy,
      mock(),
      validation,
    );
    component.flow = flow;
    if (flow !== InputPasswordFlow.ChangePasswordDelegation) {
      component.email = "fixture@example.invalid";
    }
    if (
      flow !== InputPasswordFlow.SetInitialPasswordAccountRegistration &&
      flow !== InputPasswordFlow.ChangePasswordDelegation
    ) {
      component.userId = "00000000-0000-4000-8000-000000000001" as UserId;
    }
    component.ngOnInit();
    component["formGroup"].controls.currentPassword?.setValue(
      "previous-fixture-value",
    );
    return component["formGroup"];
  }

  beforeEach(() => {
    jest.resetAllMocks();
    audit.passwordLeaked.mockResolvedValue(0);
    dialog.openSimpleDialog.mockResolvedValue(true);
    kdf.getKdfConfig$.mockReturnValue(of(DEFAULT_KDF_CONFIG));
    masterPassword.emailToSalt.mockReturnValue("fixture@example.invalid");
    masterPassword.saltForUser$.mockReturnValue(of("fixture@example.invalid"));
    policy.evaluateMasterPassword.mockReturnValue(true);
  });

  const choices = Array.from({ length: 12 }, (_, index) =>
    "7".repeat(index + 1),
  );
  choices.push("a", "!", "a 1!", "a".repeat(13), "a".repeat(128));

  it.each(choices)(
    "registers with a %s fixture after acknowledging the warning",
    async (value) => {
      const form = setup();
      form.patchValue({ newPassword: value, newPasswordConfirm: value });
      const emit = jest.spyOn(component.onPasswordFormSubmit, "emit");
      await expect(component.submit()).resolves.toMatchObject({
        newPassword: value,
      });
      expect(emit).toHaveBeenCalledWith(
        expect.objectContaining({ newPassword: value }),
      );
      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "weakMasterPassword" },
        }),
      );
      expect(validation.showError).not.toHaveBeenCalled();
    },
  );

  it.each([
    InputPasswordFlow.SetInitialPasswordAuthedUser,
    InputPasswordFlow.ChangePassword,
    InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation,
    InputPasswordFlow.ChangePasswordDelegation,
  ])("accepts one character in password flow %s", async (flow) => {
    const form = setup(flow);
    form.patchValue({ newPassword: "7", newPasswordConfirm: "7" });
    await expect(component.submit()).resolves.toMatchObject({
      newPassword: "7",
    });
    expect(validation.showError).not.toHaveBeenCalled();
  });

  it("rejects empty passwords and does not emit", async () => {
    const form = setup();
    const emit = jest.spyOn(component.onPasswordFormSubmit, "emit");
    await expect(component.submit()).resolves.toBeUndefined();
    expect(form.controls.newPassword.hasError("required")).toBe(true);
    expect(form.controls.newPasswordConfirm.hasError("required")).toBe(true);
    expect(emit).not.toHaveBeenCalled();
    expect(dialog.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation", async () => {
    const form = setup();
    form.patchValue({ newPassword: "7", newPasswordConfirm: "8" });
    await expect(component.submit()).resolves.toBeUndefined();
    expect(
      form.controls.newPasswordConfirm.hasError("compareInputsError"),
    ).toBe(true);
  });

  it("does not submit when the user declines the weak password warning", async () => {
    const form = setup();
    form.patchValue({ newPassword: "7", newPasswordConfirm: "7" });
    dialog.openSimpleDialog.mockResolvedValue(false);
    const emit = jest.spyOn(component.onPasswordFormSubmit, "emit");
    await expect(component.submit()).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });

  it("keeps the combined breached and weak password warning", async () => {
    const form = setup();
    form.patchValue({ newPassword: "7", newPasswordConfirm: "7" });
    audit.passwordLeaked.mockResolvedValue(1);
    await component.submit();
    expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: { key: "weakAndExposedMasterPassword" },
      }),
    );
  });

  it("keeps explicit organization policies and their displayed minimum", async () => {
    const form = setup();
    const options = Object.assign(new MasterPasswordPolicyOptions(), {
      minLength: 12,
    });
    component.masterPasswordPolicyOptions = options;
    form.patchValue({ newPassword: "7", newPasswordConfirm: "7" });
    policy.evaluateMasterPassword.mockReturnValue(false);
    const emit = jest.spyOn(component.onPasswordFormSubmit, "emit");
    await expect(component.submit()).resolves.toBeUndefined();
    expect(policy.evaluateMasterPassword).toHaveBeenCalledWith(0, "7", options);
    expect(component["minPasswordLengthMsg"]).toBe("characterMinimum:12");
    expect(emit).not.toHaveBeenCalled();
  });

  it("shows the one character minimum without an organization policy", () => {
    setup();
    expect(component["minPasswordLengthMsg"]).toBe("characterMinimum:1");
  });
});
