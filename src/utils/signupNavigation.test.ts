import { describe, expect, it } from "vitest";
import {
  createSignupNavigationState,
  getPrefilledSignupEmail,
} from "./signupNavigation";

describe("signup navigation state", () => {
  it("preserves a valid email without placing it in the URL", () => {
    const state = createSignupNavigationState("  founder@example.com  ");

    expect(state).toEqual({
      prefilledEmail: "founder@example.com",
      source: "login_invalid_credentials",
    });
    expect(getPrefilledSignupEmail(state)).toBe("founder@example.com");
  });

  it("starts blank for direct, malformed, or untrusted navigation state", () => {
    expect(getPrefilledSignupEmail(null)).toBe("");
    expect(getPrefilledSignupEmail({ prefilledEmail: "founder@example.com" })).toBe("");
    expect(getPrefilledSignupEmail({
      prefilledEmail: "not-an-email",
      source: "login_invalid_credentials",
    })).toBe("");
  });
});
