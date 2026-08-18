/// <reference types="node" />
/// <reference types="vitest/globals" />

import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("useManageDeckWorkflow upload contracts", () => {
  const workflow = () => readSource("src/hooks/useManageDeckWorkflow.ts");

  it("uses a durable async path for Office files rather than browser-side conversion", () => {
    const source = workflow();

    expect(source).toContain('if (file && fileType !== "pdf")');
    expect(source).toContain("documentProcessingService.prepareOfficeUpload");
    expect(source).toContain("documentProcessingService.uploadPreparedOfficeSource");
    expect(source).toContain("documentProcessingService.completeUpload");
    expect(source).not.toContain("document-processor");
    expect(source).not.toContain("triggerAndProcessConversion");
  });

  it("keeps a live replacement source intact until the Office job publishes", () => {
    const source = workflow();

    expect(source).toContain("replacementDeckId: editId ?? undefined");
    expect(source).toContain("metadata travels with the job");
    expect(source).not.toContain("Interactive conversion failed for newly created deck:");
  });

  it("keeps direct PDF processing local and enforces the page cap", () => {
    const source = workflow();

    expect(source).toContain("processPdfToImages");
    expect(source).toContain("Viewable documents are limited to 500 pages.");
    expect(source).toContain("deckStorageService.uploadSlideImages");
  });

  it("queues watermark processing without awaiting a provider request", () => {
    const source = workflow();

    expect(source).toContain("Preparing protected download in the background...");
    expect(source).not.toContain("generateWatermarkedDeck(editId)");
    expect(source).not.toContain("generateWatermarkedDeck(deckRecord.id)");
  });

  it("continues to persist download permission for direct PDF saves", () => {
    expect(workflow()).toContain("allow_download: allowDownload");
  });
});
