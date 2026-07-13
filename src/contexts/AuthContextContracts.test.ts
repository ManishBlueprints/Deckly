/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = readFileSync(path.resolve(__dirname, "AuthContext.tsx"), "utf8");

describe("password recovery state", () => {
  it("is transient and is set only from Supabase's recovery event", () => {
    expect(source).toContain("useState(false)");
    expect(source).toContain('event === "PASSWORD_RECOVERY"');
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("localStorage");
  });
});
