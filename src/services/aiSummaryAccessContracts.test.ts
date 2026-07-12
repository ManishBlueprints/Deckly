/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const functionSource = readFileSync(
  path.resolve(__dirname, "../../supabase/functions/ai-summary/index.ts"),
  "utf8",
);

describe("AI summary deck access", () => {
  it("allows owners but excludes password-protected decks from public access", () => {
    expect(functionSource).toContain("const getAccessibleDeckForAi");
    expect(functionSource).toContain('.eq("user_id", userId)');
    expect(functionSource).toContain('.eq("is_public", true)');
    expect(functionSource).toContain('.eq("require_password", false)');
    expect(functionSource).toContain(
      "getAccessibleDeckForAi(supabaseClient, scopeId)",
    );
    expect(functionSource).toContain("reference.scope_id,");
    expect(functionSource).toContain("scopeType === \"deck\"");
  });

  it("does not rely on the previous broad public-or-owner filter", () => {
    expect(functionSource).not.toContain("user_id.eq.${userId},is_public.eq.true");
  });
});
