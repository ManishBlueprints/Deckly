/// <reference types="node" />
/// <reference types="vitest/globals" />

import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("useManageDeckWorkflow upload contracts", () => {
  it("creates an enabled primary deck link when a new deck is uploaded", () => {
    const source = readSource("src/hooks/useManageDeckWorkflow.ts");

    expect(source).toContain('.from("deck_links")');
    expect(source).toContain('link_name: "Default Link"');
    expect(source).toContain("link_alias: slug");
    expect(source).toContain("is_enabled: true");
    expect(source).toContain("is_primary: true");
  });

  it("rolls back the created deck if primary link creation fails", () => {
    const source = readSource("src/hooks/useManageDeckWorkflow.ts");

    expect(source).toContain("Failed to rollback deck after primary link creation failure:");
    expect(source).toContain("await deckService.deleteDeck(");
  });
});
