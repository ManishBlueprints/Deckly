/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migration = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20260716000000_unify_tier_entitlements.sql"),
  "utf8",
);

describe("tier entitlement migration contracts", () => {
  it("fails before changing limits when unsupported tiers need an explicit migration", () => {
    expect(migration).toContain(
      "Unsupported tier limits must be migrated before applying canonical tier limits",
    );
    expect(migration).not.toContain("DELETE FROM public.tier_limits");
    expect(migration.indexOf("Unsupported tier limits must be migrated")).toBeLessThan(
      migration.indexOf("UPDATE public.tier_limits"),
    );
  });
});
