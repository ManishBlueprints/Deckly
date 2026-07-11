import { describe, expect, it } from "vitest";
import {
  getFriendlyAuthErrorMessage,
  isInvalidLoginCredentialsError,
} from "./authErrorMessages";

describe("invalid login credential handling", () => {
  it("recognizes Supabase's generic invalid-credentials message", () => {
    const error = new Error("Invalid login credentials");

    expect(isInvalidLoginCredentialsError(error)).toBe(true);
    expect(getFriendlyAuthErrorMessage(error)).toContain("Email or password is incorrect");
  });

  it("recognizes Supabase's invalid_credentials error code", () => {
    expect(isInvalidLoginCredentialsError({ code: "invalid_credentials" })).toBe(true);
  });

  it("does not classify CAPTCHA or network failures as invalid credentials", () => {
    expect(isInvalidLoginCredentialsError(new Error("CAPTCHA verification failed"))).toBe(false);
    expect(isInvalidLoginCredentialsError(new Error("Failed to fetch"))).toBe(false);
  });
});
