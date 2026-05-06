import { describe, expect, it } from "vitest";
import { buildTallyEmbedUrl } from "./tally";

describe("buildTallyEmbedUrl", () => {
  it("converts a Tally share url to the embed url and appends params", () => {
    const result = buildTallyEmbedUrl("https://tally.so/r/WOl6Va", {
      source: "deckly-app",
      page: "/feedback",
    });

    const url = new URL(result);

    expect(url.origin).toBe("https://tally.so");
    expect(url.pathname).toBe("/embed/WOl6Va");
    expect(url.searchParams.get("alignLeft")).toBe("1");
    expect(url.searchParams.get("hideTitle")).toBe("1");
    expect(url.searchParams.get("dynamicHeight")).toBe("1");
    expect(url.searchParams.get("source")).toBe("deckly-app");
    expect(url.searchParams.get("page")).toBe("/feedback");
  });

  it("keeps an existing embed path and skips empty params", () => {
    const result = buildTallyEmbedUrl("https://tally.so/embed/WOl6Va", {
      source: "deckly-app",
      page: "",
    });

    const url = new URL(result);

    expect(url.pathname).toBe("/embed/WOl6Va");
    expect(url.searchParams.get("source")).toBe("deckly-app");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("rejects non-Tally origins", () => {
    expect(() =>
      buildTallyEmbedUrl("https://example.com/r/WOl6Va", {
        source: "deckly-app",
        page: "/feedback",
      }),
    ).toThrow("tally.so domain");
  });

  it("rejects non-https urls", () => {
    expect(() =>
      buildTallyEmbedUrl("http://tally.so/r/WOl6Va", {
        source: "deckly-app",
        page: "/feedback",
      }),
    ).toThrow("use HTTPS");
  });

  it("rejects unsupported Tally paths", () => {
    expect(() =>
      buildTallyEmbedUrl("https://tally.so/forms/WOl6Va", {
        source: "deckly-app",
        page: "/feedback",
      }),
    ).toThrow("share or embed path");
  });
});
