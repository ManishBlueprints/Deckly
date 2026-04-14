/// <reference types="vitest/globals" />

import { normalizeSlug, normalizeHandle } from "./slug";

// ─── normalizeSlug ──────────────────────────────────────────────────────────
describe("normalizeSlug", () => {
  it("lowercases the input", () => {
    expect(normalizeSlug("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeSlug("my deck name")).toBe("my-deck-name");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(normalizeSlug("hello   world")).toBe("hello-world");
  });

  it("handles unicode/accented characters by normalizing them", () => {
    expect(normalizeSlug("Café & Co")).toBe("cafe-co");
    expect(normalizeSlug("Crème Brûlée")).toBe("creme-brulee");
  });

  it("truncates long strings to 200 characters", () => {
    const longString = "a".repeat(300);
    expect(normalizeSlug(longString).length).toBe(200);
  });

  it("handles multiple mixed delimiters correctly", () => {
    expect(normalizeSlug("hello---   ---world")).toBe("hello-world");
  });
});

// ─── normalizeHandle ────────────────────────────────────────────────────────
describe("normalizeHandle", () => {
  it("lowercases the input", () => {
    expect(normalizeHandle("ManishKumar")).toBe("manishkumar");
  });

  it("strips whitespace", () => {
    expect(normalizeHandle("  manish  ")).toBe("manish");
  });

  it("strips hyphens and special characters (handles are alphanumeric only)", () => {
    expect(normalizeHandle("manish-kumar")).toBe("manishkumar");
  });

  it("strips spaces between words", () => {
    expect(normalizeHandle("Manish Kumar")).toBe("manishkumar");
  });

  it("strips non-alphanumeric characters like dots and underscores", () => {
    expect(normalizeHandle("manish.kumar_99")).toBe("manishkumar99");
  });

  it("handles purely numeric input", () => {
    expect(normalizeHandle("12345")).toBe("12345");
  });

  it("returns empty string for input with no valid characters", () => {
    expect(normalizeHandle("!@#$%")).toBe("");
  });

  it("handles unicode/emoji by normalizing or stripping them", () => {
    expect(normalizeHandle("manish🚀")).toBe("manish");
    expect(normalizeHandle("Mánish")).toBe("manish");
  });

  it("truncates long handles to 50 characters", () => {
    const longHandle = "u".repeat(100);
    expect(normalizeHandle(longHandle).length).toBe(50);
  });
});
