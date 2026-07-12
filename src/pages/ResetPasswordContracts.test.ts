/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = readFileSync(path.resolve(__dirname, "ResetPassword.tsx"), "utf8");

describe("ResetPassword recovery fallback", () => {
  it("keeps the reauthentication fallback reachable after clearing recovery state", () => {
    expect(source).toContain(
      "if (!session || (!passwordRecovery && !complete && !requiresNewRecoveryLink))",
    );
    expect(source).toContain("setRequiresNewRecoveryLink(true)");
    expect(source).toContain("Request a new reset link");
    expect(source).toContain("setComplete(true)");
    expect(source).toContain("Password updated");
  });
});
