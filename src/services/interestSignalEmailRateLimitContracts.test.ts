/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260712001000_rate_limit_interest_signal_email_events.sql",
  ),
  "utf8",
);

describe("interest signal email queue rate limiting", () => {
  it("serializes queue attempts and caps notifications per deck", () => {
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("v_events_last_hour >= 5");
    expect(migrationSql).toContain("v_events_last_day >= 20");
    expect(migrationSql).toContain("RETURN NULL");
    expect(migrationSql).toContain("BEFORE INSERT ON public.interest_signal_email_events");
  });
});
