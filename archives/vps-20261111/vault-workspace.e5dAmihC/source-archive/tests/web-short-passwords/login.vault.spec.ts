import { FormBuilder } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { LoginComponent } from "./login.component";

describe("Vault short password sign-in", () => {
  function create() {
    return new LoginComponent(
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      new FormBuilder(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
    );
  }

  it.each(
    Array.from({ length: 13 }, (_, index) => "7".repeat(index + 1)).concat([
      "a",
      "!",
      "a 1!",
    ]),
  )("allows the %s fixture through sign-in form validation", (value) => {
    const component = create();
    component.formGroup.patchValue({
      email: "fixture@example.invalid",
      masterPassword: value,
    });
    expect(component.formGroup.valid).toBe(true);
  });

  it("still rejects an empty password", () => {
    const component = create();
    component.formGroup.patchValue({
      email: "fixture@example.invalid",
      masterPassword: "",
    });
    expect(
      component.formGroup.controls.masterPassword.hasError("required"),
    ).toBe(true);
    expect(component.formGroup.valid).toBe(false);
  });

  it("still rejects an invalid email", () => {
    const component = create();
    component.formGroup.patchValue({ email: "invalid", masterPassword: "7" });
    expect(component.formGroup.controls.email.hasError("email")).toBe(true);
  });
});
