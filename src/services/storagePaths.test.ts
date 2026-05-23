/// <reference types="vitest/globals" />

import { extractStoragePath, isStorageKey } from "./storagePaths";

describe("storagePaths", () => {
  it("extracts storage keys from legacy Supabase storage URLs", () => {
    expect(
      extractStoragePath(
        "https://example.com/storage/v1/object/public/decks/user-1/decks/seed.pdf",
        "decks",
      ),
    ).toBe("user-1/decks/seed.pdf");

    expect(
      extractStoragePath(
        "https://example.com/storage/v1/object/sign/decks/user-1/page-1.webp?token=abc",
        "decks",
      ),
    ).toBe("user-1/page-1.webp");
  });

  it("accepts raw storage keys directly", () => {
    expect(extractStoragePath("user-1/decks/seed.pdf", "decks")).toBe(
      "user-1/decks/seed.pdf",
    );
    expect(isStorageKey("user-1/decks/seed.pdf")).toBe(true);
    expect(isStorageKey("https://example.com/file.pdf")).toBe(false);
  });

  it("extracts keys from configured public asset base urls", () => {
    expect(
      extractStoragePath("https://assets.example.com/user-1/branding/logo.webp", "assets", {
        publicBaseUrls: ["https://assets.example.com"],
      }),
    ).toBe("user-1/branding/logo.webp");
  });
});
