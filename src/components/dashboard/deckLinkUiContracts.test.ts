/// <reference types="node" />
/// <reference types="vitest/globals" />

import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("content multi-link UI contracts", () => {
  it("keeps ContentView free of deck-link modal state and mounts", () => {
    const source = readSource("src/components/dashboard/ContentView.tsx");

    expect(source).not.toContain("selectedDeckForLinks");
    expect(source).not.toContain("isDeckLinkManagerOpen");
    expect(source).not.toContain("DeckLinkManagerModal");
    expect(source).not.toContain("onManageLinks=");
  });

  it("makes DecksTable own the inline links panel flow", () => {
    const source = readSource("src/components/dashboard/DecksTable.tsx");

    expect(source).not.toContain("onManageLinks?: (deck: DeckWithAnalytics) => void");
    expect(source).toContain("openDeckLinkPanelId");
    expect(source).toContain("function DeckLinksPanel");
    expect(source).toContain("data-testid={`manage-deck-links-${deck.id}`}");
    expect(source).toContain("data-testid={`deck-link-panel-${deck.id}`}");
  });

  it("defines inline panel selectors and create/enable/disable/delete flows", () => {
    const source = readSource("src/components/dashboard/DecksTable.tsx");

    expect(source).toContain("data-testid={`create-deck-link-${deck.id}`}");
    expect(source).toContain("data-testid={`copy-primary-link-${deck.id}`}");
    expect(source).toContain("data-testid={`copy-deck-link-${link.id}`}");
    expect(source).toContain('data-testid={`${link.is_enabled ? "disable" : "enable"}-deck-link-${link.id}`}');
    expect(source).toContain("data-testid={`delete-deck-link-${link.id}`}");
  });

  it("keeps the legacy link modal on path-based aliases instead of null share paths", () => {
    const source = readSource("src/components/dashboard/DeckLinkManagerModal.tsx");

    expect(source).toContain("generateNextLinkAlias");
    expect(source).toContain("linkAlias: generateNextLinkAlias(deck.slug, links)");
    expect(source).toContain('`${baseAlias}-link${index}`');
  });

  it("removes legacy publish/unpublish shortcuts from DeckList and DeckDetailPanel", () => {
    const deckListSource = readSource("src/components/decks/DeckList.tsx");
    const detailPanelSource = readSource("src/components/decks/DeckDetailPanel.tsx");

    expect(deckListSource).not.toContain("publishDeck(");
    expect(deckListSource).not.toContain("getDeckShareUrl(");
    expect(deckListSource).toContain("<DeckLinkManagerModal");

    expect(detailPanelSource).not.toContain("publishDeck(");
    expect(detailPanelSource).not.toContain("unpublishDeck(");
    expect(detailPanelSource).toContain("Manage Links");
    expect(detailPanelSource).toContain("<DeckLinkManagerModal");
  });
});
