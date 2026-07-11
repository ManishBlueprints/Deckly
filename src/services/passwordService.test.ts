import { describe, expect, it } from "vitest";
import {
  getPasswordErrorMessage,
  isEmailPasswordSession,
  isReauthenticationRequired,
  PASSWORD_REQUIREMENTS_MESSAGE,
  validatePassword,
} from "./passwordService";

describe("password validation", () => {
  it("accepts a password that satisfies the configured policy", () => {
    expect(validatePassword("ValidPass1!", "ValidPass1!")).toBeNull();
  });

  it("rejects a confirmation mismatch and every missing requirement", () => {
    expect(validatePassword("ValidPass1!", "OtherPass1!")).toBe(
      "Passwords do not match.",
    );
    expect(validatePassword("Short1!", "Short1!")).toBe(
      PASSWORD_REQUIREMENTS_MESSAGE,
    );
    expect(validatePassword("alllowercase1!", "alllowercase1!")).toBe(
      PASSWORD_REQUIREMENTS_MESSAGE,
    );
    expect(validatePassword("ALLUPPERCASE1!", "ALLUPPERCASE1!")).toBe(
      PASSWORD_REQUIREMENTS_MESSAGE,
    );
    expect(validatePassword("NoDigitsHere!", "NoDigitsHere!")).toBe(
      PASSWORD_REQUIREMENTS_MESSAGE,
    );
    expect(validatePassword("NoSymbols123", "NoSymbols123")).toBe(
      PASSWORD_REQUIREMENTS_MESSAGE,
    );
  });
});

describe("password change security helpers", () => {
  it("recognizes Supabase's stale-session response", () => {
    expect(isReauthenticationRequired({ code: "reauthentication_needed" })).toBe(
      true,
    );
    expect(isReauthenticationRequired({ code: "invalid_credentials" })).toBe(
      false,
    );
  });

  it("shows a specific verification-code error", () => {
    expect(
      getPasswordErrorMessage({ code: "reauthentication_not_valid" }),
    ).toContain("incorrect or expired");
  });

  it("shows password management only for email/password accounts", () => {
    expect(isEmailPasswordSession({ app_metadata: { provider: "email" } })).toBe(
      true,
    );
    expect(isEmailPasswordSession({ app_metadata: { provider: "google" } })).toBe(
      false,
    );
  });
});
