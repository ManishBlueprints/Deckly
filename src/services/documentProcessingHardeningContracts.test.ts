/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");

describe("document processing hardening contracts", () => {
  it("pre-optimizes dependencies required by the lazy deck editor route", () => {
    const viteConfig = read("vite.config.ts");
    expect(viteConfig).toContain('"pdfjs-dist"');
    expect(viteConfig).toContain('"@radix-ui/react-switch"');
  });

  it("rejects oversized PDFs before entering the render loop", () => {
    const processing = read("src/workflows/deckProcessing.ts");
    const manageWorkflow = read("src/hooks/useManageDeckWorkflow.ts");
    const settingsForm = read("src/components/dashboard/DeckSettingsForm.tsx");
    const detailPanel = read("src/components/decks/DeckDetailPanel.tsx");
    expect(processing.indexOf("numPages > maxPages")).toBeLessThan(
      processing.indexOf("for (let i = 1; i <= numPages; i++)"),
    );
    expect(manageWorkflow).toContain("maxPages: MAX_DECK_PAGES");
    expect(settingsForm).toContain("maxPages: MAX_DECK_PAGES");
    expect(detailPanel).toContain("maxPages: MAX_DECK_PAGES");
  });

  it("keeps ambiguous CloudConvert submissions eligible for reconciliation", () => {
    const dispatch = read("supabase/functions/dispatch-document-processing/index.ts");
    expect(dispatch).toContain('error.code === "request_timeout"');
    expect(dispatch).toContain("[408, 425, 502, 503, 504].includes(error.status)");
    expect(dispatch).toContain('admin.rpc("mark_document_processing_submission_uncertain"');
  });

  it("uses the owner tier page limit and distinguishes missing metadata", () => {
    const reconcile = read("supabase/functions/reconcile-document-processing/index.ts");
    expect(reconcile).toContain('"get_tier_limit_for_user"');
    expect(reconcile).toContain('typeof tierLimit.max_document_pages === "number"');
    expect(reconcile).toContain("pageCount === null");
    expect(reconcile).not.toContain("pageCount > 500");
  });

  it("protects every server-managed deck path from client mutation", () => {
    const storage = read("supabase/functions/r2-storage/index.ts");
    const processing = read("supabase/functions/document-processing/index.ts");
    const deckService = read("src/services/deckService.ts");
    expect(storage).toContain("/decks/verified/");
    expect(storage).toContain("/revisions/");
    expect(storage).toContain("/watermarks/");
    expect(storage.match(/isServerManagedDeckPath\(currentUser\.user\.id, key\)/g)).toHaveLength(2);
    expect(processing).toContain('action === "delete-deck-artifacts"');
    expect(processing).toContain("deleteOwnedDeckArtifacts");
    expect(deckService).toContain('action: "delete-deck-artifacts"');
  });

  it("keeps post-publish analytics outside the publication failure path", () => {
    const reconcile = read("supabase/functions/reconcile-document-processing/index.ts");
    expect(reconcile).toContain("Publication is already committed");
    expect(reconcile).toContain('console.error("PostHog primary link capture failed"');
  });

  it("does not finalize cleanup after a failed deck read", () => {
    const cleanup = read("supabase/functions/cleanup-document-processing/index.ts");
    expect(cleanup).toContain("if (deckError) throw deckError;");
  });

  it("bounds provider tag reconciliation and excludes historical jobs", () => {
    const processing = read("supabase/functions/document-processing/index.ts");
    const deleteAccount = read("supabase/functions/delete-account/index.ts");
    expect(processing).toContain("mapWithConcurrency");
    expect(processing).not.toContain('[...ACTIVE_DOCUMENT_PROCESSING_STATUSES, "superseded", "cancelled"]');
    expect(deleteAccount).toContain("PROVIDER_LOOKUP_CONCURRENCY");
    expect(deleteAccount).toContain("jobsMissingProviderId");
    expect(processing).toContain("Provider tag lookup failed during deck deletion");
    expect(processing).toContain("{ bestEffort: true }");
  });
});
