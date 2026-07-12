/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260712000000_harden_deck_link_analytics.sql",
  ),
  "utf8",
);

describe("deck link analytics isolation", () => {
  it("accepts only links owned by the recorded deck", () => {
    expect(migrationSql).toContain(
      "WHERE id = p_deck_link_id AND deck_id = p_deck_id",
    );
  });

  it("deduplicates visits per link and aggregates only matching deck rows", () => {
    expect(migrationSql).toContain(
      "dpv.deck_link_id IS NOT DISTINCT FROM p_deck_link_id",
    );
    expect(migrationSql).toContain("deck_link_id = p_deck_link_id");
    expect(migrationSql).toContain("AND dpv.deck_id = dl.deck_id");
  });
});
