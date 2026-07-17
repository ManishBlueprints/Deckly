/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const read = (relativePath: string) => readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");

const migration = read("supabase/migrations/20260717000000_add_deck_watermarking.sql");
const signingFunction = read("supabase/functions/sign-deck-url/index.ts");
const generationFunction = read("supabase/functions/generate-watermarked-deck/index.ts");

describe("deck watermark contracts", () => {
  it("adds disabled-by-default deck state with paid-plan enforcement", () => {
    expect(migration).toContain("watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE");
    expect(migration).toContain("'deck_watermarking'");
    expect(migration).toContain("'RAISE'");
    expect(migration).toContain("Deck watermarking requires the Raise plan");
    expect(migration).toContain("PDF decks only");
  });

  it("backfills watermark revisions before enforcing constraints", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS watermark_revision UUID");
    expect(migration).not.toContain("watermark_revision UUID NOT NULL DEFAULT gen_random_uuid()");
    expect(migration).toContain("SET watermark_revision = gen_random_uuid()");
    expect(migration).toContain("CHECK (watermark_status IN ('disabled', 'pending', 'processing', 'ready', 'failed')) NOT VALID");
    expect(migration).toContain("VALIDATE CONSTRAINT decks_watermark_text_check");
  });

  it("exposes only the effective public setting across deck and data-room payloads", () => {
    expect(migration).toContain("'watermark_enabled', COALESCE(v_watermark_enabled, FALSE)");
    expect(migration).toContain("public.has_live_feature_for_user(d.user_id, 'deck_watermarking')");
    expect(migration).toContain("'watermark_text', CASE WHEN v_watermark_enabled");
  });

  it("fails downloads closed until a generated watermarked PDF is ready", () => {
    expect(signingFunction).toContain("watermark_not_ready");
    expect(signingFunction).toContain("watermarked_file_path");
    expect(signingFunction).toContain("downloadTarget.watermarkEnabled");
  });

  it("generates a separate protected PDF through ConvertAPI", () => {
    expect(generationFunction).toContain("convert/pdf/to/text-watermark");
    expect(generationFunction).toContain("watermark_revision");
    expect(generationFunction).toContain("/watermarks/");
    expect(generationFunction).toContain("watermark_status: \"ready\"");
  });
});
