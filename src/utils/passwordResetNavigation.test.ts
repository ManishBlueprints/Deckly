import { describe, expect, it } from "vitest";
import {
  createPasswordResetNavigationState,
  getPrefilledPasswordResetEmail,
} from "./passwordResetNavigation";

describe("password reset navigation state", () => {
  it("preserves a valid email in route state only", () => {
    const state = createPasswordResetNavigationState("  founder@example.com  ");

    expect(state).toEqual({
      prefilledEmail: "founder@example.com",
      source: "login_forgot_password",
    });
    expect(getPrefilledPasswordResetEmail(state)).toBe("founder@example.com");
  });

  it("does not prefill untrusted, malformed, or direct navigation state", () => {
    expect(getPrefilledPasswordResetEmail(null)).toBe("");
    expect(getPrefilledPasswordResetEmail({ prefilledEmail: "founder@example.com" })).toBe("");
    expect(
      getPrefilledPasswordResetEmail({
        prefilledEmail: "not-an-email",
        source: "login_forgot_password",
      }),
    ).toBe("");
  });
});
