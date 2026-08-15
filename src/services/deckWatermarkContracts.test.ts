/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const read = (relativePath: string) => readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");

const migration = read("supabase/migrations/20260717000000_add_deck_watermarking.sql");
const validationMigration = read("supabase/migrations/20260717000001_validate_deck_watermarking_constraints.sql");
const signingFunction = read("supabase/functions/sign-deck-url/index.ts");
const generationFunction = read("supabase/functions/generate-watermarked-deck/index.ts");
const r2Storage = read("supabase/functions/_shared/r2.ts");
const manageDeck = read("src/pages/ManageDeck.tsx");
const deckSettingsForm = read("src/components/dashboard/DeckSettingsForm.tsx");

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
    expect(migration).not.toContain("VALIDATE CONSTRAINT decks_watermark_text_check");
    expect(validationMigration).toContain("VALIDATE CONSTRAINT decks_watermark_revision_not_null");
    expect(validationMigration).toContain("VALIDATE CONSTRAINT decks_watermark_status_check");
    expect(validationMigration).toContain("VALIDATE CONSTRAINT decks_watermark_text_check");
    expect(validationMigration).toContain("ALTER COLUMN watermark_revision SET NOT NULL");
  });

  it("clears disabled watermark artifacts without refreshing unrelated updates", () => {
    expect(migration).toContain("NEW.watermarked_file_path := NULL;");
    expect(migration).toContain("NEW.watermark_enabled IS DISTINCT FROM OLD.watermark_enabled");
    expect(migration).toContain("NEW.watermark_text IS DISTINCT FROM OLD.watermark_text");
    expect(migration).toContain("NEW.watermarked_file_path IS DISTINCT FROM OLD.watermarked_file_path");
    expect(migration).toContain("NEW.watermark_error := NULL;\n\n    IF TG_OP = 'INSERT'");
  });

  it("exposes only the effective public setting across deck and data-room payloads", () => {
    expect(migration).toContain("'watermark_enabled', COALESCE(v_watermark_enabled, FALSE)");
    expect(migration).toContain("public.has_live_feature_for_user(d.user_id, 'deck_watermarking')");
    expect(migration).toContain("'watermark_text', CASE WHEN v_watermark_enabled");
  });

  it("does not temporarily lock deck controls while entitlements load", () => {
    expect(manageDeck).toContain('accessControls.isLoading || accessControls.access.state === "available"');
    expect(manageDeck).toContain('downloadControls.isLoading || downloadControls.access.state === "available"');
    expect(manageDeck).toContain('watermarkControls.isLoading || watermarkControls.access.state === "available"');
    expect(deckSettingsForm).toContain('accessControls.isLoading || accessControls.access.state === "available"');
    expect(deckSettingsForm).toContain('downloadControls.isLoading || downloadControls.access.state === "available"');
    expect(deckSettingsForm).toContain('watermarkControls.isLoading || watermarkControls.access.state === "available"');
  });

  it("fails downloads closed until a generated watermarked PDF is ready", () => {
    expect(signingFunction).toContain("watermark_not_ready");
    expect(signingFunction).toContain("watermarked_file_path");
    expect(signingFunction).toContain("downloadTarget.watermarkEnabled");
    expect(signingFunction).toContain("const JSON_RESPONSE_HEADERS");
    expect(signingFunction).not.toContain('headers: { "Content-Type": "application/json" }');
  });

  it("generates a separate protected PDF through ConvertAPI", () => {
    expect(generationFunction).toContain("convert/pdf/to/text-watermark");
    expect(generationFunction).toContain("watermark_revision");
    expect(generationFunction).toContain("watermark_status, watermarked_file_path");
    expect(generationFunction).toContain("/watermarks/");
    expect(generationFunction).toContain("watermark_status: \"ready\"");
    expect(generationFunction).toContain('listAllObjects("decks", watermarkPrefix)');
    expect(generationFunction).toContain("deleteObjects(");
    expect(generationFunction).toContain('deck.watermark_status === "ready" && deck.watermarked_file_path === expectedCurrentPath');
    expect(generationFunction).toContain('convertedDownloadUrl.protocol !== "https:"');
    expect(generationFunction).toContain("convertedDownloadUrl.hostname !== CONVERT_API_DOWNLOAD_HOST");
    expect(generationFunction).toContain("expiresInSeconds: 900,\n        signal,");
    expect(r2Storage).toContain("signal?: AbortSignal");
    expect(r2Storage).toContain("signal: options.signal");
  });
});
