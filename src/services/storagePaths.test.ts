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

  it("rejects lookalike hosts when matching configured public asset base urls", () => {
    expect(
      extractStoragePath("https://assets.example.com.evil.com/user-1/branding/logo.webp", "assets", {
        publicBaseUrls: ["https://assets.example.com"],
      }),
    ).toBeNull();
  });

  it("respects configured base url path prefixes", () => {
    expect(
      extractStoragePath("https://assets.example.com/storage/user-1/branding/logo.webp", "assets", {
        publicBaseUrls: ["https://assets.example.com/storage"],
      }),
    ).toBe("user-1/branding/logo.webp");

    expect(
      extractStoragePath("https://assets.example.com/storage-malicious/user-1/branding/logo.webp", "assets", {
        publicBaseUrls: ["https://assets.example.com/storage"],
      }),
    ).toBeNull();
  });

  it("extracts an R2 object key from a signed R2 URL", () => {
    expect(
      extractStoragePath(
        "https://account.r2.cloudflarestorage.com/decks/user-1/decks/investor-update.pdf?X-Amz-Signature=abc",
        "decks",
      ),
    ).toBe("user-1/decks/investor-update.pdf");
  });
});
