/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = readFileSync(path.resolve(__dirname, "AuthContext.tsx"), "utf8");

describe("password recovery state", () => {
  it("survives recovery-session hydration but remains short-lived and user-scoped", () => {
    expect(source).toContain("useState(false)");
    expect(source).toContain('event === "PASSWORD_RECOVERY"');
    expect(source).toContain("sessionStorage");
    expect(source).toContain("PASSWORD_RECOVERY_MAX_AGE_MS");
    expect(source).toContain("isPasswordRecoverySession(session)");
    expect(source).toContain("clearPasswordRecoveryMarker()");
  });
});
