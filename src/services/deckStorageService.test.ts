/// <reference types="vitest/globals" />

import { vi } from "vitest";

const mockList = vi.fn();
const mockRemove = vi.fn();
const mockGetPublicUrl = vi.fn((bucket: string, path: string) => `https://cdn.example/${bucket}/${path}`);
const mockExtractStoragePath = vi.fn();

vi.mock("./storageService.ts", () => ({
  storageService: {
    list: mockList,
    remove: mockRemove,
    getPublicUrl: mockGetPublicUrl,
  },
}));

vi.mock("./deckService.shared.ts", () => ({
  extractStoragePath: mockExtractStoragePath,
  getRequiredDeckUserId: vi.fn(async () => "user-123"),
}));

describe("deckStorageService", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockRemove.mockReset();
    mockGetPublicUrl.mockClear();
    mockExtractStoragePath.mockReset();
  });

  it("only deletes assets under the exact deck prefix", async () => {
    mockList.mockResolvedValueOnce({
      data: {
        items: [
          { name: "user-123/deck-images/my-deck/page-1.webp" },
          { name: "user-123/deck-images/my-deckish/page-2.webp" },
        ],
        nextToken: null,
      },
      error: null,
    });
    mockRemove.mockResolvedValue({ error: null });
    mockExtractStoragePath.mockReturnValue("user-123/decks/my-deck.pdf");

    const { deckStorageService } = await import("./deckStorageService.ts");

    await deckStorageService.deleteDeckAssets(
      "https://cdn.example/decks/user-123/decks/my-deck.pdf",
      "my-deck",
      "user-123",
    );

    expect(mockList).toHaveBeenCalledWith(
      "decks",
      "user-123/deck-images/my-deck/",
      { continuationToken: null },
    );
    expect(mockRemove).toHaveBeenCalledWith(
      "decks",
      ["user-123/deck-images/my-deck/page-1.webp"],
    );
  });

  it("removes every watermark revision for the deleted deck only", async () => {
    mockList.mockResolvedValueOnce({
      data: {
        items: [
          { name: "user-123/watermarks/deck-123/1.pdf" },
          { name: "user-123/watermarks/deck-123/2.pdf" },
          { name: "user-123/watermarks/deck-123-other/1.pdf" },
        ],
        nextToken: null,
      },
      error: null,
    });
    mockRemove.mockResolvedValue({ error: null });

    const { deckStorageService } = await import("./deckStorageService.ts");

    await deckStorageService.deleteDeckWatermarkAssets("deck-123", "user-123");

    expect(mockList).toHaveBeenCalledWith(
      "decks",
      "user-123/watermarks/deck-123/",
      { continuationToken: null },
    );
    expect(mockRemove).toHaveBeenCalledWith(
      "decks",
      ["user-123/watermarks/deck-123/1.pdf", "user-123/watermarks/deck-123/2.pdf"],
    );
  });
});
