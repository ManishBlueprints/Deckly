import { describe, it, expect } from "vitest";
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

  it("strips characters that are not a-z, 0-9, or hyphen", () => {
    expect(normalizeSlug("café & co.")).toBe("caf-co");
  });

  it("strips leading and trailing hyphens", () => {
    expect(normalizeSlug("-hello-world-")).toBe("hello-world");
  });

  it("collapses consecutive hyphens", () => {
    expect(normalizeSlug("hello--world")).toBe("hello-world");
  });

  it("handles an already valid slug unchanged", () => {
    expect(normalizeSlug("my-deck")).toBe("my-deck");
  });

  it("handles numeric slugs", () => {
    expect(normalizeSlug("2024 Q1 Deck")).toBe("2024-q1-deck");
  });

  it("returns empty string for input with no valid characters", () => {
    expect(normalizeSlug("!@#$%^&*()")).toBe("");
  });

  it("trims leading/trailing whitespace before slugifying", () => {
    expect(normalizeSlug("  spaced  ")).toBe("spaced");
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

  it("handles unicode/emoji by stripping them", () => {
    expect(normalizeHandle("manish🚀")).toBe("manish");
  });
});
