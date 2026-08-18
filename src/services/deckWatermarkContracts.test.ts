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
const processingFunction = read("supabase/functions/document-processing/index.ts");
const dispatchFunction = read("supabase/functions/dispatch-document-processing/index.ts");
const reconcileFunction = read("supabase/functions/reconcile-document-processing/index.ts");
const cleanupFunction = read("supabase/functions/cleanup-document-processing/index.ts");
const webhookFunction = read("supabase/functions/cloudconvert-webhook/index.ts");
const cloudConvertClient = read("supabase/functions/_shared/cloudconvert.ts");
const lifecycleMigration = read("supabase/migrations/20260818000001_document_processing_lifecycle.sql");
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

  it("generates a separate protected PDF through a durable CloudConvert job", () => {
    expect(processingFunction).toContain('action === "retry-watermark"');
    expect(dispatchFunction).toContain("createWatermarkJob");
    expect(dispatchFunction).toContain("CLOUDCONVERT_IO_URL_TTL_SECONDS");
    expect(cloudConvertClient).toContain("https://eu-central.api.cloudconvert.com/v2");
    expect(cloudConvertClient).toContain('operation: "watermark"');
    expect(cloudConvertClient).toContain('operation: "export/upload"');
    expect(lifecycleMigration).toContain("enqueue_deck_watermark_processing_job");
    expect(lifecycleMigration).toContain("publish_watermark_processing_job");
    expect(lifecycleMigration).toContain("watermarked_file_path = p_watermark_path");
    expect(r2Storage).toContain("copyObject");
    expect(r2Storage).toContain("readObjectRange");
  });

  it("allows a requested watermark only while an Office draft is private", () => {
    expect(lifecycleMigration).toContain("NEW.status = 'PENDING'");
    expect(lifecycleMigration).toContain("'/processing/%'");
    expect(lifecycleMigration).toContain("watermark_revision, watermark_status");
  });

  it("keeps watermark queue failures retryable without rolling back the deck save", () => {
    expect(lifecycleMigration).toContain("queue_deck_watermark_processing_job");
    expect(lifecycleMigration).toContain("watermark_status = 'failed'");
    expect(lifecycleMigration).toContain("watermark_status NOT IN ('pending', 'failed')");
    expect(lifecycleMigration).toContain("sync_failed_watermark_processing_job");
    expect(processingFunction).toContain('admin.rpc("queue_deck_watermark_processing_job"');
  });

  it("cleans up every terminal processing path and enforces retry limits per revision", () => {
    expect(reconcileFunction).toContain('ACTIVE_DOCUMENT_PROCESSING_STATUSES, "superseded"');
    expect(reconcileFunction).toContain("cancelSupersededProviderJob");
    expect(cleanupFunction).toContain("findCloudConvertJobsByTag");
    expect(processingFunction).toContain('admin.rpc("retry_document_processing_job"');
    expect(processingFunction).toContain('copyObject("decks", original.source_path, retrySourcePath)');
    expect(lifecycleMigration).toContain("retry_document_processing_job");
    expect(lifecycleMigration).toContain("document-processing-global-credit-cap");
  });

  it("preserves an Office job watermark revision and cancels ambiguous provider jobs", () => {
    expect(lifecycleMigration).toContain("deckly.preserve_watermark_revision");
    expect(processingFunction).toContain("cancelProviderJobs");
    expect(processingFunction).toContain("findCloudConvertJobsByTag");
    expect(webhookFunction).toContain("if (error) throw error;");
  });

  it("requires trusted storage verification before publishing a direct PDF", () => {
    expect(lifecycleMigration).toContain("PDF must be verified before it can be published");
    expect(processingFunction).toContain('action === "verify-direct-pdf"');
    expect(processingFunction).toContain("direct_pdf_verifications");
    expect(cleanupFunction).toContain("cleanupExpiredDirectPdfVerifications");
  });
});
