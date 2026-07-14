/// <reference types="node" />
/// <reference types="vitest/globals" />

import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("useManageDeckWorkflow upload contracts", () => {
  it("creates a new deck through the atomic deck-and-primary-link RPC", () => {
    const source = readSource("src/hooks/useManageDeckWorkflow.ts");
    const migration = readSource(
      "supabase/migrations/20260522090000_create_deck_with_primary_link.sql",
    );

    expect(source).toContain('supabase.rpc(');
    expect(source).toContain('"create_deck_with_primary_link"');
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_deck_with_primary_link");
    expect(migration).toContain("'Default Link'");
    expect(migration).toContain("p_slug");
    expect(migration).toContain("true,");
  });

  it("threads the download permission through create, update, and rollback paths", () => {
    const source = readSource("src/hooks/useManageDeckWorkflow.ts");

    expect(source).toContain("allowDownload");
    expect(source).toContain("allow_download: allowDownload");
    expect(source).toContain("p_allow_download: allowDownload");
    expect(source).toContain("allow_download: previousValues.allow_download");
  });

  it("rolls back the created deck if post-create conversion fails", () => {
    const source = readSource("src/hooks/useManageDeckWorkflow.ts");

    expect(source).toContain("Interactive conversion failed for newly created deck:");
    expect(source).toContain("Failed to rollback newly created deck after conversion failure:");
    expect(source).toContain("await deckService.deleteDeck(");
  });

  it("clears extracted text when replacing a deck source file", () => {
    const workflowSource = readSource("src/hooks/useManageDeckWorkflow.ts");
    const settingsSource = readSource("src/components/dashboard/DeckSettingsForm.tsx");
    const detailSource = readSource("src/components/decks/DeckDetailPanel.tsx");

    expect(workflowSource).toContain("...(file ? { extracted_text: null } : {}),");
    expect(workflowSource).toContain("extracted_text: previousValues.extracted_text,");
    expect(settingsSource).toContain("...(newFile ? { extracted_text: null } : {}),");
    expect(detailSource).toContain("...(newFile ? { extracted_text: null } : {}),");
  });
});
